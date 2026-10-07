// Unit tests for the pure pricing helpers in app/lib/data.ts.
// Expected values come from the configured rules (base + ₹/km × km + ₹/min × min, minimum fare, Non-AC 15% off,
// parcels at 90% plus the weight-slab charge, coupons capped by `max` and by the fare), not from the code under test.
import { test } from "node:test";
import assert from "node:assert/strict";
import { pricing } from "./helpers.mjs";

const { fareFor, parcelFareFor, discountFor, tripEstimate, NON_AC_DISCOUNT, PARCEL_RATE } = pricing;
const sedan = { id: "sedan", base: 60, perKm: 15, perMin: 2, minFare: 110, acOption: true };
const bike = { id: "bike", base: 20, perKm: 6, perMin: 1, minFare: 30, acOption: false };

test("P1 fare = base + distance + time when above the minimum", () => {
  assert.equal(fareFor(sedan, 10, 20), 60 + 150 + 40);
});

test("P2 minimum fare applies below, at and just above the threshold", () => {
  // bike: 20 + 6km + 1min; 0.5 km / 3 min → 26 < 30 → 30
  assert.equal(fareFor(bike, 0.5, 3), 30);
  // exactly 30: 20 + 6*1 + 4 = 30
  assert.equal(fareFor(bike, 1, 4), 30);
  // just above: 20 + 6*1 + 5 = 31
  assert.equal(fareFor(bike, 1, 5), 31);
});

test("P3 zero distance and time still charge the minimum fare", () => {
  assert.equal(fareFor(sedan, 0, 0), 110);
});

test("P4 surge multiplies the metered fare before rounding", () => {
  assert.equal(fareFor(sedan, 10, 20, 1.3), Math.round(250 * 1.3));
});

test("P5 Non-AC is 15% below the AC fare for AC-optional vehicles only", () => {
  assert.equal(NON_AC_DISCOUNT, 0.15);
  assert.equal(fareFor(sedan, 10, 20, 1, false), Math.round(250 * 0.85));
  assert.equal(fareFor(bike, 10, 20, 1, false), fareFor(bike, 10, 20, 1, true), "bikes have no AC choice");
});

test("P6 parcels: 90% of the ride fare plus the weight charge", () => {
  assert.equal(PARCEL_RATE, 0.9);
  assert.equal(parcelFareFor(bike, 10, 20, { extra: 25 }), Math.round(100 * 0.9) + 25);
});

test("P7 coupons: percent with cap, flat, never more than the fare", () => {
  assert.equal(discountFor({ off: 50, pct: true, max: 100 }, 150), 75);
  assert.equal(discountFor({ off: 50, pct: true, max: 100 }, 400), 100, "capped at max");
  assert.equal(discountFor({ off: 20 }, 150), 20);
  assert.equal(discountFor({ off: 99 }, 50), 50, "never exceeds the fare");
  assert.equal(discountFor(null, 150), 0);
});

test("P8 fares are whole rupees", () => {
  for (const [km, min, s] of [[3.3, 11, 1.3], [7.7, 23, 1.1], [12.1, 37, 2.5]]) {
    assert.ok(Number.isInteger(fareFor(sedan, km, min, s)));
    assert.ok(Number.isInteger(fareFor(sedan, km, min, s, false)));
  }
});

test("P9 trip estimate is stable per pair and within the 3–20 km design range", () => {
  assert.deepEqual(tripEstimate("home", "work"), tripEstimate("home", "work"));
  for (const [a, b] of [["home", "work"], ["cur", "airport"], ["x", "y"], ["", ""]]) {
    const { km } = tripEstimate(a, b);
    assert.ok(km >= 3 && km <= 20, `${a}->${b}: ${km} km`);
  }
});

test("P10 pickup equal to destination is priced as a real trip (no guard)", () => {
  // Documents current behaviour: there is no check that pickup and drop differ.
  const { km } = tripEstimate("home", "home");
  assert.ok(km >= 3);
});
