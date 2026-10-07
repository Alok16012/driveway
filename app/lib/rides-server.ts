/* Live ride engine, server-only. Customer and rider server actions call into this after the caller's
 * Supabase session has been checked; everything here runs with the service-role key.
 *
 * Lifecycle: Searching (offered to one rider at a time) → Arriving (rider accepted) → Arrived → Started →
 * Completed, or Cancelled at any point before completion. */
import "server-only";
import { supabaseAdmin as db } from "./supabase/admin";
import { getCatalog } from "./catalog";
import { DRIVER_SHARE, RIDE_SELECT, initials, toDriver, toFeedback, toRide, toWalletTxn } from "./mappers";
import { CURRENT_LOCATION, PLACES, discountFor, fareFor, parcelFareFor, tripEstimate, type Coupon, type Driver, type ParcelInfo, type PayMethod, type Service, type VehicleKind } from "./data";

export const ACTIVE = ["Assigned", "Arriving", "Arrived", "Started"] as const;
/** How long one rider has to answer a request before it moves on (the rider app shows a 15 s timer). */
const OFFER_SECONDS = 20;
/** Give up on a booking that nobody has accepted after this long. */
const SEARCH_LIMIT_SECONDS = 75;
/** Waiting at pickup: free for 3 minutes, then ₹2 per started minute (matches the rider app's timer). */
const FREE_WAIT_SEC = 180;
const WAIT_FEE_PER_MIN = 2;
/** Wrong ride-OTP entries allowed before the OTP locks. */
const OTP_MAX_ATTEMPTS = 5;
export const NO_DRIVERS = "No drivers available nearby right now — please try again shortly";

/** Postgres unique-violation code — the database's one-live-ride / one-offer / one-record rules (migration 0007). */
const UNIQUE = "23505";
const isUnique = (e: { code?: string } | null | undefined) => e?.code === UNIQUE;

/* ───────── Who is calling ───────── */

async function userId(token: string) {
  const { data } = await db.auth.getUser(String(token));
  if (!data.user) throw new Error("Please log in again");
  return data.user.id;
}

export async function customerFor(token: string) {
  const { data } = await db.from("customers").select("*").eq("user_id", await userId(token)).maybeSingle();
  if (!data) throw new Error("Finish setting up your profile first");
  if (data.blocked) throw new Error("Your account is blocked");
  return data;
}

export async function riderFor(token: string) {
  const { data } = await db.from("drivers").select("*").eq("user_id", await userId(token)).maybeSingle();
  if (!data) throw new Error("Rider profile not found");
  if (data.kyc !== "Approved") throw new Error("Your rider account isn't approved yet");
  if (data.suspended) throw new Error("Your rider account is suspended");
  return data;
}

/* ───────── Pricing ───────── */

/** Peak hours are judged in India time, whatever timezone the server runs in. */
function isPeakIST(now = new Date()) {
  const t = new Date(now.getTime() + 5.5 * 3600 * 1000);
  const day = t.getUTCDay(), h = t.getUTCHours();
  return day >= 1 && day <= 5 && ((h >= 8 && h < 11) || (h >= 18 && h < 21));
}

export interface BookingInput {
  service: Service; vehicle: VehicleKind; ac: boolean; pay: PayMethod;
  fromId: string; fromName: string; toId: string; toName: string;
  parcel?: ParcelInfo; couponCode?: string;
}

const PAYS: PayMethod[] = ["UPI", "Cash", "Card", "Wallet"];

/** Re-prices a booking from the database catalog — the client's own numbers are never trusted. */
/** Pickup/drop must be places the app knows (until real maps exist, the server prices from these ids,
 * so it can't accept arbitrary ids or names from the client). */
const KNOWN_PLACES = new Map([CURRENT_LOCATION, ...PLACES].map((p) => [p.id, p]));

function istDay(now = new Date()) {
  return new Date(now.getTime() + 5.5 * 3600 * 1000);
}

/** Rides counted against a coupon's limits: anything not cancelled. */
const couponRides = () => db.from("rides").select("id", { count: "exact", head: true }).neq("status", "Cancelled");

/** Checks every rule a coupon carries (catalog columns from migration 0007). Throws a customer-facing reason. */
async function couponFor(code: string, customerId: string, vehicle: VehicleKind, fare: number): Promise<Coupon> {
  const name = code.toUpperCase().trim();
  const { data: c } = await db.from("coupons").select("*").eq("code", name).maybeSingle();
  if (!c || !c.active) throw new Error(`${name} isn't a valid coupon right now`);
  if (c.expires && c.expires < istDay().toISOString().slice(0, 10)) throw new Error(`${name} has expired`);
  if (c.vehicles?.length && !c.vehicles.includes(vehicle)) throw new Error(`${name} isn't valid for this vehicle`);
  if (fare < +c.min_fare) throw new Error(`${name} needs a fare of at least ₹${+c.min_fare}`);
  if (c.weekend_only && ![0, 6].includes(istDay().getUTCDay())) throw new Error(`${name} works on Saturdays and Sundays only`);
  if (c.first_ride_only) {
    const { count } = await db.from("rides").select("id", { count: "exact", head: true }).eq("customer_id", customerId).eq("status", "Completed");
    if (count) throw new Error(`${name} is for your first ride only`);
  }
  if (c.per_user_limit != null && ((await couponRides().eq("customer_id", customerId).eq("coupon_code", c.code)).count ?? 0) >= c.per_user_limit) {
    throw new Error(`You've already used ${name}`);
  }
  if (c.max_uses != null && ((await couponRides().eq("coupon_code", c.code)).count ?? 0) >= c.max_uses) {
    throw new Error(`${name} has been fully used`);
  }
  return { code: c.code, title: c.title, body: c.body, expires: c.expires, off: +c.off, pct: !!c.pct, max: c.max == null ? undefined : +c.max };
}

async function price(b: BookingInput, customerId: string) {
  const { vehicles, parcelWeights, settings } = await getCatalog();
  if (settings.maintenance) throw new Error("Bookings are paused for maintenance — please try again shortly");
  if (!PAYS.includes(b.pay) || (b.pay === "Cash" ? !settings.cash : !settings.online)) throw new Error("That payment method isn't available right now");
  const v = vehicles.find((x) => x.id === b.vehicle && x.enabled);
  if (!v) throw new Error("That vehicle type isn't available right now");
  const from = KNOWN_PLACES.get(String(b.fromId)), to = KNOWN_PLACES.get(String(b.toId));
  if (!from || !to) throw new Error("Choose your pickup and drop from the list");
  if (from.id === to.id) throw new Error("Pickup and drop can't be the same place");
  const { km, min } = tripEstimate(from.id, to.id);
  const surge = settings.surgeOn && isPeakIST() ? settings.surgeMult : 1;
  let fare: number, weightId: string | null = null;
  if (b.service === "parcel") {
    const w = parcelWeights.find((x) => x.label === b.parcel?.weight);
    if (!w || !b.parcel) throw new Error("Choose a parcel weight");
    if (v.parcelMaxKg < w.kg) throw new Error(`${v.name} can't carry parcels of ${w.label}`);
    fare = parcelFareFor(v, km, min, w, surge);
    weightId = w.id;
  } else {
    fare = fareFor(v, km, min, surge, v.acOption ? b.ac : true);
  }
  const coupon = b.couponCode ? await couponFor(String(b.couponCode), customerId, v.id, fare) : null;
  return { v, km, min, surge, fare, discount: discountFor(coupon, fare), couponCode: coupon?.code ?? null, weightId, from, to };
}

/* ───────── Dispatch ───────── */

/** Offers a Searching ride to one available rider: approved, online, not suspended, right vehicle,
 * not already on a trip or holding another live offer, and not one who already passed on it. */
export async function offerNext(rideId: string) {
  const { data: ride } = await db.from("rides").select("id, vehicle, status, declined_by, customer:customers(user_id)").eq("id", rideId).single();
  if (!ride || ride.status !== "Searching") return false;
  const bookedBy = (ride.customer as unknown as { user_id: string | null } | null)?.user_id ?? null;
  const { data: pool } = await db.from("drivers").select("id, user_id")
    .eq("vehicle", ride.vehicle).eq("kyc", "Approved").eq("suspended", false).eq("online", true);
  const ids = (pool ?? [])
    .filter((d) => !bookedBy || d.user_id !== bookedBy) // a login that is also a rider is never sent its own booking
    .map((d) => d.id).filter((id) => !(ride.declined_by ?? []).includes(id));
  if (!ids.length) return false;
  const nowIso = new Date().toISOString();
  // Offers that ran out on rides nobody is watching would otherwise keep those riders reserved.
  await db.from("rides").update({ offered_to: null, offer_expires_at: null })
    .eq("status", "Searching").in("offered_to", ids).lt("offer_expires_at", nowIso).neq("id", rideId);
  const [{ data: busy }, { data: holding }] = await Promise.all([
    db.from("rides").select("driver_id").in("driver_id", ids).in("status", ACTIVE as unknown as string[]),
    db.from("rides").select("offered_to").in("offered_to", ids).eq("status", "Searching").gt("offer_expires_at", nowIso).neq("id", rideId),
  ]);
  const taken = new Set([...(busy ?? []).map((r) => r.driver_id), ...(holding ?? []).map((r) => r.offered_to)]);
  const free = ids.filter((id) => !taken.has(id)).sort(() => Math.random() - 0.5);
  // Another booking may grab the same rider at the same moment: the unique index then rejects this offer
  // and the next free rider is tried.
  for (const pick of free) {
    const { data: updated, error } = await db.from("rides")
      .update({ offered_to: pick, offer_expires_at: new Date(Date.now() + OFFER_SECONDS * 1000).toISOString() })
      .eq("id", rideId).eq("status", "Searching").is("offered_to", null).select("id");
    if (isUnique(error)) continue;
    return !!updated?.length;
  }
  return false;
}

/** Moves a Searching ride along: expire a stale offer, try the next rider, or give up after the limit. */
export async function tickSearch(rideId: string) {
  const { data: ride } = await db.from("rides").select("id, status, offered_to, offer_expires_at, declined_by, created_at, search_started_at").eq("id", rideId).single();
  if (!ride || ride.status !== "Searching") return;
  if (ride.offered_to && new Date(ride.offer_expires_at).getTime() < Date.now()) {
    await db.from("rides").update({ offered_to: null, offer_expires_at: null, declined_by: [...(ride.declined_by ?? []), ride.offered_to] })
      .eq("id", rideId).eq("offered_to", ride.offered_to);
    ride.offered_to = null;
  }
  const since = new Date(ride.search_started_at ?? ride.created_at).getTime();
  if (!ride.offered_to && !(await offerNext(rideId)) && Date.now() - since > SEARCH_LIMIT_SECONDS * 1000) {
    await db.from("rides").update({ status: "Cancelled", cancel_reason: NO_DRIVERS, offered_to: null }).eq("id", rideId).eq("status", "Searching");
  }
}

/* ───────── Customer side ───────── */

export async function book(token: string, b: BookingInput) {
  const me = await customerFor(token);
  // A search left running by a closed tab times out here rather than blocking the new booking.
  const { data: searching } = await db.from("rides").select("id").eq("customer_id", me.id).eq("status", "Searching");
  for (const r of searching ?? []) await tickSearch(r.id);
  const { count } = await db.from("rides").select("id", { count: "exact", head: true })
    .eq("customer_id", me.id).in("status", ["Searching", ...ACTIVE]);
  if (count) throw new Error("You already have a ride in progress");
  const p = await price(b, me.id);
  const parcel = b.service === "parcel" && b.parcel;
  const { data, error } = await db.from("rides").insert({
    service: b.service === "parcel" ? "parcel" : "ride", customer_id: me.id, vehicle: p.v.id, ac: b.service !== "parcel" && p.v.acOption ? !!b.ac : null,
    from_address: p.from.name, to_address: p.to.name, km: p.km, min: p.min,
    fare: p.fare, discount: p.discount, coupon_code: p.couponCode, pay: b.pay, paid: false, status: "Searching",
    otp: String(1000 + Math.floor(Math.random() * 9000)),
    parcel_type: parcel ? b.parcel!.type : null, parcel_weight: p.weightId,
    parcel_receiver: parcel ? String(b.parcel!.receiver).slice(0, 80) : null,
    parcel_receiver_phone: parcel ? String(b.parcel!.receiverPhone).slice(0, 20) : null,
    parcel_note: parcel ? (b.parcel!.note ? String(b.parcel!.note).slice(0, 200) : null) : null,
  }).select("id, otp, fare, discount, km, min").single();
  if (isUnique(error)) throw new Error("You already have a ride in progress");
  if (error) throw new Error(error.message);
  await offerNext(data.id);
  return { id: data.id as string, otp: data.otp as string, fare: +data.fare, discount: +data.discount, km: +data.km, min: data.min as number, surge: p.surge };
}

/** What the customer's live screen needs. Also advances dispatch while the ride is still searching. */
export async function statusForCustomer(token: string, rideId: string) {
  const me = await customerFor(token);
  const own = await db.from("rides").select("id").eq("id", rideId).eq("customer_id", me.id).maybeSingle();
  if (!own.data) throw new Error("Ride not found");
  await tickSearch(rideId);
  const { data: r } = await db.from("rides").select("*, driver:drivers!rides_driver_id_fkey(*)").eq("id", rideId).single();
  let driver: Driver | null = null;
  if (r.driver) {
    const { data: done } = await db.from("rides").select("driver_id, status, fare, discount").eq("driver_id", r.driver.id).eq("status", "Completed");
    driver = toDriver(r.driver, done ?? []);
  }
  return { status: r.status as string, driver, cancelReason: (r.cancel_reason as string | null) ?? null, paid: !!r.paid, waitFee: +r.wait_fee };
}

/** The customer's live ride, if any — lets the app pick up where it left off after a reload. */
export async function currentForCustomer(token: string) {
  const me = await customerFor(token);
  const { data: searching } = await db.from("rides").select("id").eq("customer_id", me.id).eq("status", "Searching");
  for (const r of searching ?? []) await tickSearch(r.id);
  const { data: r } = await db.from("rides").select("*, weight:parcel_weights(label)")
    .eq("customer_id", me.id).in("status", ["Searching", ...ACTIVE]).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!r) return null;
  const live = await statusForCustomer(token, r.id);
  return {
    id: r.id as string, status: live.status, driver: live.driver, service: r.service as Service, vehicle: r.vehicle as VehicleKind,
    ac: (r.ac as boolean | null) ?? true, from: r.from_address as string, to: r.to_address as string, km: +r.km, min: r.min as number,
    fare: +r.fare, discount: +r.discount, couponCode: (r.coupon_code as string | null) ?? null, pay: r.pay as PayMethod, otp: r.otp as string,
    parcel: r.service === "parcel" ? {
      type: r.parcel_type, weight: (r.weight as { label: string } | null)?.label ?? "", receiver: r.parcel_receiver ?? "",
      receiverPhone: r.parcel_receiver_phone ?? "", note: r.parcel_note ?? undefined,
    } as ParcelInfo : undefined,
  };
}

export async function cancelForCustomer(token: string, rideId: string, reason: string) {
  const me = await customerFor(token);
  const { data } = await db.from("rides").update({ status: "Cancelled", cancel_reason: String(reason).slice(0, 120), offered_to: null })
    .eq("id", rideId).eq("customer_id", me.id).in("status", ["Searching", ...ACTIVE]).select("id");
  if (!data?.length) throw new Error("This ride can't be cancelled any more");
}

const txnId = (prefix: string) => `${prefix}${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 36 ** 2).toString(36).toUpperCase()}`;

/** Online payment after the trip (simulated gateway): marks the ride paid and records the fare. */
export async function payForCustomer(token: string, rideId: string) {
  const me = await customerFor(token);
  const { data: r } = await db.from("rides").update({ paid: true })
    .eq("id", rideId).eq("customer_id", me.id).eq("status", "Completed").neq("pay", "Cash").eq("paid", false)
    .select("id, fare, discount, wait_fee, pay").maybeSingle();
  if (r) await record("transactions", { id: txnId("TX"), kind: "Ride Fare", who: me.name, amount: +r.fare - +r.discount + +r.wait_fee, method: r.pay, ride_id: r.id });
}

export async function rateForCustomer(token: string, rideId: string, stars: number, tags: string[]) {
  const me = await customerFor(token);
  const n = Math.round(Number(stars));
  if (!(n >= 1 && n <= 5)) return;
  const { data: r } = await db.from("rides").update({ rating: n })
    .eq("id", rideId).eq("customer_id", me.id).eq("status", "Completed").is("rating", null).select("id, driver_id").maybeSingle();
  if (r?.driver_id) {
    await db.from("feedback").insert({ ride_id: r.id, driver_id: r.driver_id, customer_id: me.id, stars: n, text: (tags ?? []).map(String).join(" · ").slice(0, 200) });
  }
}

/* ───────── Rider side ───────── */

/** A ride shaped for the rider app's request card and trip screen. */
async function forRider(r: Record<string, unknown> & { id: string }) {
  const { data: c } = await db.from("customers").select("name, rating").eq("id", r.customer_id as string).single();
  const { data: w } = r.parcel_weight ? await db.from("parcel_weights").select("label").eq("id", r.parcel_weight as string).single() : { data: null };
  const seed = [...r.id].reduce((s, ch) => s + ch.charCodeAt(0), 0);
  const name = (c?.name as string) ?? "Customer";
  return {
    id: r.id, status: r.status as string, customer: name, initials: initials(name), rating: +(c?.rating ?? 5),
    from: r.from_address as string, to: r.to_address as string,
    pickupKm: Math.round((0.6 + (seed % 20) / 10) * 10) / 10, pickupMin: 2 + (seed % 5),  // no live GPS yet
    km: +(r.km as number), min: r.min as number, fare: +(r.fare as number) - +(r.discount as number), pay: r.pay as PayMethod,
    waitFee: +(r.wait_fee as number) || undefined, service: r.service as Service, ac: (r.ac as boolean | null) ?? undefined,
    parcel: r.service === "parcel" ? {
      type: r.parcel_type as ParcelInfo["type"], weight: (w?.label as string) ?? "", receiver: (r.parcel_receiver as string) ?? "",
      receiverPhone: (r.parcel_receiver_phone as string) ?? "", note: (r.parcel_note as string) ?? undefined,
    } : undefined,
  };
}

/** The rider app polls this: its current trip, or a request waiting for an answer.
 * `watching` is the trip the app is showing, so it can learn the customer cancelled it. */
export async function pollForRider(token: string, watching?: string) {
  const me = await riderFor(token);
  if (watching) {
    const { data: w } = await db.from("rides").select("id, status, cancel_reason, driver_id").eq("id", watching).maybeSingle();
    if (w && w.driver_id === me.id && w.status === "Cancelled") return { cancelled: { id: w.id, reason: (w.cancel_reason as string) ?? "Cancelled" } };
  }
  const { data: active } = await db.from("rides").select("*").eq("driver_id", me.id).in("status", ACTIVE as unknown as string[]).limit(1).maybeSingle();
  if (active) return { active: await forRider(active) };
  const { data: offer } = await db.from("rides").select("*").eq("offered_to", me.id).eq("status", "Searching")
    .gt("offer_expires_at", new Date().toISOString()).order("created_at").limit(1).maybeSingle();
  if (offer) return { offer: await forRider(offer) };
  return {};
}

export async function acceptForRider(token: string, rideId: string) {
  const me = await riderFor(token);
  const { data, error } = await db.from("rides").update({ driver_id: me.id, status: "Arriving", offered_to: null, offer_expires_at: null })
    .eq("id", rideId).eq("status", "Searching").eq("offered_to", me.id).gt("offer_expires_at", new Date().toISOString()).select("*").maybeSingle();
  if (isUnique(error)) throw new Error("Finish your current trip before accepting another");
  if (!data) throw new Error("This request is no longer available");
  return forRider(data);
}

export async function declineForRider(token: string, rideId: string) {
  const me = await riderFor(token);
  const { data: r } = await db.from("rides").select("declined_by").eq("id", rideId).eq("offered_to", me.id).eq("status", "Searching").maybeSingle();
  if (!r) return;
  await db.from("rides").update({ offered_to: null, offer_expires_at: null, declined_by: [...(r.declined_by ?? []), me.id] }).eq("id", rideId).eq("offered_to", me.id);
  await offerNext(rideId);
}

const NEXT: Record<string, string> = { Arriving: "Arrived", Arrived: "Started", Started: "Completed" };

/** Rider moves their trip on: Arrived at pickup → Started (customer's OTP) → Completed. */
/** Returns the waiting fee the server charged (when starting the trip). The rider's own fee figure is ignored. */
export async function advanceForRider(token: string, rideId: string, to: "Arrived" | "Started" | "Completed", opts: { otp?: string; waitFee?: number } = {}): Promise<{ waitFee: number }> {
  const me = await riderFor(token);
  const { data: r } = await db.from("rides").select("*").eq("id", rideId).eq("driver_id", me.id).single();
  if (!r) throw new Error("Trip not found");
  if (r.status === "Cancelled") throw new Error("The customer cancelled this trip");
  if (r.status === to) return { waitFee: +r.wait_fee }; // a retry of a step that already happened: nothing more to do
  if (NEXT[r.status] !== to) throw new Error(`Can't go from ${r.status} to ${to}`);
  const patch: Record<string, unknown> = { status: to };
  if (to === "Arrived") patch.arrived_at = new Date().toISOString();
  if (to === "Started") {
    if (r.otp_attempts >= OTP_MAX_ATTEMPTS) throw new Error("Too many wrong OTP attempts — this trip's OTP is locked. Contact rider support.");
    if (String(opts.otp) !== r.otp) {
      await db.from("rides").update({ otp_attempts: r.otp_attempts + 1 }).eq("id", rideId).eq("otp_attempts", r.otp_attempts);
      const left = OTP_MAX_ATTEMPTS - r.otp_attempts - 1;
      throw new Error(left > 0
        ? `Wrong OTP — ask the customer for the 4-digit code on their screen (${left} ${left === 1 ? "try" : "tries"} left)`
        : "Too many wrong OTP attempts — this trip's OTP is locked. Contact rider support.");
    }
    const waited = r.arrived_at ? (Date.now() - new Date(r.arrived_at).getTime()) / 1000 : 0;
    patch.wait_fee = Math.max(0, Math.ceil((waited - FREE_WAIT_SEC) / 60)) * WAIT_FEE_PER_MIN;
  }
  const { data: moved, error } = await db.from("rides").update(patch).eq("id", rideId).eq("status", r.status).select("id");
  if (error) throw new Error(error.message);
  if (!moved?.length) {
    // Lost a race with another request for the same trip; succeed only if it reached the same step.
    const { data: now } = await db.from("rides").select("status").eq("id", rideId).single();
    if (now?.status === to) return { waitFee: +r.wait_fee };
    throw new Error(now?.status === "Cancelled" ? "The customer cancelled this trip" : "This trip was updated elsewhere — please refresh");
  }
  if (to === "Completed") await settle(me, { ...r, ...patch });
  return { waitFee: +((patch.wait_fee as number | undefined) ?? r.wait_fee) };
}

/** On completion: the rider's wallet entry and the platform commission record. */
async function settle(me: { id: string; name: string }, r: Record<string, unknown>) {
  const { settings } = await getCatalog();
  const total = +(r.fare as number) - +(r.discount as number) + +(r.wait_fee as number || 0);
  const rate = settings.commissionPct / 100 || 1 - DRIVER_SHARE;
  const cut = Math.round(total * rate);
  const cash = r.pay === "Cash";
  await record("wallet_txns", {
    id: txnId("WT"), driver_id: me.id, ride_id: r.id, kind: cash ? "Cash Commission" : "Trip Earning",
    note: cash ? `Ride ${r.id} · ${Math.round(rate * 100)}% of ₹${total}` : `Ride ${r.id} · ${r.pay}`, amount: cash ? -cut : total - cut,
  });
  await record("transactions", { id: txnId("TX"), kind: "Commission", who: me.name, amount: -cut, method: r.pay as string, ride_id: r.id as string });
  if (r.coupon_code) {
    const { data: c } = await db.from("coupons").select("uses").eq("code", r.coupon_code as string).maybeSingle();
    if (c) await db.from("coupons").update({ uses: (c.uses ?? 0) + 1 }).eq("code", r.coupon_code as string);
  }
}

/** Inserts a money record; a second record of the same kind for the same ride is refused by the database
 * (migration 0007) and treated as already done. */
async function record(table: "wallet_txns" | "transactions", row: Record<string, unknown>) {
  const { error } = await db.from(table).insert(row);
  if (error && !isUnique(error)) throw new Error(error.message);
}

/** Cash trips: the rider confirms they collected the fare. */
export async function collectedForRider(token: string, rideId: string) {
  const me = await riderFor(token);
  const { data: r } = await db.from("rides").update({ paid: true })
    .eq("id", rideId).eq("driver_id", me.id).eq("status", "Completed").eq("pay", "Cash").eq("paid", false)
    .select("id, fare, discount, wait_fee, customer:customers(name)").maybeSingle();
  if (r) {
    const who = (r.customer as unknown as { name: string } | null)?.name ?? "Customer";
    await record("transactions", { id: txnId("TX"), kind: "Ride Fare", who, amount: +r.fare - +r.discount + +r.wait_fee, method: "Cash", ride_id: r.id });
  }
}

/** Before pickup the ride goes back to searching (this rider excluded); once the trip has started it is cancelled. */
export async function cancelForRider(token: string, rideId: string, reason: string) {
  const me = await riderFor(token);
  const { data: r } = await db.from("rides").select("status, declined_by").eq("id", rideId).eq("driver_id", me.id).maybeSingle();
  if (!r || !(ACTIVE as readonly string[]).includes(r.status)) throw new Error("This trip can't be cancelled any more");
  if (r.status === "Started") {
    const { data } = await db.from("rides").update({ status: "Cancelled", cancel_reason: `Cancelled by rider: ${String(reason).slice(0, 100)}` })
      .eq("id", rideId).eq("status", "Started").select("id");
    if (!data?.length) throw new Error("This trip can't be cancelled any more");
    return;
  }
  const { data } = await db.from("rides").update({
    status: "Searching", driver_id: null, offered_to: null, offer_expires_at: null, arrived_at: null, otp_attempts: 0,
    declined_by: [...(r.declined_by ?? []), me.id], search_started_at: new Date().toISOString(),
  }).eq("id", rideId).eq("driver_id", me.id).eq("status", r.status).select("id");
  if (!data?.length) throw new Error("This trip can't be cancelled any more");
  await offerNext(rideId);
}

/* ───────── Admin side ───────── */

/** Admin closes a live ride (e.g. a stuck trip). Caller must be an admin — see app/admin/actions.ts. */
export async function adminCancelRide(rideId: string, reason: string) {
  const { data } = await db.from("rides").update({ status: "Cancelled", cancel_reason: `Closed by DriveWay: ${String(reason).slice(0, 100)}`, offered_to: null })
    .eq("id", rideId).in("status", ["Searching", ...ACTIVE]).select("id");
  if (!data?.length) throw new Error("This ride isn't live any more");
}

/** On suspension: the rider's live trips are closed and their pending offers withdrawn, so no customer is left stuck. */
export async function releaseRider(driverId: string) {
  await db.from("rides").update({ status: "Cancelled", cancel_reason: "Closed by DriveWay: rider unavailable — please book again" })
    .eq("driver_id", driverId).in("status", ACTIVE as unknown as string[]);
  await db.from("rides").update({ offered_to: null, offer_expires_at: null }).eq("offered_to", driverId).eq("status", "Searching");
  await db.from("drivers").update({ online: false }).eq("id", driverId);
}

/* ───────── Histories (B13: names come from the server, not from reading each other's profiles) ───────── */

export async function historyForCustomer(token: string) {
  const me = await customerFor(token);
  const { data, error } = await db.from("rides").select(RIDE_SELECT).eq("customer_id", me.id).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(toRide);
}

export async function activityForRider(token: string) {
  const me = await riderFor(token);
  const [trips, wallet, feedback] = await Promise.all([
    db.from("rides").select(RIDE_SELECT).eq("driver_id", me.id).order("created_at", { ascending: false }),
    db.from("wallet_txns").select("*").eq("driver_id", me.id).order("created_at", { ascending: false }),
    db.from("feedback").select("*, customer:customers(name)").eq("driver_id", me.id).order("created_at", { ascending: false }),
  ]);
  const err = trips.error ?? wallet.error ?? feedback.error;
  if (err) throw new Error(err.message);
  return { trips: (trips.data ?? []).map(toRide), wallet: (wallet.data ?? []).map(toWalletTxn), feedback: (feedback.data ?? []).map(toFeedback) };
}
