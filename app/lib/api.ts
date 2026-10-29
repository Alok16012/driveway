"use client";

/* Typed client for the DriveWay backend (Supabase Auth + Postgres functions in
 * supabase/migrations). The browser never computes prices or changes ride state itself:
 * every action is a server function that checks who is calling and what is allowed. */

import type { RealtimeChannel, Session } from "@supabase/supabase-js";
import { supabase } from "./supabase/client";
import { NATIVE_APP } from "./native";
import { tidyAddress } from "./location";
import type { PayMethod, RideStatus, VehicleKind } from "./data";

/* ───────────── Types returned by the server ───────────── */

/** `lat`/`lng` are set when the place isn't a fixed one: a GPS "Current location" pickup, or a place searched on Google Maps. */
export interface PlaceRef { id: string; name: string; address: string; lat?: number; lng?: number }
/** What to call a place on screen. A GPS pickup comes back from the server as "Pickup point"; its street reads better. */
export const placeName = (p: PlaceRef) => tidyAddress(p.name === "Pickup point" && p.address ? p.address.split(",")[0].trim() : p.name);
/** Name and address on one line, without saying the street twice. */
export const placeLine = (p: PlaceRef) => {
  const n = placeName(p); const a = p.address ? tidyAddress(p.address) : "";
  return !a ? n : a.startsWith(n) ? a : `${n}, ${a}`;
};
export interface Place extends PlaceRef { kind: "home" | "work" | "recent" | "current" | null }
export interface FareLine { label: string; amount: number }
export interface CouponResult { ok: boolean; reason?: string; discount?: number; code?: string; title?: string }

export interface QuoteOption {
  id: VehicleKind; name: string; tagline: string; seats: number; ac: boolean; eta: number; cancel_fee: number;
  fare: number; alt_fare: number; lines: FareLine[]; available: number; discount: number; coupon: CouponResult | null;
  booking_fee: number;   // customer booking charge on this option (0 when the fare is ₹50 or less)
}
export interface RentalQuote { pkg: string; hours: number; km: number; extra_km: number; extra_hour: number; car: VehicleKind; fare: number; discount: number; coupon: CouponResult | null; booking_fee: number; available: number }
export interface ParcelQuote { id: "light" | "medium" | "heavy"; label: string; sub: string; vehicle: VehicleKind; fee: number; fare: number; discount: number; coupon: CouponResult | null; booking_fee: number; available: number }
export interface Quote { km: number; mins: number; road?: boolean; roadInput?: RoadInfo | null; options: QuoteOption[]; any: QuoteOption | null; any_available: number; rentals: RentalQuote[]; parcels: ParcelQuote[]; booking_fee: number; booking_fee_above: number }

export type PaymentStatus = "unpaid" | "pending" | "paid" | "refunded" | "partially_refunded";
export interface RideView {
  id: string; code: string; status: RideStatus; service: "ride" | "any" | "rental" | "parcel";
  vehicle: VehicleKind; requested: VehicleKind[]; ac: boolean; from: PlaceRef; to: PlaceRef; km: number; mins: number;
  fare: number; discount: number; coupon: string | null; wait_fee: number; add_on: number; cancel_fee: number; booking_fee: number; total: number;
  pay: PayMethod; payment_status: PaymentStatus; refunded: number; scheduled_for: string | null;
  passenger: { name: string; phone: string } | null;
  parcel: { type: string; weight: string; weight_label: string; receiver: { name: string; phone: string }; note: string; sender: { name: string; phone: string } } | null;
  rental: { pkg: string; hours: number; km: number; extra_km: number; extra_hour: number } | null;
  cancel_reason: string | null; cancelled_by: string | null; rating: number | null;
  created_at: string; assigned_at: string | null; arrived_at: string | null; started_at: string | null; completed_at: string | null;
  search_timeout_sec: number; free_wait_sec: number; wait_fee_per_min: number; platform_fee: number; cancel_fee_now: number;
  otp?: string | null;
  driver: { name: string; vehicle: VehicleKind; model: string; plate: string; rating: number | null; trips: number; phone: string | null } | null;
  customer: { name: string; rating: number | null; phone: string | null } | null;
  earn?: number;   // driver offers only
}

export interface Profile {
  id: string; name: string; email: string | null; phone: string | null; rating: number | null; blocked: boolean;
  is_admin: boolean; is_driver: boolean; completed: number; wallet: number;
}
export interface Txn { id: number; kind: string; amount: number; note: string | null; at: string }
export interface Incentive { id: string; title: string; body: string; kind: "today" | "peak" | "week"; target: number; reward: number; progress: number }
export interface DriverMe {
  id: string; name: string; vehicle: VehicleKind; model: string; plate: string; ac: boolean; city: string;
  kyc: "Pending" | "Approved" | "Rejected"; kyc_note: string | null; upi: string | null; suspended: boolean; online: boolean;
  rating: number | null; trips: number; offers_accepted: number; offers_declined: number; cancellations: number;
  phone: string | null; balance: number; platform_fee: number; platform_fee_non_ac: number; needs_recharge: boolean;
  free_wait_sec: number; wait_fee_per_min: number;
  min_payout: number; payout_fee: number; today: { trips: number; earnings: number }; week_trips: number;
  earnings: { week: number; month: number; incentives_week: number }; incentives: Incentive[]; txns: Txn[];
}
export interface CouponRow {
  code: string; title: string; body: string; off: number; pct: boolean; max_off: number | null; min_fare: number;
  expires_at: string; active: boolean; uses: number; total_limit: number | null; per_user_limit: number;
}

/* ───────────── Plumbing ───────────── */

/** Turn a Postgres/Supabase error into one sentence a user can act on. */
export function friendly(e: unknown): string {
  const m = (e as { message?: string })?.message ?? String(e);
  if (/Failed to fetch|NetworkError|network/i.test(m)) return "No connection — check your internet and try again.";
  if (/JWT|not signed in|session/i.test(m)) return "Your session has expired. Please sign in again.";
  if (/check constraint|violates/i.test(m)) return "That value isn't allowed.";
  if (/phone provider|sms provider/i.test(m)) return "SMS sign-in isn't switched on yet — please try again later.";
  if (/rate limit|too many/i.test(m)) return "Too many attempts. Please wait a minute and try again.";
  if (/could not find the function|schema cache|relation .* does not exist/i.test(m)) return "DriveWay is being set up — please try again shortly.";
  return m.replace(/^coupon: /, "").replace(/^(ERROR:\s*)/, "").replace(/^./, (c) => c.toUpperCase());
}

export async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase().rpc(fn, args);
  if (error) throw new Error(friendly(error));
  return data as T;
}

/** A random key so a retried request (double tap, lost response) is applied once. */
export const newKey = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`.slice(0, 40));

/* ───────────── Auth (email + password for everyone) ───────────── */

export const isIndianMobile = (p: string) => /^[6-9]\d{9}$/.test(p);
/** "919000000001" → "+91 90000 00001" (stored numbers carry the country code without "+"). */
export const fmtPhone = (p: string | null | undefined) => {
  if (!p) return "";
  const d = p.replace(/\D/g, "");
  return d.length === 12 && d.startsWith("91") ? `+91 ${d.slice(2, 7)} ${d.slice(7)}` : `+${d}`;
};

/** Does the email's domain exist and accept mail? Looked up over DNS-over-HTTPS (only the domain is sent),
 * because the native apps are static exports with no server of their own. A domain with MX records — or,
 * failing that, an A record, which mail falls back to — counts; a nonexistent domain or a "null MX" doesn't.
 * Fails open: if the lookup itself can't be made, sign-up goes ahead and the confirmation email is the check. */
export async function emailDomainExists(email: string): Promise<boolean> {
  const domain = email.trim().split("@").pop()!.toLowerCase();
  const lookup = async (type: "MX" | "A") => {
    const r = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=${type}`,
      { headers: { accept: "application/dns-json" }, signal: AbortSignal.timeout(5000) });
    if (!r.ok) throw new Error(`DNS lookup failed (${r.status})`);
    return (await r.json()) as { Status: number; Answer?: { type: number; data: string }[] };
  };
  try {
    const mx = await lookup("MX");
    if (mx.Status === 3) return false; // NXDOMAIN — no such domain
    const hosts = (mx.Answer ?? []).filter((a) => a.type === 15);
    if (hosts.length) return !hosts.every((a) => /^0\s+\.?$/.test(a.data.trim())); // "0 ." = domain accepts no mail
    return (await lookup("A")).Answer?.some((a) => a.type === 1) ?? false;
  } catch { return true; }
}

/** Customer and rider sign-in. */
export async function emailSignIn(email: string, password: string) {
  const { error } = await supabase().auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw new Error(/invalid login credentials/i.test(error.message) ? "Wrong email or password."
    : /email not confirmed/i.test(error.message) ? "Confirm your email first — check your inbox for the link." : friendly(error));
}
/** Customer and rider sign-up. Name and mobile ride along as user metadata; handle_new_user copies them into the profile.
 *  Returns false when the project requires email confirmation (no session yet). */
export async function emailSignUp(p: { name: string; email: string; phone: string; password: string }): Promise<boolean> {
  if (!isIndianMobile(p.phone)) throw new Error("Enter a valid 10-digit Indian mobile number.");
  const { data, error } = await supabase().auth.signUp({
    email: p.email.trim(), password: p.password,
    options: { data: { name: p.name.trim(), phone: `91${p.phone}` } },
  });
  if (error) throw new Error(/already registered|already exists/i.test(error.message) ? "An account with this email already exists — log in instead." : friendly(error));
  return !!data.session;
}
export async function adminSignIn(email: string, password: string) {
  const { error } = await supabase().auth.signInWithPassword({ email, password });
  if (error) throw new Error("Wrong email or password.");
  const me = await myProfile();
  if (!me?.is_admin) { await signOut(); throw new Error("This account doesn't have admin access."); }
  return me;
}
export const signOut = async () => { await supabase().auth.signOut(); };
export async function getSession(): Promise<Session | null> {
  const { data } = await supabase().auth.getSession();
  return data.session;
}
export function onAuthChange(cb: (signedIn: boolean) => void) {
  const { data } = supabase().auth.onAuthStateChange((_e, s) => cb(!!s));
  return () => data.subscription.unsubscribe();
}

/* Password reset. The emailed link comes back to the app it was asked from (/, /rider or /admin) with
 * `#…type=recovery` (or `#error=…` once expired); read the hash at load, before Supabase consumes it. */
const landingHash = typeof window === "undefined" ? "" : window.location.hash;
export const isRecoveryLink = () => /[#&]type=recovery\b/.test(landingHash);
export function recoveryLinkError(): string | null {
  if (!/[#&]error=/.test(landingHash)) return null;
  return /otp_expired/.test(landingHash) ? "That reset link has expired or was already used — ask for a new one." : "That reset link didn't work — ask for a new one.";
}
/** Emails a reset link. The native apps leave the redirect to the project's Site URL (the web app). */
export async function sendPasswordReset(email: string) {
  const app = ["/rider", "/admin"].find((p) => window.location.pathname.startsWith(p)) ?? "/";
  const redirectTo = NATIVE_APP ? undefined : `${window.location.origin}${app}`;
  const { error } = await supabase().auth.resetPasswordForEmail(email.trim(), { redirectTo });
  if (error) throw new Error(/rate limit|security purposes/i.test(error.message) ? "Too many requests — wait a minute and try again." : friendly(error));
}
/** Changes the signed-in user's password after checking their current one (signing in again with it). */
export async function changePassword(current: string, next: string) {
  const email = (await getSession())?.user.email;
  if (!email) throw new Error("Your session has ended — log in again.");
  const { error } = await supabase().auth.signInWithPassword({ email, password: current });
  if (error) throw new Error(/invalid login credentials/i.test(error.message) ? "Current password is wrong." : friendly(error));
  await updatePassword(next);
}
/** Sets a new password for the signed-in (recovery) session. */
export async function updatePassword(password: string) {
  const { error } = await supabase().auth.updateUser({ password });
  if (error) throw new Error(/different from the old/i.test(error.message) ? "Choose a password different from your old one." : friendly(error));
}

/* ───────────── Reference data ───────────── */

export async function places(): Promise<Place[]> {
  const { data, error } = await supabase().from("places").select("id,name,address,kind").neq("id", "pin").order("kind", { nullsFirst: false });
  if (error) throw new Error(friendly(error));
  return data as Place[];
}
/** A city DriveWay runs in, set up by the admin. Users only ever get the enabled ones (RLS). */
export interface City { id: number; name: string; state: string; lat: number; lng: number; radius_km: number; enabled: boolean }
export async function serviceCities(): Promise<City[]> {
  const { data, error } = await supabase().from("cities").select("*").eq("enabled", true).order("name");
  if (error) throw new Error(friendly(error));
  return data as City[];
}
/** Offers this customer can still use: live, not used up by them, and not first-ride-only once they've ridden. */
export async function activeCoupons(): Promise<CouponRow[]> {
  const { data, error } = await supabase().rpc("my_offers");
  if (error) throw new Error(friendly(error));
  return (data ?? []) as CouponRow[];
}

/* ───────────── Customer ───────────── */

export const myProfile = () => rpc<Profile | null>("my_profile");
export const updateMyProfile = (name: string, email: string) => rpc<void>("update_my_profile", { p_name: name, p_email: email });
/** 10-digit Indian mobile; stored as 91XXXXXXXXXX like sign-up. */
export const updateMyPhone = (phone: string) => rpc<void>("update_my_phone", { p_phone: phone });
export const updateMyDriverProfile = (name: string, city: string) => rpc<void>("update_my_driver_profile", { p_name: name, p_city: city });
/** Positions go with the stand-in ids: `fromPos` with "cur" (GPS or searched pickup), `toPos` with "pin" (searched drop). */
/** Road distance and drive time from a routing service; the server checks it against the straight line. */
export interface RoadInfo { km: number; mins: number }
export const quote = (from: string, to: string, ac: boolean, coupon: string | null, fromPos?: { lat: number; lng: number } | null, toPos?: { lat: number; lng: number } | null, road?: RoadInfo | null) =>
  rpc<Quote>("quote", { p_from: from, p_to: to, p_ac: ac, p_coupon: coupon, p_from_pos: fromPos ?? null, p_to_pos: toPos ?? null, p_road: road ?? null });

export interface BookRequest {
  option: string; from: string; to: string; ac: boolean; pay: PayMethod; coupon: string | null; when: string | null;
  passenger?: { name: string; phone: string } | null;
  parcel?: { type: string; weight: string; receiver: { name: string; phone: string }; note: string };
  rental?: { pkg: string; car: VehicleKind };
  add_on?: number;                                      // ₹10 / ₹20 / ₹30 on top of the fare
  pickup?: { lat: number; lng: number; name?: string; address: string | null };   // with `from` "cur": GPS fix or searched place
  drop?: { lat: number; lng: number; name: string; address: string };            // with `to` "pin": searched place
  road?: RoadInfo | null;                               // the route the quote was priced on
  idem: string;
}
export const bookRide = (p: BookRequest) => rpc<{ id: string; code: string; status: RideStatus; duplicate: boolean }>("book_ride", { p });
export const myActiveRide = () => rpc<RideView | null>("my_active_ride");
export const myRides = () => rpc<RideView[]>("my_rides");
export const cancelRide = (id: string, reason: string) => rpc<RideView>("cancel_ride", { p_ride: id, p_reason: reason });
export const payRide = (id: string, method: Exclude<PayMethod, "Cash">) => rpc<RideView>("pay_ride", { p_ride: id, p_method: method });
export const rateRide = (id: string, stars: number, tags: string[]) => rpc<void>("rate_ride", { p_ride: id, p_stars: stars, p_tags: tags });
export const closeRide = (id: string) => rpc<void>("close_ride", { p_ride: id });
/** Customer ends a started trip themselves (cash trips are recorded as paid). */
export const customerEndRide = (id: string) => rpc<RideView>("customer_end_ride", { p_ride: id });
export const myWallet = () => rpc<{ balance: number; txns: Txn[] }>("my_wallet");
export const supportMessage = (body: string, role: "Customer" | "Driver", ride: string | null = null) =>
  rpc<{ id: string; code: string; status: string }>("support_message", { p_body: body, p_role: role, p_ride: ride });

/* ───────────── Driver ───────────── */

export interface DriverApplication {
  name: string; city: string; vehicle: VehicleKind; model: string; plate: string; ac: boolean;
  docs: Record<"photo" | "licence" | "rc" | "insurance" | "aadhaar", string>;   // storage paths in the driver-docs bucket
  upi: string;
  referral_code?: string;                                 // another rider's "Refer & Earn" code, optional
}
/** The signed-in rider's referral code, the current offer (set by the admin) and how their referrals are doing. */
export interface MyReferral {
  code: string; on: boolean; referrer_bonus: number; new_bonus: number; rides: number; earned: number;
  referred: { name: string; kyc: string; done: number; paid: boolean; joined: string }[];
}
export const myReferral = () => rpc<MyReferral>("my_referral");
export const registerDriver = (p: DriverApplication) => rpc<unknown>("register_driver", { p });
export const myDriver = () => rpc<DriverMe | null>("my_driver");
export const setOnline = (online: boolean) => rpc<{ online: boolean }>("set_online", { p_online: online });
export const driverOffers = () => rpc<RideView[]>("driver_offers");
export const acceptRide = (id: string) => rpc<RideView>("accept_ride", { p_ride: id });
export const declineRide = (id: string) => rpc<void>("decline_ride", { p_ride: id });
export const myTrip = () => rpc<RideView | null>("my_trip");
export const driverArrived = (id: string) => rpc<RideView>("driver_arrived", { p_ride: id });
export const startRide = (id: string, otp: string) => rpc<RideView & { error?: "wrong_otp"; attempts_left?: number }>("start_ride", { p_ride: id, p_otp: otp });
export const completeRide = (id: string) => rpc<RideView>("complete_ride", { p_ride: id });
export const confirmCash = (id: string) => rpc<RideView>("confirm_cash", { p_ride: id });
export const rateCustomer = (id: string, stars: number) => rpc<void>("rate_customer", { p_ride: id, p_stars: stars });
export const driverCloseRide = (id: string) => rpc<void>("driver_close_ride", { p_ride: id });
export const driverCancelRide = (id: string, reason: string) => rpc<void>("driver_cancel_ride", { p_ride: id, p_reason: reason });
export const myDriverTrips = () => rpc<RideView[]>("my_driver_trips");
export const requestPayout = (idem: string) => rpc<{ paid_out?: number; fee?: number; duplicate?: boolean }>("request_payout", { p_idem: idem });
export const payDues = (idem: string) => rpc<{ cleared: number }>("pay_dues", { p_idem: idem });
export const rechargeWallet = (amount: number, idem: string) => rpc<{ balance: number }>("recharge_wallet", { p_amount: amount, p_idem: idem });
export const confirmDirectPayment = (id: string) => rpc<RideView>("confirm_direct_payment", { p_ride: id });
export const updateMyUpi = (upi: string) => rpc<void>("update_my_upi", { p_upi: upi });

/* ───────────── Live updates ───────────── */

/** Calls `onChange` whenever a ride row visible to this user changes (RLS applies). */
export function watchRides(onChange: () => void): () => void {
  const ch: RealtimeChannel = supabase().channel(`rides-${newKey()}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "rides" }, () => onChange())
    .subscribe();
  return () => { void supabase().removeChannel(ch); };
}

/* Live driver position (supabase/migrations/…_driver_live_location.sql). */
export interface DriverPos { lat: number; lng: number; heading: number | null; at: string }

/** Driver app: report this phone's position. Ignored by the server unless the driver has a live trip. */
export const reportLocation = (p: { lat: number; lng: number; heading?: number | null; accuracy?: number | null }) =>
  rpc<void>("report_location", { p_lat: p.lat, p_lng: p.lng, p_heading: p.heading ?? null, p_accuracy: p.accuracy ?? null });

/** Customer app: the driver's last reported position on a live ride, then every update after it. */
export function watchDriverPosition(rideId: string, onPos: (p: DriverPos) => void): () => void {
  let dead = false;
  void supabase().from("ride_tracks").select("lat,lng,heading,at").eq("ride_id", rideId).maybeSingle()
    .then(({ data }) => { if (!dead && data) onPos(data as DriverPos); });
  const ch: RealtimeChannel = supabase().channel(`track-${rideId}-${newKey()}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "ride_tracks", filter: `ride_id=eq.${rideId}` }, (e) => {
      const n = e.new as Partial<DriverPos> | undefined;
      if (!dead && n && typeof n.lat === "number" && typeof n.lng === "number") onPos({ lat: n.lat, lng: n.lng, heading: n.heading ?? null, at: n.at ?? new Date().toISOString() });
    })
    .subscribe();
  return () => { dead = true; void supabase().removeChannel(ch); };
}

/** Calls `onResume` when the app comes back to the foreground. Phones pause background tabs and apps
 *  (timers and the realtime socket included), so without this a returning user sees stale state until the next poll. */
export function watchResume(onResume: () => void): () => void {
  const handler = () => { if (document.visibilityState === "visible") onResume(); };
  document.addEventListener("visibilitychange", handler);
  return () => document.removeEventListener("visibilitychange", handler);
}

/* ───────────── Formatting ───────────── */

export const fmtWhen = (iso: string) => {
  const d = new Date(iso); const now = new Date();
  const day = d.toDateString() === now.toDateString() ? "Today"
    : d.toDateString() === new Date(now.getTime() - 864e5).toDateString() ? "Yesterday"
    : d.toDateString() === new Date(now.getTime() + 864e5).toDateString() ? "Tomorrow"
    : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
  return `${day}, ${d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })}`;
};

/** "Sedan · AC", "Parcel · Bike", "Rental 2 hr · Mini", "Book Any · AC". */
export function rideLabel(r: Pick<RideView, "service" | "vehicle" | "ac" | "rental" | "assigned_at">, vehicleName: string) {
  if (r.service === "parcel") return `Parcel · ${vehicleName}`;
  if (r.service === "rental" && r.rental) return `Rental ${r.rental.hours} hr · ${vehicleName}`;
  if (r.service === "any" && !r.assigned_at) return `Book Any · ${r.ac ? "AC" : "Non-AC"}`;
  return ["bike", "auto", "erick"].includes(r.vehicle) ? vehicleName : `${vehicleName} · ${r.ac ? "AC" : "Non-AC"}`;
}
