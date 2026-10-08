/* Server-side ride lifecycle, money and permissions — runs the real migration in an isolated PGlite
 * database. Test IDs map to docs/qa-audit.md (BUG-xx) and the required journeys (J1–J15). */
import { beforeAll, describe, expect, it } from "vitest";
import { createDb, rejects, type Db } from "./harness";

let t: Db;
beforeAll(async () => { t = await createDb(); });

/** Book → accept → arrive → start → complete. Returns ids. */
async function fullTrip(opts: { vehicle?: string; pay?: string; coupon?: string; customer?: string; driver?: string; to?: string } = {}) {
  const vehicle = opts.vehicle ?? "bike";
  const c = opts.customer ?? (await t.user());
  const d = opts.driver ?? (await t.driver(vehicle, { ac: ["mini", "sedan", "taxi", "suv"].includes(vehicle) }));
  const b = await t.book(c, { option: vehicle, pay: opts.pay ?? "UPI", coupon: opts.coupon, to: opts.to ?? "dlf" });
  await t.rpc(d, "accept_ride", b.id);
  await t.rpc(d, "driver_arrived", b.id);
  await t.rpc(d, "start_ride", b.id, await t.otpOf(b.id));
  await t.rpc(d, "complete_ride", b.id);
  return { c, d, id: b.id as string };
}

describe("Permissions (BUG-01, BUG-05, M: object-level authorization)", () => {
  it("anon cannot call any API or read any table", async () => {
    await rejects(t.rpc(null, "quote", "cur", "dlf", true, null), /permission denied/);
    await rejects(t.as(null, "select * from public.rides"), /permission denied/);
    await rejects(t.as(null, "select * from public.vehicles"), /permission denied/);
  });
  it("users cannot write tables directly (mass assignment of fare, status, role, balance)", async () => {
    const u = await t.user();
    await rejects(t.as(u, "update public.profiles set is_admin = true where id = auth.uid()"), /permission denied/);
    await rejects(t.as(u, "insert into public.ledger (idem, party, kind, amount) values ('x','customer','wallet_credit',99999)"), /permission denied/);
    const b = await t.book(u, { option: "bike" });
    await rejects(t.as(u, `update public.rides set fare = 1 where id = '${b.id}'`), /permission denied/);
  });
  it("customers only see their own rides; nobody but the customer sees the OTP", async () => {
    const a = await t.user(); const b = await t.user();
    const r = await t.book(a, { option: "bike" });
    expect(await t.as(b, `select id from public.rides where id = '${r.id}'`)).toHaveLength(0);
    await rejects(t.as(a, `select otp from public.ride_otps`), /permission denied/);
    const d = await t.driver("bike");
    const offers = await t.rpc(d, "driver_offers");
    expect(offers.find((o: any) => o.id === r.id)?.otp ?? null).toBeNull();
    await t.rpc(d, "accept_ride", r.id);
    expect((await t.rpc(d, "my_trip")).otp ?? null).toBeNull();
    expect((await t.rpc(a, "my_active_ride")).otp).toMatch(/^\d{4}$/);
  });
  it("non-admins are refused by every admin function", async () => {
    const u = await t.user(); const d = await t.driver("auto", { approve: false });
    await rejects(t.rpc(u, "admin_set_kyc", d, "Approved", null), /admin only/);
    await rejects(t.rpc(u, "admin_update_vehicle", "mini", { base: 1 }), /admin only/);
    await rejects(t.rpc(u, "admin_refund", d, 10, "x", t.idem()), /admin only/);
    await rejects(t.rpc(u, "admin_update_settings", { commission_pct: 0 }), /admin only/);
  });
  it("a stranger cannot cancel, start or pay someone else's ride", async () => {
    const a = await t.user(); const x = await t.user(); const d = await t.driver("bike"); const d2 = await t.driver("bike");
    const r = await t.book(a, { option: "bike" });
    await rejects(t.rpc(x, "cancel_ride", r.id, "x"), /ride not found/);
    await t.rpc(d, "accept_ride", r.id);
    await rejects(t.rpc(d2, "driver_arrived", r.id), /cannot mark arrived/);
    await rejects(t.rpc(d2, "start_ride", r.id, "0000"), /ride not found/);
  });
});

describe("Pricing on the server (BUG-17, BUG-18, BUG-22, D)", () => {
  it("every option's breakdown lines add up to its fare", async () => {
    const u = await t.user();
    for (const ac of [true, false]) for (const to of ["dlf", "airport", "cp", "home"]) {
      const q = await t.rpc(u, "quote", "cur", to, ac, null);
      for (const o of q.options) expect(o.lines.reduce((s: number, l: any) => s + l.amount, 0)).toBe(o.fare);
    }
  });
  it("minimum fare shows as a top-up line", async () => {
    await t.admin(`update public.vehicles set min_fare = 9999 where id = 'erick'`);
    const q = await t.rpc(await t.user(), "quote", "cur", "dlf", true, null);
    const e = q.options.find((o: any) => o.id === "erick");
    expect(e.fare).toBe(9999);
    expect(e.lines.some((l: any) => /Minimum fare/.test(l.label))).toBe(true);
    await t.admin(`update public.vehicles set min_fare = 30 where id = 'erick'`);
  });
  it("pickup equal to drop is refused (quote and booking)", async () => {
    const u = await t.user();
    await rejects(t.rpc(u, "quote", "dlf", "dlf", true, null), /must be different/);
    await rejects(t.book(u, { option: "bike", from: "dlf", to: "dlf" }), /must be different/);
  });
  it("the client cannot choose the price: extra fare/discount fields are ignored", async () => {
    const u = await t.user();
    const q = await t.rpc(u, "quote", "cur", "airport", true, null);
    const b = await t.book(u, { option: "sedan", to: "airport", fare: 1, discount: 999, total: 0 });
    const r = await t.ride(b.id);
    expect(r.fare).toBe(q.options.find((o: any) => o.id === "sedan").fare);
    expect(r.discount).toBe(0);
  });
  it("admin price change applies to the next quote and negative prices are rejected", async () => {
    const adm = await t.user({ admin: true }); const u = await t.user();
    const before = (await t.rpc(u, "quote", "cur", "airport", true, null)).options.find((o: any) => o.id === "mini").fare;
    await t.rpc(adm, "admin_update_vehicle", "mini", { base: 145 });
    const after = (await t.rpc(u, "quote", "cur", "airport", true, null)).options.find((o: any) => o.id === "mini").fare;
    expect(after).toBe(before + 100);
    await rejects(t.rpc(adm, "admin_update_vehicle", "mini", { base: -100 }), /check constraint/);
    await t.rpc(adm, "admin_update_vehicle", "mini", { base: 45 });
    expect((await t.admin(`select count(*)::int n from public.audit_log where action = 'update_vehicle'`))[0].n).toBeGreaterThanOrEqual(2);
  });
  it("surge from admin settings is applied and itemised", async () => {
    const adm = await t.user({ admin: true }); const u = await t.user();
    await t.rpc(adm, "admin_update_settings", { surge_on: true, surge_mult: 1.5 });
    const q = await t.rpc(u, "quote", "cur", "airport", true, null);
    expect(q.options[0].lines.some((l: any) => /High demand/.test(l.label))).toBe(true);
    await t.rpc(adm, "admin_update_settings", { surge_on: false });
  });
});

describe("Coupons (BUG-10, BUG-13, I)", () => {
  const disc = async (u: string, code: string, vehicle: string, to = "airport") =>
    (await t.rpc(u, "quote", "cur", to, true, code)).options.find((o: any) => o.id === vehicle).coupon;
  it("AUTO20 only on Auto and only at or above the minimum fare", async () => {
    const u = await t.user();
    expect((await disc(u, "AUTO20", "mini")).reason).toMatch(/vehicle/);
    await t.admin(`update public.coupons set min_fare = 100000 where code = 'AUTO20'`);
    expect((await disc(u, "AUTO20", "auto")).reason).toMatch(/fares of/);
    await t.admin(`update public.coupons set min_fare = 81 where code = 'AUTO20'`);
  });
  it("expired, inactive and wrong-day coupons give no discount", async () => {
    const u = await t.user();
    await t.admin(`update public.coupons set expires_at = now() - interval '1 minute', starts_at = now() - interval '1 day' where code = 'AUTO20'`);
    expect((await disc(u, "AUTO20", "auto")).ok).toBe(false);
    expect((await disc(u, "AIRPORT99", "sedan")).reason).toMatch(/no longer active/);
    const today = (await t.admin(`select extract(dow from now() at time zone 'Asia/Kolkata')::int d`))[0].d;
    await t.admin(`update public.coupons set days = $1 where code = 'WEEKEND'`, [[(today + 1) % 7]]);
    expect((await disc(u, "WEEKEND", "mini")).reason).toMatch(/Not valid today/);
  });
  it("booking with an ineligible coupon is refused server-side", async () => {
    await rejects(t.book(await t.user(), { option: "mini", coupon: "AIRPORT99", to: "airport" }), /coupon:/);
  });
  it("first-ride coupon stops after the first completed ride; per-user limit enforced", async () => {
    const c = await t.user();
    const first = await fullTrip({ customer: c, coupon: "FIRST50" });
    expect((await t.ride(first.id)).discount).toBeGreaterThan(0);
    await t.rpc(c, "pay_ride", first.id, "UPI");
    expect((await disc(c, "FIRST50", "bike")).ok).toBe(false);
  });
  it("the last available use can only be redeemed once", async () => {
    await t.admin(`insert into public.coupons (code, title, off, expires_at, total_limit) values ('LAST1', 'x', 10, now() + interval '1 day', 1)`);
    const a = await t.user(); const b = await t.user();
    await t.book(a, { option: "bike", coupon: "LAST1" });
    await rejects(t.book(b, { option: "bike", coupon: "LAST1" }), /fully redeemed/);
  });
  it("cancelling releases the coupon use", async () => {
    await t.admin(`insert into public.coupons (code, title, off, expires_at, total_limit) values ('ONCE1', 'x', 10, now() + interval '1 day', 1)`);
    const a = await t.user();
    const r = await t.book(a, { option: "bike", coupon: "ONCE1" });
    await t.rpc(a, "cancel_ride", r.id, "Changed my plans");
    expect((await t.admin(`select uses from public.coupons where code = 'ONCE1'`))[0].uses).toBe(0);
    await t.book(await t.user(), { option: "bike", coupon: "ONCE1" });
  });
  it("coupons with zero/negative value or >100% cannot be created", async () => {
    const adm = await t.user({ admin: true });
    await rejects(t.rpc(adm, "admin_upsert_coupon", { code: "NEG50", off: -50, pct: true }), /check constraint/);
    await rejects(t.rpc(adm, "admin_upsert_coupon", { code: "BIG500", off: 500, pct: true }), /check constraint/);
  });
});

describe("Booking and dispatch (BUG-07, J2, J3, J5, J10, J11, E)", () => {
  it("retrying a booking with the same idempotency key returns the same ride", async () => {
    const u = await t.user(); const idem = t.idem();
    const a = await t.book(u, { option: "bike", idem }); const b = await t.book(u, { option: "bike", idem });
    expect(b.id).toBe(a.id); expect(b.duplicate).toBe(true);
  });
  it("a customer cannot hold two active bookings (J: two devices)", async () => {
    const u = await t.user();
    await t.book(u, { option: "bike" });
    await rejects(t.book(u, { option: "auto" }), /already have a ride/);
  });
  it("blocked customers cannot book", async () => {
    const adm = await t.user({ admin: true }); const u = await t.user();
    await t.rpc(adm, "admin_set_blocked", u, true);
    await rejects(t.book(u, { option: "bike" }), /blocked/);
  });
  it("J2: no eligible driver → NoDrivers after the timeout, never another category", async () => {
    await t.driver("sedan");                                  // a Sedan is online, but nobody drives a Mini
    const u = await t.user();
    const r = await t.book(u, { option: "mini" });
    const q = await t.rpc(u, "quote", "cur", "dlf", true, null);
    expect(q.options.find((o: any) => o.id === "mini").available).toBe(0);
    await t.admin(`update public.rides set searching_since = now() - interval '10 minutes' where id = $1`, [r.id]);
    expect((await t.rpc(u, "my_active_ride")).status).toBe("NoDrivers");
    expect((await t.ride(r.id)).driver_id).toBeNull();
  });
  it("pending, rejected and suspended drivers cannot go online or accept", async () => {
    const pend = await t.driver("bike", { approve: false });
    await rejects(t.rpc(pend, "set_online", true), /not approved/);
    const adm = await t.user({ admin: true });
    const d = await t.driver("bike");
    await t.rpc(adm, "admin_set_suspended", d, true);
    expect((await t.admin(`select online from public.drivers where id = $1`, [d]))[0].online).toBe(false);
    const r = await t.book(await t.user(), { option: "bike" });
    await rejects(t.rpc(d, "accept_ride", r.id), /suspended/);
  });
  it("J10: two drivers accept the same ride — exactly one wins", async () => {
    const d1 = await t.driver("auto"); const d2 = await t.driver("auto");
    const r = await t.book(await t.user(), { option: "auto" });
    await t.rpc(d1, "accept_ride", r.id);
    await rejects(t.rpc(d2, "accept_ride", r.id), /no longer available/);
    expect((await t.ride(r.id)).driver_id).toBe(d1);
  });
  it("J11: one driver cannot take a second ride while on a trip", async () => {
    const d = await t.driver("erick");
    const r1 = await t.book(await t.user(), { option: "erick" }); const r2 = await t.book(await t.user(), { option: "erick" });
    await t.rpc(d, "accept_ride", r1.id);
    await rejects(t.rpc(d, "accept_ride", r2.id), /finish your current trip/);
    expect(await t.rpc(d, "driver_offers")).toEqual([]);
  });
  it("stale accept: cancelled or expired requests cannot be accepted", async () => {
    const d = await t.driver("bike"); const u = await t.user();
    const r = await t.book(u, { option: "bike" });
    await t.rpc(u, "cancel_ride", r.id, "Changed my plans");
    await rejects(t.rpc(d, "accept_ride", r.id), /no longer available/);
    const u2 = await t.user(); const r2 = await t.book(u2, { option: "bike" });
    await t.admin(`update public.rides set searching_since = now() - interval '10 minutes' where id = $1`, [r2.id]);
    await rejects(t.rpc(d, "accept_ride", r2.id), /no longer available/);
  });
  it("J3: a declined request is hidden from that driver and taken by another", async () => {
    const d1 = await t.driver("taxi", { ac: true }); const d2 = await t.driver("taxi", { ac: true });
    const r = await t.book(await t.user(), { option: "taxi" });
    await t.rpc(d1, "decline_ride", r.id);
    expect((await t.rpc(d1, "driver_offers")).some((o: any) => o.id === r.id)).toBe(false);
    await t.rpc(d2, "accept_ride", r.id);
    expect((await t.ride(r.id)).driver_id).toBe(d2);
  });
  it("J5: driver cancels → ride returns to Searching and is reassigned; first driver can't see it again", async () => {
    const d1 = await t.driver("suv", { ac: true }); const d2 = await t.driver("suv", { ac: true }); const u = await t.user();
    const r = await t.book(u, { option: "suv" });
    await t.rpc(d1, "accept_ride", r.id);
    await t.rpc(d1, "driver_cancel_ride", r.id, "Vehicle issue");
    expect((await t.ride(r.id)).status).toBe("Searching");
    expect((await t.rpc(d1, "driver_offers")).some((o: any) => o.id === r.id)).toBe(false);
    await t.rpc(d2, "accept_ride", r.id);
    expect((await t.rpc(u, "my_active_ride")).status).toBe("Arriving");
  });
  it("AC rides only go to AC cars; Non-AC rides can go to any car", async () => {
    const nonAc = await t.driver("sedan", { ac: false });
    const r = await t.book(await t.user(), { option: "sedan", ac: true });
    await rejects(t.rpc(nonAc, "accept_ride", r.id), /no longer available/);
    const r2 = await t.book(await t.user(), { option: "sedan", ac: false });
    await t.rpc(nonAc, "accept_ride", r2.id);
  });
});

describe("OTP and trip state (BUG-03, J6, F)", () => {
  it("J6: wrong OTP is refused and counted; right OTP starts the trip; repeat start is a no-op", async () => {
    const d = await t.driver("bike"); const u = await t.user();
    const r = await t.book(u, { option: "bike" });
    await t.rpc(d, "accept_ride", r.id);
    await rejects(t.rpc(d, "start_ride", r.id, await t.otpOf(r.id)), /mark arrived/);
    await t.rpc(d, "driver_arrived", r.id);
    const otp = await t.otpOf(r.id); const wrong = otp === "0000" ? "1111" : "0000";
    const res = await t.rpc(d, "start_ride", r.id, wrong);
    expect(res.error).toBe("wrong_otp");
    expect((await t.ride(r.id)).status).toBe("Arrived");
    expect((await t.rpc(d, "start_ride", r.id, otp)).status).toBe("Started");
    expect((await t.rpc(d, "start_ride", r.id, otp)).status).toBe("Started");
  });
  it("too many wrong OTPs lock the ride start (brute force)", async () => {
    const d = await t.driver("bike"); const r = await t.book(await t.user(), { option: "bike" });
    await t.rpc(d, "accept_ride", r.id); await t.rpc(d, "driver_arrived", r.id);
    const otp = await t.otpOf(r.id); const wrong = otp === "0000" ? "1111" : "0000";
    for (let i = 0; i < 5; i++) await t.rpc(d, "start_ride", r.id, wrong);
    await rejects(t.rpc(d, "start_ride", r.id, otp), /too many wrong OTPs/);
  });
  it("a ride cannot complete before it starts", async () => {
    const d = await t.driver("bike"); const r = await t.book(await t.user(), { option: "bike" });
    await t.rpc(d, "accept_ride", r.id);
    await rejects(t.rpc(d, "complete_ride", r.id), /has not started/);
  });
  it("terminal rides can never return to an active state (DB guard)", async () => {
    const { id } = await fullTrip();
    await rejects(t.admin(`update public.rides set status = 'Started' where id = $1`, [id]), /invalid ride transition/);
    const u = await t.user(); const r = await t.book(u, { option: "bike" });
    await t.rpc(u, "cancel_ride", r.id, "x");
    await rejects(t.admin(`update public.rides set status = 'Searching' where id = $1`, [r.id]), /invalid ride transition/);
  });
  it("waiting time after the free window is charged per started minute", async () => {
    const d = await t.driver("bike"); const r = await t.book(await t.user(), { option: "bike" });
    await t.rpc(d, "accept_ride", r.id); await t.rpc(d, "driver_arrived", r.id);
    await t.admin(`update public.rides set arrived_at = now() - interval '181 seconds' where id = $1`, [r.id]);
    await t.rpc(d, "start_ride", r.id, await t.otpOf(r.id));
    expect((await t.ride(r.id)).wait_fee).toBe(2);
  });
  it("J12: an active ride is recovered after an app restart (my_active_ride)", async () => {
    const d = await t.driver("bike"); const u = await t.user(); const r = await t.book(u, { option: "bike" });
    await t.rpc(d, "accept_ride", r.id);
    const again = await t.rpc(u, "my_active_ride");
    expect(again.id).toBe(r.id); expect(again.driver.name).toBe("Test Driver");
  });
});

describe("Money: completion, payment, cash, earnings (BUG-04, BUG-06, BUG-11, BUG-20, J1, J7, J8, J9, J15)", () => {
  it("J15: completing twice creates exactly one earning and one commission", async () => {
    const { d, id } = await fullTrip({ vehicle: "auto" });
    await t.rpc(d, "complete_ride", id);
    const l = await t.ledger(id);
    expect(l.filter((x: any) => x.kind === "driver_earning")).toHaveLength(1);
    expect(l.filter((x: any) => x.kind === "commission")).toHaveLength(1);
  });
  it("driver earning ignores the customer's coupon — the platform funds discounts", async () => {
    const plain = await fullTrip({ vehicle: "bike" });
    const withCoupon = await fullTrip({ vehicle: "bike", coupon: "FIRST50" });
    const earn = async (id: string) => (await t.ledger(id)).find((x: any) => x.kind === "driver_earning").amount;
    expect(await earn(withCoupon.id)).toBe(await earn(plain.id));
    const r = await t.ride(withCoupon.id); const l = await t.ledger(withCoupon.id);
    expect(l.find((x: any) => x.kind === "discount").amount).toBe(-r.discount);
    expect(l.find((x: any) => x.kind === "driver_earning").amount + l.find((x: any) => x.kind === "commission").amount).toBe(r.fare + r.wait_fee);
  });
  it("J1/J9: paying twice records one payment (duplicate callback / double tap)", async () => {
    const { c, id } = await fullTrip();
    await t.rpc(c, "pay_ride", id, "UPI");
    await t.rpc(c, "pay_ride", id, "UPI");
    expect((await t.ledger(id)).filter((x: any) => x.kind === "payment")).toHaveLength(1);
    expect((await t.ride(id)).payment_status).toBe("paid");
  });
  it("J7: wallet payment with too little balance fails, then UPI retry succeeds", async () => {
    const { c, id } = await fullTrip({ vehicle: "sedan" });
    await rejects(t.rpc(c, "pay_ride", id, "Wallet"), /insufficient wallet balance/);
    expect((await t.ride(id)).payment_status).toBe("pending");
    await t.rpc(c, "pay_ride", id, "UPI");
    expect((await t.ride(id)).payment_status).toBe("paid");
  });
  it("J8: after a lost response the client re-reads the ride and sees it paid (no second charge)", async () => {
    const { c, id } = await fullTrip();
    await t.rpc(c, "pay_ride", id, "Card");                  // response "lost"
    expect((await t.rpc(c, "my_rides")).find((r: any) => r.id === id).payment_status).toBe("paid");
    await t.rpc(c, "pay_ride", id, "Card");
    expect((await t.ledger(id)).filter((x: any) => x.kind === "payment")).toHaveLength(1);
  });
  it("wallet spend is atomic: two rides cannot spend the same balance", async () => {
    const c = await t.user();
    const a = await fullTrip({ customer: c, vehicle: "auto", to: "cp" });
    const credit = (await t.ride(a.id)).total + 1;            // enough for one ride, not two
    await t.admin(`insert into public.ledger (idem, user_id, party, kind, amount) values ($1, $2, 'customer', 'wallet_credit', $3)`, [t.idem(), c, credit]);
    await t.rpc(c, "pay_ride", a.id, "Wallet");
    const b = await fullTrip({ customer: c, vehicle: "auto", to: "cp" });
    await rejects(t.rpc(c, "pay_ride", b.id, "Wallet"), /insufficient/);
    expect((await t.rpc(c, "my_wallet")).balance).toBe(1);
  });
  it("cash: confirming twice records the cash once; driver wallet = earning − cash", async () => {
    const { d, id } = await fullTrip({ pay: "Cash", vehicle: "taxi" });
    await t.rpc(d, "confirm_cash", id); await t.rpc(d, "confirm_cash", id);
    const l = await t.ledger(id); const r = await t.ride(id);
    expect(l.filter((x: any) => x.kind === "cash_collected")).toHaveLength(1);
    const bal = (await t.rpc(d, "my_driver")).balance;
    expect(bal).toBe(l.find((x: any) => x.kind === "driver_earning").amount - r.total);
  });
  it("daily target bonus is paid once, and progress is reported to the driver", async () => {
    const d = await t.driver("bike");
    for (let i = 0; i < 6; i++) await fullTrip({ driver: d });
    expect((await t.admin(`select count(*)::int n from public.ledger where user_id = $1 and kind = 'incentive' and note like 'Daily%'`, [d]))[0].n).toBe(1);
    const me = await t.rpc(d, "my_driver");
    expect(me.incentives.find((i: any) => i.id === "daily").progress).toBe(6);
    expect(me.today.trips).toBe(6);
  });
  it("payouts: below minimum refused, same key twice pays once", async () => {
    const d = await t.driver("bike");
    await rejects(t.rpc(d, "request_payout", t.idem()), /minimum/);
    await t.admin(`insert into public.ledger (idem, user_id, party, kind, amount) values ($1, $2, 'driver', 'driver_earning', 500)`, [t.idem(), d]);
    const k = t.idem();
    await t.rpc(d, "request_payout", k); await t.rpc(d, "request_payout", k);
    expect((await t.rpc(d, "my_driver")).balance).toBe(0);
    expect((await t.admin(`select count(*)::int n from public.ledger where user_id = $1 and kind = 'payout'`, [d]))[0].n).toBe(1);
  });
});

describe("Cancellation and refunds (BUG-09, J4, G)", () => {
  it("J4: cancel before a driver is assigned → no fee", async () => {
    const u = await t.user(); const r = await t.book(u, { option: "bike" });
    const v = await t.rpc(u, "cancel_ride", r.id, "Changed my plans");
    expect(v.status).toBe("Cancelled"); expect(v.cancel_fee).toBe(0);
  });
  it("J4: cancel after assignment → category fee charged once; driver credited once", async () => {
    const d = await t.driver("sedan", { ac: true }); const u = await t.user();
    const r = await t.book(u, { option: "sedan" });
    await t.rpc(d, "accept_ride", r.id);
    const v1 = await t.rpc(u, "cancel_ride", r.id, "Driver taking too long");
    const v2 = await t.rpc(u, "cancel_ride", r.id, "Driver taking too long");
    expect(v1.cancel_fee).toBe(40); expect(v2.cancel_fee).toBe(40);
    expect(v1.payment_status).toBe("pending");
    expect((await t.ledger(r.id)).filter((x: any) => x.kind === "cancel_fee")).toHaveLength(1);
    await t.rpc(u, "pay_ride", r.id, "UPI");
    expect((await t.ride(r.id)).payment_status).toBe("paid");
  });
  it("a started trip cannot be cancelled by the customer", async () => {
    const d = await t.driver("bike"); const u = await t.user(); const r = await t.book(u, { option: "bike" });
    await t.rpc(d, "accept_ride", r.id); await t.rpc(d, "driver_arrived", r.id); await t.rpc(d, "start_ride", r.id, await t.otpOf(r.id));
    await rejects(t.rpc(u, "cancel_ride", r.id, "x"), /can no longer be cancelled/);
  });
  it("refunds: only paid rides, never above what was paid, same key once", async () => {
    const adm = await t.user({ admin: true });
    const { c, id } = await fullTrip();
    await rejects(t.rpc(adm, "admin_refund", id, 10, "x", t.idem()), /only paid/);
    await t.rpc(c, "pay_ride", id, "UPI");
    const total = (await t.ride(id)).total;
    await rejects(t.rpc(adm, "admin_refund", id, total + 1, "x", t.idem()), /refund must be/);
    const k = t.idem();
    await t.rpc(adm, "admin_refund", id, 10, "Late driver", k); await t.rpc(adm, "admin_refund", id, 10, "Late driver", k);
    expect((await t.ride(id)).refunded).toBe(10);
    expect((await t.rpc(c, "my_wallet")).balance).toBe(10);
    expect((await t.admin(`select count(*)::int n from public.audit_log where action = 'refund'`))[0].n).toBe(1);
  });
});

describe("Ratings, drivers and support (K, B)", () => {
  it("rating only once, only completed rides, 1–5 only", async () => {
    const u = await t.user(); const r = await t.book(u, { option: "bike" });
    await t.rpc(u, "rate_ride", r.id, 5, []);
    expect((await t.ride(r.id)).rating).toBeNull();
    const { c, id, d } = await fullTrip();
    await rejects(t.rpc(c, "rate_ride", id, 9, []), /1–5/);
    await t.rpc(c, "rate_ride", id, 4, ["Polite driver"]); await t.rpc(c, "rate_ride", id, 1, []);
    expect((await t.ride(id)).rating).toBe(4);
    expect(Number((await t.admin(`select rating from public.drivers where id = $1`, [d]))[0].rating)).toBe(4);
  });
  it("drivers can set a valid UPI ID only", async () => {
    const d = await t.driver("bike");
    await t.rpc(d, "update_my_upi", "rohit@okaxis");
    await rejects(t.rpc(d, "update_my_upi", "not a upi"), /check constraint/);
  });
  it("driver registration validates documents, plate uniqueness and AC eligibility", async () => {
    const a = await t.user(); const b = await t.user();
    const docs = (uid: string) => Object.fromEntries(["photo", "licence", "rc", "insurance", "aadhaar"].map((k) => [k, `${uid}/${k}.jpg`]));
    const base = { name: "Asha Rao", vehicle: "mini", model: "i10", plate: "UP16 ZZ 0001", city: "Noida", docs: docs(a) };
    await rejects(t.rpc(a, "register_driver", { ...base, docs: { licence: `${a}/l.jpg` } }), /five documents/);
    await rejects(t.rpc(a, "register_driver", { ...base, docs: docs(b) }), /five documents/);   // someone else's files
    await rejects(t.rpc(a, "register_driver", { ...base, vehicle: "auto", ac: true }), /cannot be AC/);
    await t.rpc(a, "register_driver", base);
    await rejects(t.rpc(b, "register_driver", { ...base, docs: docs(b), plate: "up16zz0001" }), /already registered/);
    expect((await t.rpc(a, "my_driver")).kyc).toBe("Pending");
  });
  it("support messages attach to the sender's ticket; others can't see it", async () => {
    const u = await t.user(); const x = await t.user();
    await t.rpc(u, "support_message", "Charged twice", "Customer", null);
    await t.rpc(u, "support_message", "Ride RD1", "Customer", null);
    expect((await t.as(u, "select notes from public.tickets"))[0].notes).toHaveLength(2);
    expect(await t.as(x, "select * from public.tickets")).toHaveLength(0);
    await rejects(t.rpc(u, "support_message", "x".repeat(2000), "Customer", null), /1–1000/);
  });
});

describe("Finished-ride screens close once (no stuck screens)", () => {
  it("customer: completed+paid ride stays until closed or rated; driver: until rated or closed", async () => {
    const { c, d, id } = await fullTrip();
    expect((await t.rpc(c, "my_active_ride")).id).toBe(id);           // payment due
    await t.rpc(c, "pay_ride", id, "UPI");
    expect((await t.rpc(c, "my_active_ride")).id).toBe(id);           // rate prompt
    await t.rpc(c, "close_ride", id);
    expect(await t.rpc(c, "my_active_ride")).toBeNull();
    expect((await t.rpc(d, "my_trip")).id).toBe(id);
    await t.rpc(d, "driver_close_ride", id);
    expect(await t.rpc(d, "my_trip")).toBeNull();
  });
  it("cash trips can't be closed by the driver before the cash is confirmed", async () => {
    const { d, id } = await fullTrip({ pay: "Cash" });
    await t.rpc(d, "driver_close_ride", id);
    expect((await t.rpc(d, "my_trip")).id).toBe(id);
  });
});

describe("Background housekeeping (system_tick)", () => {
  it("expires stale searches, activates due scheduled rides, drops silent drivers; not callable by users", async () => {
    const u = await t.user(); const r = await t.book(u, { option: "bike" });
    await t.admin(`update public.rides set searching_since = now() - interval '1 hour' where id = $1`, [r.id]);
    const u2 = await t.user();
    const s = await t.book(u2, { option: "bike", when: new Date(Date.now() + 30 * 60e3).toISOString() });
    await t.admin(`update public.rides set scheduled_for = now() + interval '5 minutes' where id = $1`, [s.id]);
    const d = await t.driver("bike");
    await t.admin(`update public.drivers set last_seen = now() - interval '1 hour' where id = $1`, [d]);
    await t.admin(`select public.system_tick()`);
    expect((await t.ride(r.id)).status).toBe("NoDrivers");
    expect((await t.ride(s.id)).status).toBe("Searching");
    expect((await t.admin(`select online from public.drivers where id = $1`, [d]))[0].online).toBe(false);
    await rejects(t.rpc(u, "system_tick"), /permission denied/);
  });
});

describe("Phone verification required (email-only accounts)", () => {
  it("an email-only account cannot book or apply as a driver", async () => {
    const e = await t.user({ email: "someone@example.test" });
    await rejects(t.book(e, { option: "bike" }), /mobile number/);
    await rejects(t.rpc(e, "register_driver", { name: "X Y", vehicle: "bike", model: "Shine", plate: "UP16AB1234", city: "Noida", docs: {} }), /mobile number/);
  });
});
