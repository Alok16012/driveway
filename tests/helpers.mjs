// Shared fixtures for the integration tests.
//
// There is no separate test database: these tests run against the configured Supabase project, so they
// only ever create synthetic data (emails @driveway.test, plates starting "TEST QA") and delete it again.
// Test rides use one vehicle type; `assertIsolated` refuses to run if a real rider is online for it,
// so no real rider is ever offered a test booking.
import { createRequire } from "node:module";
import crypto from "node:crypto";

const require = createRequire(import.meta.url);
const { createClient } = require("@supabase/supabase-js");

export const engine = require("../.test-build/rides-server.js");
export const profiles = require("../.test-build/profile-server.js");
export const pricing = require("../.test-build/data.js");

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const admin = createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
export const anon = () => createClient(URL, ANON, { auth: { persistSession: false } });

/** The vehicle type test rides use. */
export const TEST_VEHICLE = "bike";
const TAG = crypto.randomBytes(3).toString("hex");
let n = 0;
const created = { users: [], phones: [] };

export async function assertIsolated() {
  const { data } = await admin.from("drivers").select("id, plate").eq("vehicle", TEST_VEHICLE).eq("online", true);
  const real = (data ?? []).filter((d) => !String(d.plate).startsWith("TEST QA"));
  if (real.length) throw new Error(`Refusing to run: ${real.length} real ${TEST_VEHICLE} rider(s) online — test bookings could reach them`);
}

async function login(email, password) {
  const c = anon();
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return { client: c, token: data.session.access_token, userId: data.user.id };
}

const phone = () => {
  const p = `+91 9${String(Date.now() % 1e4).padStart(4, "0")} ${String(Math.floor(Math.random() * 1e5)).padStart(5, "0")}`;
  created.phones.push(p);
  return p;
};

async function makeUser(kind) {
  const email = `qa-${TAG}-${kind}-${++n}@driveway.test`;
  const password = crypto.randomBytes(12).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  created.users.push(data.user.id);
  return { email, password, ...(await login(email, password)) };
}

export async function makeCustomer(extra = {}) {
  const u = await makeUser("customer");
  const { data, error } = await admin.from("customers").insert({ user_id: u.userId, name: "QA Customer", email: u.email, phone: phone(), ...extra }).select().single();
  if (error) throw error;
  return { ...u, customer: data };
}

/** An approved rider, online by default, driving TEST_VEHICLE. */
export async function makeRider(extra = {}) {
  const u = await makeUser("rider");
  const { data, error } = await admin.from("drivers").insert({
    user_id: u.userId, name: "QA Rider", phone: phone(), vehicle: TEST_VEHICLE, model: "QA", plate: `TEST QA${TAG}${n}`,
    city: "Noida", kyc: "Approved", online: true, ...extra,
  }).select().single();
  if (error) throw error;
  return { ...u, rider: data };
}

/** A booking input for TEST_VEHICLE between two known places. */
export const booking = (over = {}) => ({
  service: "ride", vehicle: TEST_VEHICLE, ac: false, pay: "UPI",
  fromId: "home", fromName: "Home", toId: "work", toName: "Work", ...over,
});

export const ride = async (id) => (await admin.from("rides").select("*").eq("id", id).single()).data;

/** Rides, wallet entries, transactions and feedback for the given rides/riders. */
export async function ledger(rideIds, riderIds) {
  const [w, t, f] = await Promise.all([
    admin.from("wallet_txns").select("*").in("driver_id", riderIds),
    admin.from("transactions").select("*").in("ride_id", rideIds),
    admin.from("feedback").select("*").in("ride_id", rideIds),
  ]);
  return { wallet: w.data ?? [], txns: t.data ?? [], feedback: f.data ?? [] };
}

/** Expects `fn` to throw; returns the message. */
export async function rejects(fn) {
  try { await fn(); } catch (e) { return e.message; }
  throw new Error("expected an error, but the call succeeded");
}

/** Puts every test rider offline and closes any live test ride, so one test's leftovers can't receive the next test's offers. */
export async function resetTestRiders() {
  const { data } = await admin.from("drivers").select("id").like("plate", "TEST QA%");
  const ids = (data ?? []).map((d) => d.id);
  if (!ids.length) return;
  await admin.from("drivers").update({ online: false }).in("id", ids);
  const live = ["Searching", "Assigned", "Arriving", "Arrived", "Started"];
  await admin.from("rides").update({ status: "Cancelled", offered_to: null }).in("status", live).in("offered_to", ids);
  await admin.from("rides").update({ status: "Cancelled", offered_to: null }).in("status", live).in("driver_id", ids);
}

/** Deletes everything the tests created. */
export async function cleanup() {
  const { data: cus } = await admin.from("customers").select("id").in("user_id", created.users);
  const { data: drv } = await admin.from("drivers").select("id").in("user_id", created.users);
  const cIds = (cus ?? []).map((r) => r.id), dIds = (drv ?? []).map((r) => r.id);
  const { data: rides } = await admin.from("rides").select("id").or(`customer_id.in.(${cIds.join(",") || "x"}),driver_id.in.(${dIds.join(",") || "x"})`);
  const rIds = (rides ?? []).map((r) => r.id);
  if (rIds.length) {
    await admin.from("feedback").delete().in("ride_id", rIds);
    await admin.from("transactions").delete().in("ride_id", rIds);
    await admin.from("rides").delete().in("id", rIds);
  }
  if (dIds.length) {
    await admin.from("wallet_txns").delete().in("driver_id", dIds);
    await admin.from("feedback").delete().in("driver_id", dIds);
    await admin.from("drivers").delete().in("id", dIds);
  }
  if (cIds.length) await admin.from("customers").delete().in("id", cIds);
  for (const id of created.users) await admin.auth.admin.deleteUser(id);
  created.users.length = 0;
}
