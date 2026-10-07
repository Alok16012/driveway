// HTTP-level tests against a running server (BASE_URL, default http://localhost:3000): server actions are
// public POST endpoints, so they are called directly — no UI — with no cookie, a forged cookie, a foreign
// Origin, and repeated wrong passwords. Action ids come from the server's reference manifest.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { admin, makeCustomer, cleanup } from "./helpers.mjs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const MANIFEST = process.env.ACTION_MANIFEST ?? ".next/dev/server/server-reference-manifest.json";
let ids = {};
let C;

before(async () => {
  const m = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  for (const [id, v] of Object.entries(m.node ?? {})) ids[v.exportedName] = id;
  const page = await fetch(BASE).then((r) => (r.ok ? r.text() : ""), () => "");
  if (!page) throw new Error(`No server at ${BASE} — start the app first`);
  if (!/DriveWay/.test(page)) throw new Error(`The server at ${BASE} isn't DriveWay — refusing to send it test requests`);
  C = await makeCustomer();
});
const started = new Date().toISOString();
// H5's wrong passwords would otherwise lock admin sign-in (and count toward the overall cap) for 15 minutes.
after(async () => { await admin.from("admin_login_attempts").delete().gte("at", started); await cleanup(); });

async function call(page, name, args, headers = {}) {
  const res = await fetch(`${BASE}${page}`, {
    method: "POST",
    headers: { "Next-Action": ids[name], "Content-Type": "text/plain;charset=UTF-8", Accept: "text/x-component", Origin: BASE, ...headers },
    body: JSON.stringify(args),
  });
  return { status: res.status, body: await res.text() };
}

test("H1 admin actions without a session are refused and change nothing", async () => {
  const r = await call("/admin", "setCustomerBlocked", [C.customer.id, true]);
  assert.match(r.body, /Not signed in as admin/);
  const { data } = await admin.from("customers").select("blocked").eq("id", C.customer.id).single();
  assert.equal(data.blocked, false);
  const c = await call("/admin", "setCouponActive", ["QA-NO-SUCH-CODE", true]);
  assert.match(c.body, /Not signed in as admin/);
});

test("H2 a forged admin cookie is refused", async () => {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const r = await call("/admin", "setCustomerBlocked", [C.customer.id, true], { Cookie: `rw_admin=${exp}.forgedsignature` });
  assert.match(r.body, /Not signed in as admin/);
});

test("H3 a server action posted from another origin is rejected (CSRF)", async () => {
  const r = await call("/admin", "login", ["admin@driveway.in", "x"], { Origin: "https://evil.example" });
  assert.ok(r.status >= 400 || !/Wrong email or password/.test(r.body), `foreign-origin action was processed (status ${r.status})`);
});

test("H4 customer and rider actions need a valid session", async () => {
  const r = await call("/", "bookRide", ["", { service: "ride", vehicle: "bike", ac: false, pay: "UPI", fromId: "a", fromName: "a", toId: "b", toName: "b" }]);
  assert.match(r.body, /log in again/i);
  const p = await call("/rider", "riderPoll", ["eyJhbGciOiJIUzI1NiJ9.e30.forged"]);
  assert.match(p.body, /log in again/i);
});

test("H5 admin login is rate-limited against password guessing", async () => {
  const tries = 25;
  const results = [];
  for (let i = 0; i < tries; i++) results.push(await call("/admin", "login", ["admin@driveway.in", `wrong-${i}`]));
  const limited = results.filter((r) => r.status === 429 || /too many|try again later|locked/i.test(r.body)).length;
  assert.ok(limited > 0, `${tries} wrong admin passwords in a row were all processed — no lockout or rate limit`);
});
