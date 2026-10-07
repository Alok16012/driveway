// Server-side pricing and promotion enforcement. Expected rules come from the configured data:
// coupon titles/bodies in the coupons table ("Flat ₹20 off on Auto", "50% off your first ride", expiry dates),
// payment-method availability, and the catalog. The client never sends a fare; the server prices every booking.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { admin, engine, pricing, assertIsolated, makeCustomer, booking, ride, rejects, cleanup, TEST_VEHICLE } from "./helpers.mjs";

before(assertIsolated);
after(async () => { await admin.from("coupons").delete().in("code", ["QAEXPIRED", "QABIKE"]); await cleanup(); });

const cancel = (C, id) => engine.cancelForCustomer(C.token, id, "test").catch(() => {});

test("Q1 the server prices the booking from the catalog (client sends no fare)", async () => {
  const C = await makeCustomer();
  const b = await engine.book(C.token, booking({ fare: 1, discount: 999 }));
  const { data: v } = await admin.from("vehicles").select("*").eq("id", TEST_VEHICLE).single();
  const { km, min } = pricing.tripEstimate("home", "work");
  const expected = pricing.fareFor({ ...v, perKm: +v.per_km, perMin: +v.per_min, minFare: +v.min_fare, base: +v.base, acOption: v.ac_option }, km, min, b.surge, true);
  assert.equal(b.fare, expected); assert.equal(b.discount, 0);
  await cancel(C, b.id);
});

test("Q2 pickup/drop must be known places; the client's names are ignored; same place is refused", async () => {
  const C = await makeCustomer();
  assert.match(await rejects(() => engine.book(C.token, booking({ fromId: "a", toId: "b" }))), /choose your pickup/i);
  assert.match(await rejects(() => engine.book(C.token, booking({ fromId: "home", toId: "home" }))), /same place/i);
  const b = await engine.book(C.token, booking({ fromName: "Connaught Place", toName: "Jewar Airport" }));
  const r = await ride(b.id);
  assert.equal(r.from_address, "Home"); assert.equal(r.to_address, "Work");
  await cancel(C, b.id);
  // Note: real distances still need maps/routing — the server now only prices known place pairs.
});

test("Q3 vehicle-specific coupon (\"Flat ₹20 off on Auto\") does not apply to other vehicles", async () => {
  const C = await makeCustomer();
  assert.match(await rejects(() => engine.book(C.token, booking({ couponCode: "AUTO20" }))), /isn't valid for this vehicle/i);
});

test("Q4 first-ride coupon (FIRST50) cannot be reused", async () => {
  const C = await makeCustomer();
  const first = await engine.book(C.token, booking({ couponCode: "FIRST50" }));
  await cancel(C, first.id);
  await admin.from("rides").update({ status: "Completed" }).eq("id", first.id); // as if the first ride happened
  assert.match(await rejects(() => engine.book(C.token, booking({ couponCode: "FIRST50" }))), /first ride only|already used/i);
});

test("Q5 an expired coupon is not applied", async () => {
  await admin.from("coupons").insert({ code: "QAEXPIRED", title: "QA expired", body: "", off: 10, pct: false, expires: "2020-01-01", active: true });
  const C = await makeCustomer();
  assert.match(await rejects(() => engine.book(C.token, booking({ couponCode: "QAEXPIRED" }))), /expired/i);
});

test("Q6 unknown and inactive codes are refused; a valid code applies, with the fare minimum enforced", async () => {
  const C = await makeCustomer();
  assert.match(await rejects(() => engine.book(C.token, booking({ couponCode: "NOPE123" }))), /isn't a valid coupon/i);
  assert.match(await rejects(() => engine.book(C.token, booking({ couponCode: "AIRPORT99" }))), /isn't a valid coupon/i); // inactive
  await admin.from("coupons").insert({ code: "QABIKE", title: "QA bike", body: "", off: 10, pct: false, expires: "2099-12-31", active: true, vehicles: [TEST_VEHICLE], min_fare: 1 });
  const ok = await engine.book(C.token, booking({ couponCode: "qabike " }));
  assert.equal(ok.discount, 10, "case and spaces don't matter");
  await cancel(C, ok.id);
  await admin.from("coupons").update({ min_fare: 100000 }).eq("code", "QABIKE");
  assert.match(await rejects(() => engine.book(C.token, booking({ couponCode: "QABIKE" }))), /needs a fare of at least/i);
});

test("Q7 malformed booking input is rejected or bounded", async () => {
  const C = await makeCustomer();
  assert.match(await rejects(() => engine.book(C.token, booking({ vehicle: "rocket" }))), /isn't available/i);
  assert.match(await rejects(() => engine.book(C.token, booking({ pay: "Bitcoin" }))), /payment method/i);
  assert.match(await rejects(() => engine.book(C.token, booking({ service: "parcel" }))), /parcel weight/i);
  const b = await engine.book(C.token, booking({ fromName: "x".repeat(10_000), toName: "<img src=x onerror=alert(1)>" }));
  const r = await ride(b.id);
  assert.equal(r.from_address, "Home", "client-supplied names are ignored");
  assert.equal(r.to_address, "Work");
  await cancel(C, b.id);
});

test("Q8 paying by wallet requires a wallet balance", async () => {
  // The app shows "DriveWay Wallet · Balance ₹240", but there is no wallet balance on the server.
  const C = await makeCustomer();
  const b = await engine.book(C.token, booking({ pay: "Wallet" }));
  await cancel(C, b.id);
  const { data } = await admin.from("customers").select("*").eq("id", C.customer.id).single();
  assert.ok("wallet_balance" in data, "no wallet balance exists anywhere — wallet rides are marked paid without any debit");
});
