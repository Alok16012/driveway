// Ride state machine, dispatch, concurrency and money tests against lib/rides-server.ts.
// Lifecycle (from rides-server.ts): Searching → Arriving (accept) → Arrived → Started (OTP) → Completed,
// or Cancelled. Payment is tracked separately (rides.paid). Concurrency uses genuinely parallel requests.
import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { admin, engine, assertIsolated, resetTestRiders, makeCustomer, makeRider, booking, ride, ledger, rejects, cleanup } from "./helpers.mjs";

before(assertIsolated);
beforeEach(resetTestRiders);
after(cleanup);

/** Books a ride and has `rider` accept it (the rider must be the only free online test rider). */
async function assigned(customer, rider, over) {
  const b = await engine.book(customer.token, booking(over));
  const r = await ride(b.id);
  assert.equal(r.offered_to, rider.rider.id, "expected the offer to go to this rider");
  await engine.acceptForRider(rider.token, b.id);
  return { ...b, otp: r.otp };
}
const offline = (r) => admin.from("drivers").update({ online: false }).eq("id", r.rider.id);

test("R1 happy path: book → accept → arrive → OTP start → complete → pay → rate; money recorded once", async () => {
  const C = await makeCustomer(), R = await makeRider();
  const b = await assigned(C, R);
  assert.equal((await engine.statusForCustomer(C.token, b.id)).status, "Arriving");
  await engine.advanceForRider(R.token, b.id, "Arrived");
  await engine.advanceForRider(R.token, b.id, "Started", { otp: b.otp });
  await engine.advanceForRider(R.token, b.id, "Completed");
  await engine.payForCustomer(C.token, b.id);
  await engine.rateForCustomer(C.token, b.id, 5, ["On time"]);
  const r = await ride(b.id);
  assert.equal(r.status, "Completed"); assert.equal(r.paid, true); assert.equal(r.rating, 5);
  const l = await ledger([b.id], [R.rider.id]);
  assert.equal(l.wallet.length, 1); assert.equal(l.feedback.length, 1);
  assert.deepEqual(l.txns.map((t) => t.kind).sort(), ["Commission", "Ride Fare"]);
  const total = r.fare - r.discount, cut = -l.txns.find((t) => t.kind === "Commission").amount;
  assert.equal(l.wallet[0].amount, total - cut, "rider earning = fare − commission");
  assert.equal(l.txns.find((t) => t.kind === "Ride Fare").amount, total);
  await offline(R);
});

test("R2 invalid, skipped and reversed transitions are rejected; retried steps are harmless no-ops", async () => {
  const C = await makeCustomer(), R = await makeRider();
  const b = await assigned(C, R);
  assert.match(await rejects(() => engine.advanceForRider(R.token, b.id, "Started", { otp: b.otp })), /can't go/i);
  assert.match(await rejects(() => engine.advanceForRider(R.token, b.id, "Completed")), /can't go/i);
  await engine.advanceForRider(R.token, b.id, "Arrived");
  await engine.advanceForRider(R.token, b.id, "Arrived"); // a retried step succeeds and does nothing more
  await engine.advanceForRider(R.token, b.id, "Started", { otp: b.otp });
  assert.match(await rejects(() => engine.advanceForRider(R.token, b.id, "Arrived")), /can't go/i);
  await engine.advanceForRider(R.token, b.id, "Started", { otp: b.otp });
  await engine.advanceForRider(R.token, b.id, "Completed");
  await engine.advanceForRider(R.token, b.id, "Completed");
  assert.match(await rejects(() => engine.cancelForCustomer(C.token, b.id, "x")), /can't be cancelled/i);
  assert.match(await rejects(() => engine.cancelForRider(R.token, b.id, "x")), /can't be cancelled/i);
  assert.equal((await ride(b.id)).status, "Completed", "terminal state is kept");
  assert.equal((await ledger([b.id], [R.rider.id])).wallet.length, 1);
  await offline(R);
});

test("R3 wrong OTP is rejected and the right one starts the trip", async () => {
  const C = await makeCustomer(), R = await makeRider();
  const b = await assigned(C, R);
  await engine.advanceForRider(R.token, b.id, "Arrived");
  const wrong = b.otp === "1111" ? "2222" : "1111";
  assert.match(await rejects(() => engine.advanceForRider(R.token, b.id, "Started", { otp: wrong })), /wrong otp/i);
  assert.equal((await ride(b.id)).status, "Arrived");
  await engine.advanceForRider(R.token, b.id, "Started", { otp: b.otp });
  assert.equal((await ride(b.id)).status, "Started");
  await offline(R);
});

test("R4 OTP guessing is limited", async () => {
  const C = await makeCustomer(), R = await makeRider();
  const b = await assigned(C, R);
  await engine.advanceForRider(R.token, b.id, "Arrived");
  const guesses = ["0000", "0001", "0002", "0003", "0004", "0005", "0006", "0007", "0008", "0009", "0010", "0011"].filter((g) => g !== b.otp);
  for (const g of guesses) await rejects(() => engine.advanceForRider(R.token, b.id, "Started", { otp: g }));
  const msg = await engine.advanceForRider(R.token, b.id, "Started", { otp: b.otp }).then(() => null, (e) => e.message);
  assert.ok(msg && /too many|locked|try again later/i.test(msg), `after ${guesses.length} wrong guesses the right OTP still worked — no attempt limit`);
  await offline(R);
});

test("R5 the waiting fee is not set by the rider's own number", async () => {
  const C = await makeCustomer(), R = await makeRider();
  const b = await assigned(C, R);
  await engine.advanceForRider(R.token, b.id, "Arrived");
  await engine.advanceForRider(R.token, b.id, "Started", { otp: b.otp, waitFee: 500 }); // started immediately after arriving
  const fee = (await ride(b.id)).wait_fee;
  assert.equal(Number(fee), 0, `rider-supplied waiting fee accepted: ₹${fee} added with no wait`);
  await offline(R);
});

test("R6 concurrent completion records earnings and commission once", async () => {
  const C = await makeCustomer(), R = await makeRider();
  const b = await assigned(C, R);
  await engine.advanceForRider(R.token, b.id, "Arrived");
  await engine.advanceForRider(R.token, b.id, "Started", { otp: b.otp });
  const results = await Promise.allSettled(Array.from({ length: 5 }, () => engine.advanceForRider(R.token, b.id, "Completed")));
  const l = await ledger([b.id], [R.rider.id]);
  const ok = results.filter((r) => r.status === "fulfilled").length;
  assert.equal(l.wallet.length, 1, `${ok}/5 completions succeeded; ${l.wallet.length} wallet entries, ${l.txns.length} commission records`);
  assert.equal(l.txns.filter((t) => t.kind === "Commission").length, 1);
  await offline(R);
});

test("R7 concurrent payment and cash-collection record the fare once", async () => {
  const C = await makeCustomer(), R = await makeRider();
  const b = await assigned(C, R);
  await engine.advanceForRider(R.token, b.id, "Arrived");
  await engine.advanceForRider(R.token, b.id, "Started", { otp: b.otp });
  await engine.advanceForRider(R.token, b.id, "Completed");
  await Promise.all(Array.from({ length: 5 }, () => engine.payForCustomer(C.token, b.id)));
  assert.equal((await ledger([b.id], [R.rider.id])).txns.filter((t) => t.kind === "Ride Fare").length, 1);

  const C2 = await makeCustomer();
  const c = await assigned(C2, R, { pay: "Cash" });
  await engine.advanceForRider(R.token, c.id, "Arrived");
  await engine.advanceForRider(R.token, c.id, "Started", { otp: c.otp });
  await engine.advanceForRider(R.token, c.id, "Completed");
  await engine.payForCustomer(C2.token, c.id); // a customer can't mark a cash ride paid
  assert.equal((await ride(c.id)).paid, false);
  await Promise.all(Array.from({ length: 5 }, () => engine.collectedForRider(R.token, c.id)));
  assert.equal((await ledger([c.id], [R.rider.id])).txns.filter((t) => t.kind === "Ride Fare").length, 1);
  await offline(R);
});

test("R8 concurrent ratings store one rating; invalid values are ignored", async () => {
  const C = await makeCustomer(), R = await makeRider();
  const b = await assigned(C, R);
  await engine.rateForCustomer(C.token, b.id, 5, []); // before completion: ignored
  assert.equal((await ride(b.id)).rating, null);
  await engine.advanceForRider(R.token, b.id, "Arrived");
  await engine.advanceForRider(R.token, b.id, "Started", { otp: b.otp });
  await engine.advanceForRider(R.token, b.id, "Completed");
  for (const bad of [0, 6, -1, 3.7e9, "<script>"]) await engine.rateForCustomer(C.token, b.id, bad, []);
  assert.equal((await ride(b.id)).rating, null);
  await Promise.all([5, 4, 3, 2, 1].map((s) => engine.rateForCustomer(C.token, b.id, s, ["x"])));
  assert.equal((await ledger([b.id], [R.rider.id])).feedback.length, 1);
  await offline(R);
});

test("R9 a customer cannot hold two active bookings, even with parallel requests", async () => {
  const C = await makeCustomer();
  await engine.book(C.token, booking());
  assert.match(await rejects(() => engine.book(C.token, booking())), /already have a ride/i);
  const C2 = await makeCustomer();
  await Promise.allSettled(Array.from({ length: 5 }, () => engine.book(C2.token, booking())));
  const { data } = await admin.from("rides").select("id").eq("customer_id", C2.customer.id).in("status", ["Searching", "Arriving", "Arrived", "Started"]);
  assert.equal(data.length, 1, `${data.length} active rides created by 5 parallel taps`);
});

test("R10 one free rider is never offered (or given) two rides at once", async () => {
  const R = await makeRider();
  const Cs = await Promise.all(Array.from({ length: 4 }, () => makeCustomer()));
  const ids = (await Promise.all(Cs.map((c) => engine.book(c.token, booking())))).map((b) => b.id);
  const { data } = await admin.from("rides").select("id").in("id", ids).eq("offered_to", R.rider.id);
  const accepted = await Promise.allSettled(data.map((r) => engine.acceptForRider(R.token, r.id)));
  const { data: active } = await admin.from("rides").select("id").eq("driver_id", R.rider.id).in("status", ["Arriving", "Arrived", "Started"]);
  assert.ok(data.length <= 1 && active.length <= 1, `rider held ${data.length} offers and ${active.length} active rides (${accepted.filter((a) => a.status === "fulfilled").length} accepts succeeded)`);
  for (const id of ids) await admin.from("rides").update({ status: "Cancelled", offered_to: null }).eq("id", id).in("status", ["Searching", "Arriving"]);
  await offline(R);
});

test("R11 only the offered rider can accept, and only once", async () => {
  const C = await makeCustomer(), R = await makeRider(), other = await makeRider({ online: false });
  const b = await engine.book(C.token, booking());
  assert.match(await rejects(() => engine.acceptForRider(other.token, b.id)), /no longer available/i);
  const tries = await Promise.allSettled(Array.from({ length: 4 }, () => engine.acceptForRider(R.token, b.id)));
  assert.equal(tries.filter((t) => t.status === "fulfilled").length, 1);
  assert.equal((await ride(b.id)).driver_id, R.rider.id);
  await engine.cancelForCustomer(C.token, b.id, "test");
  await offline(R);
});

test("R12 decline moves the request to the next rider, who can accept", async () => {
  const C = await makeCustomer(), R1 = await makeRider(), R2 = await makeRider();
  const b = await engine.book(C.token, booking());
  const first = (await ride(b.id)).offered_to;
  const [a, z] = first === R1.rider.id ? [R1, R2] : [R2, R1];
  await engine.declineForRider(a.token, b.id);
  const r = await ride(b.id);
  assert.equal(r.offered_to, z.rider.id);
  assert.ok(r.declined_by.includes(a.rider.id));
  await engine.acceptForRider(z.token, b.id);
  assert.match(await rejects(() => engine.acceptForRider(a.token, b.id)), /no longer available/i);
  await engine.cancelForCustomer(C.token, b.id, "test");
  await offline(R1); await offline(R2);
});

test("R13 stale offers: accepting after expiry or after the customer cancelled fails", async () => {
  const C = await makeCustomer(), R = await makeRider();
  const b = await engine.book(C.token, booking());
  await admin.from("rides").update({ offer_expires_at: new Date(Date.now() - 1000).toISOString() }).eq("id", b.id);
  assert.match(await rejects(() => engine.acceptForRider(R.token, b.id)), /no longer available/i);
  await engine.statusForCustomer(C.token, b.id); // expires the stale offer
  assert.ok((await ride(b.id)).declined_by.includes(R.rider.id));
  const C2 = await makeCustomer();
  const c = await engine.book(C2.token, booking());
  await engine.cancelForCustomer(C2.token, c.id, "changed plans");
  assert.match(await rejects(() => engine.acceptForRider(R.token, c.id)), /no longer available/i);
  await engine.cancelForCustomer(C.token, b.id, "test").catch(() => {});
  await offline(R);
});

test("R14 cancel racing accept ends in one consistent state", async () => {
  const R = await makeRider();
  for (let i = 0; i < 4; i++) {
    const C = await makeCustomer();
    const b = await engine.book(C.token, booking());
    const [acc, can] = await Promise.allSettled([engine.acceptForRider(R.token, b.id), engine.cancelForCustomer(C.token, b.id, "race")]);
    const r = await ride(b.id);
    if (can.status === "fulfilled") assert.equal(r.status, "Cancelled");
    if (acc.status === "fulfilled" && can.status === "rejected") assert.equal(r.status, "Arriving");
    assert.ok(acc.status === "fulfilled" || can.status === "fulfilled");
    await admin.from("rides").update({ status: "Cancelled" }).eq("id", b.id);
  }
  await offline(R);
});

test("R15 repeated cancellation has no extra effect", async () => {
  const C = await makeCustomer(), R = await makeRider();
  const b = await assigned(C, R);
  await engine.cancelForCustomer(C.token, b.id, "first");
  assert.match(await rejects(() => engine.cancelForCustomer(C.token, b.id, "second")), /can't be cancelled/i);
  const r = await ride(b.id);
  assert.equal(r.cancel_reason, "first");
  const l = await ledger([b.id], [R.rider.id]);
  assert.equal(l.wallet.length + l.txns.length, 0, "no fees, refunds or earnings for a cancelled ride");
  await offline(R);
});

test("R16 no riders: the search gives up and cancels", async () => {
  const C = await makeCustomer();
  const b = await engine.book(C.token, booking()); // every test rider is offline by now
  await admin.from("rides").update({ offered_to: null, created_at: new Date(Date.now() - 120_000).toISOString() }).eq("id", b.id);
  const s = await engine.statusForCustomer(C.token, b.id);
  assert.equal(s.status, "Cancelled");
  assert.match(s.cancelReason, /no drivers/i);
});

test("R17 rider cancels before pickup: the ride is reassigned to another rider", async () => {
  const C = await makeCustomer(), R = await makeRider();
  const b = await assigned(C, R);
  const R2 = await makeRider(); // comes online after the first rider accepted
  await engine.advanceForRider(R.token, b.id, "Arrived");
  await engine.cancelForRider(R.token, b.id, "flat tyre");
  const r = await ride(b.id);
  assert.equal(r.status, "Searching");
  assert.equal(r.driver_id, null);
  assert.ok(r.declined_by.includes(R.rider.id), "the cancelling rider is not offered it again");
  assert.equal(r.offered_to, R2.rider.id);
  await engine.acceptForRider(R2.token, b.id);
  assert.equal((await engine.statusForCustomer(C.token, b.id)).driver.id, R2.rider.id);
  await engine.advanceForRider(R2.token, b.id, "Arrived");
  await engine.advanceForRider(R2.token, b.id, "Started", { otp: b.otp });
  await engine.cancelForRider(R2.token, b.id, "emergency");
  assert.equal((await ride(b.id)).status, "Cancelled", "after the trip started a rider cancellation ends the ride");
  await offline(R); await offline(R2);
});

test("R18 restart recovery: both apps get the live ride back", async () => {
  const C = await makeCustomer(), R = await makeRider();
  const b = await assigned(C, R);
  await engine.advanceForRider(R.token, b.id, "Arrived");
  const cur = await engine.currentForCustomer(C.token);
  assert.equal(cur.id, b.id); assert.equal(cur.status, "Arrived"); assert.equal(cur.otp, b.otp);
  const p = await engine.pollForRider(R.token);
  assert.equal(p.active.id, b.id); assert.equal(p.active.status, "Arrived");
  assert.equal(p.active.otp, undefined, "the rider app payload must not carry the OTP");
  await engine.cancelForCustomer(C.token, b.id, "test");
  const after = await engine.pollForRider(R.token, b.id);
  assert.equal(after.cancelled?.id, b.id);
  await offline(R);
});

test("R19 suspending a rider mid-trip closes the trip, so the customer is not left stuck", async () => {
  const C = await makeCustomer(), R = await makeRider();
  const b = await assigned(C, R);
  await engine.advanceForRider(R.token, b.id, "Arrived");
  await engine.advanceForRider(R.token, b.id, "Started", { otp: b.otp });
  // What the admin "suspend" action does (app/admin/actions.ts updateDriver → releaseRider).
  await admin.from("drivers").update({ suspended: true }).eq("id", R.rider.id);
  await engine.releaseRider(R.rider.id);
  assert.match(await rejects(() => engine.advanceForRider(R.token, b.id, "Completed")), /suspended/i);
  const r = await ride(b.id);
  assert.equal(r.status, "Cancelled");
  const s = await engine.statusForCustomer(C.token, b.id);
  assert.match(s.cancelReason, /rider unavailable/i);
  const again = await engine.book(C.token, booking());
  assert.ok(again.id, "the customer can book again");
  await engine.cancelForCustomer(C.token, again.id, "test");
});

test("R21 admin closes a stuck live ride", async () => {
  const C = await makeCustomer(), R = await makeRider();
  const b = await assigned(C, R);
  await engine.adminCancelRide(b.id, "stuck");
  assert.equal((await ride(b.id)).status, "Cancelled");
  assert.match(await rejects(() => engine.adminCancelRide(b.id, "again")), /isn't live/i);
  assert.match(await rejects(() => engine.advanceForRider(R.token, b.id, "Arrived")), /cancelled/i);
  await offline(R);
});

test("R20 a login that is both customer and rider is not dispatched its own booking", async () => {
  const R = await makeRider();
  await admin.from("customers").insert({ user_id: R.userId, name: "Self", email: R.email, phone: `+91 98${String(Date.now()).slice(-3)} ${String(Math.random()).slice(2, 7)}` });
  const b = await engine.book(R.token, booking());
  const r = await ride(b.id);
  assert.notEqual(r.offered_to, R.rider.id, "the rider was offered their own booking (self-dispatch → fake trips and earnings)");
  await engine.cancelForCustomer(R.token, b.id, "test").catch(() => {});
  await offline(R);
});
