// Bounded latency check (not a load test — this runs against the shared project): a handful of parallel
// requests to the hottest paths, reporting p50/p95 and the error count. There are no documented latency targets.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { engine, assertIsolated, makeCustomer, makeRider, booking, cleanup } from "./helpers.mjs";

before(assertIsolated);
after(cleanup);

const pct = (xs, p) => xs.slice().sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * p))];
async function measure(label, n, fn) {
  const times = [], errors = [];
  await Promise.all(Array.from({ length: n }, async () => {
    const t = performance.now();
    try { await fn(); times.push(performance.now() - t); } catch (e) { errors.push(e.message); }
  }));
  console.log(`  ${label}: n=${n} ok=${times.length} errors=${errors.length} p50=${pct(times, 0.5)?.toFixed(0)}ms p95=${pct(times, 0.95)?.toFixed(0)}ms`);
  return { times, errors };
}

test("L1 customer status polling, 20 parallel", async () => {
  const C = await makeCustomer();
  const b = await engine.book(C.token, booking());
  const { errors } = await measure("statusForCustomer", 20, () => engine.statusForCustomer(C.token, b.id));
  assert.equal(errors.length, 0);
  await engine.cancelForCustomer(C.token, b.id, "perf");
});

test("L2 rider polling, 20 parallel", async () => {
  const R = await makeRider({ online: false });
  const { errors } = await measure("pollForRider", 20, () => engine.pollForRider(R.token));
  assert.equal(errors.length, 0);
});

test("L3 parallel bookings by 15 different customers with no riders online", async () => {
  const Cs = await Promise.all(Array.from({ length: 15 }, () => makeCustomer()));
  let i = 0;
  const { errors } = await measure("book", 15, () => engine.book(Cs[i++].token, booking()));
  assert.equal(errors.length, 0, errors.join("; "));
});
