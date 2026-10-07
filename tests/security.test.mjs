// Authorization tests: row-level security (direct Supabase REST with each role's own session) and the
// server-side ride engine's caller checks. Expected behaviour: users see and change only their own data;
// riders must not learn the ride OTP (it is the customer's proof of presence); admin-only fields stay admin-only.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { admin, anon, engine, assertIsolated, makeCustomer, makeRider, booking, ride, rejects, cleanup } from "./helpers.mjs";

let A, B, R1, R2, rideA;

before(async () => {
  await assertIsolated();
  A = await makeCustomer(); B = await makeCustomer();
  R1 = await makeRider(); R2 = await makeRider({ online: false });
  const b = await engine.book(A.token, booking());
  rideA = b.id;
  const r = await ride(rideA);
  const rider = r.offered_to === R1.rider.id ? R1 : null;
  assert.ok(rider, "the only online test rider should hold the offer");
  await engine.acceptForRider(R1.token, rideA);
});
after(cleanup);

test("S1 assigned rider cannot read the ride OTP through the database", async () => {
  const { data } = await R1.client.from("rides").select("id, otp").eq("id", rideA);
  assert.equal(data?.[0]?.otp ?? null, null, "rider could read the OTP — can start the trip without the customer present");
});

test("S2 a customer cannot read another customer's ride or profile", async () => {
  const rides = await B.client.from("rides").select("id").eq("id", rideA);
  assert.equal(rides.data.length, 0);
  const prof = await B.client.from("customers").select("id").eq("id", A.customer.id);
  assert.equal(prof.data.length, 0);
});

test("S3 an unassigned rider cannot read the ride", async () => {
  const { data } = await R2.client.from("rides").select("id").eq("id", rideA);
  assert.equal(data.length, 0);
});

test("S4 customers cannot write rides or admin-only fields directly", async () => {
  const ins = await A.client.from("rides").insert({ customer_id: A.customer.id, vehicle: "bike", from_address: "x", to_address: "y", km: 1, min: 1, fare: 1, pay: "UPI" });
  assert.ok(ins.error, "direct ride insert should be denied");
  const upd = await A.client.from("rides").update({ fare: 1, status: "Completed", paid: true }).eq("id", rideA).select("id");
  assert.ok(upd.error || upd.data.length === 0, "direct ride update should be denied");
  const blk = await A.client.from("customers").update({ blocked: false, rating: 5 }).eq("id", A.customer.id);
  assert.ok(blk.error, "admin-only customer columns should be denied");
  assert.equal((await ride(rideA)).fare > 1, true);
});

test("S5 riders cannot approve themselves, lift suspension or change rides directly", async () => {
  const kyc = await R2.client.from("drivers").update({ kyc: "Approved", suspended: false }).eq("id", R2.rider.id);
  assert.ok(kyc.error);
  const st = await R1.client.from("rides").update({ status: "Completed" }).eq("id", rideA).select("id");
  assert.ok(st.error || st.data.length === 0);
});

test("S6 a pending rider cannot go online", async () => {
  const P = await makeRider({ kyc: "Pending", online: false });
  const r = await P.client.from("drivers").update({ online: true }).eq("id", P.rider.id).select("id");
  assert.ok(r.error || r.data.length === 0);
});

test("S7 signed-out visitors read nothing and cannot call helper functions", async () => {
  const c = anon();
  for (const t of ["customers", "drivers", "rides", "wallet_txns", "transactions", "tickets", "feedback", "places"]) {
    const { data } = await c.from(t).select("*").limit(1);
    assert.equal((data ?? []).length, 0, t);
  }
  assert.ok((await c.rpc("debug_rls")).error, "debug_rls must not be callable");
  assert.ok((await A.client.rpc("debug_rls")).error, "debug_rls must not be callable by users");
});

test("S8 the ride engine rejects forged tokens and wrong roles", async () => {
  assert.match(await rejects(() => engine.statusForCustomer("not-a-token", rideA)), /log in/i);
  assert.match(await rejects(() => engine.statusForCustomer(B.token, rideA)), /not found/i);
  assert.match(await rejects(() => engine.cancelForCustomer(B.token, rideA, "x")), /can't be cancelled/i);
  await engine.payForCustomer(B.token, rideA); // must be a no-op for someone else's ride
  assert.equal((await ride(rideA)).paid, false);
  assert.match(await rejects(() => engine.advanceForRider(A.token, rideA, "Arrived")), /rider profile/i);
  assert.match(await rejects(() => engine.pollForRider(A.token)), /rider profile/i);
});

test("S9 an unassigned (or offline) rider cannot drive someone else's trip", async () => {
  await admin.from("drivers").update({ online: true }).eq("id", R2.rider.id);
  assert.match(await rejects(() => engine.advanceForRider(R2.token, rideA, "Arrived")), /not found/i);
  assert.match(await rejects(() => engine.acceptForRider(R2.token, rideA)), /no longer available/i);
  await admin.from("drivers").update({ online: false }).eq("id", R2.rider.id);
});

test("S10 a rider learns only the passenger fields a trip needs", async () => {
  // Documents what RLS exposes to a rider about their passenger (policy "riders see their passengers").
  await engine.advanceForRider(R1.token, rideA, "Arrived");
  const { data } = await R1.client.from("customers").select("*").eq("id", A.customer.id);
  const exposed = Object.keys(data?.[0] ?? {});
  assert.ok(!exposed.includes("email"), `rider can read passenger columns: ${exposed.join(", ")}`);
});
