# DriveWay — Pre-launch QA, Security & Reliability Audit

**Date:** 9 Oct 2026 · **Commit audited:** `fdd73f9` (main) · **Environment:** local dev server + production build on macOS, Node 20.18.1

> **Verdict: NOT READY.** DriveWay today is a front-end prototype. Every ride, payment, driver, admin action and login runs as in-browser simulation over hard-coded sample data. There is no backend, no database tables, no real authentication, no payment provider and no real-time channel. Five critical defects were reproduced, including an admin panel that accepts any password, a ride OTP that is never checked, and driver earnings credited twice on a double tap.

---

## 0. Remediation status (9 Oct 2026)

All 25 bugs were addressed by moving the business logic to the server: a Supabase migration
(`supabase/migrations/20261009000000_driveway_init.sql`) with RLS on every table and every write behind
a checked, idempotent Postgres function. The three apps were rewired onto it, and sample data and demo
controls were removed. **Business decision taken:** coupon discounts are funded by the platform; the driver's
commission is always on the full fare.

**Evidence:** `npm test` runs **57 database tests, all passing**. They load the real migration into an
isolated in-process Postgres (PGlite) with a Supabase-style auth shim. `npx tsc --noEmit` is clean,
`next build` succeeds and `npm audit --omit=dev` reports 0 vulnerabilities. A browser smoke test against
the live project confirmed that real Supabase auth replaces the bypasses. The old client-side pricing tests
were removed because pricing no longer lives in the client.

| Bug | Status | How it's fixed | Proof |
|---|---|---|---|
| BUG-01 admin any password | **Fixed** | Supabase email/password + `profiles.is_admin` (settable only from SQL); every admin function calls `require_admin()` and is audited | Browser: `sessionStorage` flag and wrong password both rejected; test "non-admins are refused by every admin function" |
| BUG-02 new driver → DRV1001, self-approval | **Fixed** | Driver identity = signed-in user; `register_driver` → Pending; approval only via `admin_set_kyc`; demo buttons removed | Tests "pending, rejected and suspended drivers cannot go online or accept", registration validation |
| BUG-03 OTP not verified | **Fixed** | `start_ride` compares the stored OTP; 5-attempt lockout; OTP readable only by the customer | Tests J6, "too many wrong OTPs…", "nobody but the customer sees the OTP" |
| BUG-04 double earnings | **Fixed** | `complete_ride` single transaction; ledger `idem` unique key; UI disables while busy | Test J15 "completing twice creates exactly one earning" |
| BUG-05 any OTP / editable session | **Fixed — needs SMS provider switched on** | Supabase phone OTP (6 digits) with server-side rate limits; session is a signed JWT | Browser: OTP request reaches Supabase; planted `localStorage` session ignored. See SETUP.md step 2 |
| BUG-06 duplicate ride records | **Fixed** | Rides exist only server-side; cancel/complete/rate are idempotent | Tests J4 repeat cancel, J9 repeat pay, rating once |
| BUG-07 wrong-category dispatch | **Fixed** | Only drivers of a requested category accept; search times out to `NoDrivers` (customer not charged); "no drivers" shown upfront | Tests J2, J10, J11, AC-only matching |
| BUG-08 ride lost on restart | **Fixed** | `my_active_ride()` + realtime subscription restore state | Test J12 |
| BUG-09 cancel fee never charged | **Fixed** | Fee charged once a driver is on the way; driver credited; customer pays it in the app | Test J4 "cancel after assignment → fee charged once" |
| BUG-10 coupon rules ignored | **Fixed** | `coupon_eval`: active, dates, weekday (IST), vehicle, destination, min fare, first-ride, per-user and total limits; atomic redemption; released on cancel | Six coupon tests incl. "last available use can only be redeemed once" |
| BUG-11 commission base conflict | **Fixed** | Platform funds discounts; ledger records the discount separately | Test "driver earning ignores the customer's coupon" |
| BUG-12 admin changes not saved | **Fixed** | Pricing, surge, commission, KYC, suspension, blocking and coupons are written to the DB and used by the next quote | Tests "admin price change applies to the next quote", "surge … applied" |
| BUG-13 negative fares/coupons | **Fixed** | CHECK constraints + admin form validation | Tests "negative prices are rejected", "coupons with zero/negative value … cannot be created" |
| BUG-14 Next.js advisories | **Fixed** | `next@16.4.0`, `npm audit fix` | `npm audit --omit=dev` → 0 vulnerabilities |
| BUG-15 demo controls | **Fixed** | Every `DemoButton` and "demo" hint removed | Code search: no matches |
| BUG-16 new users see sample data | **Fixed** | All sample people/rides/ledger deleted; data is per user from the DB; seeded "Home/Work" renamed to neutral places | — |
| BUG-17 pickup = drop | **Fixed** | Blocked in the UI, in `quote`/`book_ride`, and by a table CHECK | Test "pickup equal to drop is refused" |
| BUG-18 breakdown ≠ total | **Fixed** | Server returns itemised lines (incl. min-fare top-up, surge, Non-AC) that sum to the fare | Test "every option's breakdown lines add up to its fare" |
| BUG-19 phone validation | **Fixed** | `[6-9]\d{9}` in every phone field, enforced again on the server | Browser: `0000000000` rejected |
| BUG-20 wallet without balance | **Fixed** | Atomic balance check with a row lock | Tests J7, "wallet spend is atomic" |
| BUG-21 health endpoint | **Fixed** | Cheap read-only check, generic errors, per-IP rate limit, `no-store` | curl: 502 generic before migration; POST 405 |
| BUG-22 NaN/∞ pricing | **Fixed** | Server validates distance/time ranges | `fare_quote` raises on invalid input |
| BUG-23 hard-coded dashboard | **Fixed** | Every figure computed from rides/ledger; live date (IST) | — |
| BUG-24 CSV injection | **Fixed** | Every cell quoted; leading `= + - @` neutralised; UTF-8 BOM | — |
| BUG-25 open email sign-up | **Mitigated** | Booking and driver applications now require a verified phone number, so email-only accounts can't use the apps | Test "email-only account cannot book or apply" |

**New capabilities added while fixing:** real KYC document uploads (private bucket, JPG/PNG/PDF ≤ 5 MB,
admin views them through 60-second signed links); driver reassignment when a driver cancels; incentives
paid by the server (daily, peak-hour, weekly; once per window); two-way support tickets; refunds to wallet
with idempotency; an audit log; and `system_tick()` housekeeping for pg_cron.

**Still not real — needs external services** (see `docs/SETUP.md`): payment gateway and webhooks (`pay_ride`
is simulated), maps/GPS/ETA, push notifications, SOS desk, payout API. **Verdict now: Conditionally Ready
within tested scope.** That holds once the migration is applied, an SMS provider is configured and the flows
are re-run end to end on the live project. It is not launch-ready until a payment gateway replaces the
simulated payments.

---

## 1. Application map

### Stack
| Layer | What exists | Notes |
|---|---|---|
| Framework | Next.js 16.2.6 (App Router, Turbopack), React 19.2.4, TypeScript, Tailwind 4 | Three client-rendered apps |
| Apps | `/customer` (rider), `/rider` (driver), `/admin` (admin panel), `/` (chooser) | All three are `"use client"`, one large component each |
| Backend APIs | **One route:** `GET /api/health` | Calls Supabase Auth Admin with the service-role key |
| Database | Supabase project `zvsatvzdkpoumvaqrcnu` — **0 tables, 0 storage buckets** | Client helpers exist (`app/lib/supabase/{client,admin}.ts`) but nothing reads or writes data |
| Data | `app/lib/data.ts` — hard-coded vehicles, drivers, customers, rides, coupons, ledger | Comment: *"Stand-ins until the REST API from the PRD is live"* |
| Auth | Customer: any 10-digit phone + **any 4-digit OTP**; session = JSON in `localStorage`. Driver: same, session = `localStorage "1"`. Admin: **any password**; session = `sessionStorage "1"` | No Supabase Auth in use |
| Payments | Simulated. UPI/Card "succeed" after a 1.5 s timeout, Wallet is marked paid immediately, Cash is "collected" after 3.5 s | No provider, no webhooks, no ledger writes |
| Maps / location | `MapView` is a decorative SVG; distance/time come from a hash of place IDs (`tripEstimate`) | No GPS, geocoding, routing or ETA service |
| Real-time | `setTimeout`/`setInterval` timers stand in for a dispatch socket | Customer, driver and admin apps never talk to each other |
| Notifications | Toasts only. "Receipt sent", "OTP sent by SMS", "location shared" are text only | No SMS, push or email integration |
| Safety | Driver SOS "Police" opens `tel:112` (real number); "Safety team" and "Share trip" are toasts | Not triggered during testing |
| Tests / CI / deploy | **None before this audit.** No CI, no Dockerfile, no `vercel.json`, no migrations | This audit added Vitest |

### Roles and what they can do (as implemented)
| Role | Capabilities | Enforcement |
|---|---|---|
| Customer | Book Bike/Auto/E-Rickshaw/Mini/Sedan/Taxi/XL, "Book Any", hourly rental, parcel, schedule, coupons, pay, rate, chat (canned bot) | Client-side only |
| Driver ("Rider") | KYC form, go online, accept/decline offers, OTP start, end trip, wallet, payout, incentives, SOS | Client-side only; **"skip KYC" and "approve my account" buttons let anyone self-approve** |
| Admin | Dashboard, live rides, drivers (approve/suspend), customers (block), pricing, surge, commission, coupons, payments, CSV export, tickets | Client-side only; changes live in React state and vanish on reload |
| Support (separate role) | Not implemented — the admin is the only staff role, shown as "Super admin" | — |

### Business rules found in code (expected-behaviour sources)
- **Fares** `data.ts:60` — `max(minFare, round((base + perKm·km + perMin·min) × surge))`; Non-AC = 85% for AC-capable categories.
- **Categories** `data.ts:22-30` — bike, auto, erick, mini, sedan, taxi, suv ("XL"). Taxi has `nearby: 0`, so it shows "no cabs".
- **Rentals** `data.ts:70-82`; **parcels** `data.ts:87-98` (bike ≤ 5 kg, auto 5–20 kg + handling fee).
- **Coupons** `data.ts:102-113` — the eligibility text on each coupon (e.g. "Valid on Auto rides above ₹80", "Sat & Sun", `expires`, `active`).
- **Commission** 20% (`RiderScreens.tsx:15`). Waiting charge: 3 min free, then ₹2 per started minute (`RiderScreens.tsx:247-249`).
- **Cancellation fee** per category (`cancelFee`), shown when cancelling after the driver is on the way (`BookingScreens.tsx:698`).
- **Ride states** `data.ts:115` — `Searching → Assigned → Arriving → Arrived → Started → Completed`, plus `Cancelled` and `Scheduled`. There is no Payment Pending/Failed, Expired, No-show or Refund state.

### Actual ride state machine (customer app, `CustomerApp.tsx:98-112`)
```
Searching ──3.5 s──▶ Assigned ──1.8 s──▶ Arriving ──progress──▶ Arrived ──5 s──▶ Started ──progress──▶ Completed
    │                   │                    │                    │
    └──────────── Cancel (customer, reason picker; step < 4) ─────┘──▶ Cancelled  (no fee recorded)
Scheduled (stored in history only; never dispatched)
```
- Transitions are driven by client timers and a **"Demo: skip to next step"** button. Nothing checks who may change the status.
- Driver app phases (`RiderScreens.tsx:244`): `toPickup → arrived → onTrip → collect → rate`. **The driver app's trips and the customer app's rides are unrelated simulations**, so the database, rider, driver and admin views cannot agree.

---

## 2. Execution summary

### Commands run
| Command | Result |
|---|---|
| `npm install -D vitest@^3 fast-check` | Added test tooling (dev only) |
| `npm test` (`vitest run`) | **56 tests: 42 passed, 14 failed** — every failure is a defect listed below |
| `npx next build` | Builds; routes `/`, `/customer`, `/rider`, `/admin` static, `/api/health` dynamic |
| Bundle and history secret scan (Node script over `.next/static`, `.next/server`, `git log -p --all`) | Service-role key: 0 hits in the client bundle, 0 in server output, 0 in git history; no `.env*` tracked |
| `server-only` guard probe (temporary client page importing `admin.ts`, then deleted) | Build correctly **fails** with "'server-only' cannot be imported from a Client Component module" |
| `npm audit --omit=dev` | **4 vulnerabilities (1 critical, 3 high)** — `next` ≤ 16.3.7, `postcss`, `sharp`, `source-map-js`; all fixed by `next@16.4.0` |
| `curl` probes of `/api/health` (methods, junk query/body, 30 requests at 10-way concurrency) | GET 200; POST/PUT/DELETE 405; 30/30 OK; **p50 0.17 s, p95 0.50 s, max 0.50 s** (dev server) |
| Supabase `GET /auth/v1/settings` (anon key), `GET /storage/v1/bucket` (service key, read-only) | Email sign-up **enabled**, email confirmation required, phone disabled; 0 buckets |
| Browser E2E in the built-in browser at 375×812 (25 checks, synthetic accounts `9000000001`/`9000000002`, `qa@example.test`) | 10 passed, 15 failed |
| `npx tsc --noEmit` | Passes |

### Totals
| | Passed | Failed | Observation | Not Applicable | Blocked | Not Run |
|---|---|---|---|---|---|---|
| Unit / property tests (`tests/`) | 42 | 14 | – | – | – | – |
| Security & infrastructure checks | 5 | 1 | 1 | 1 | – | – |
| Browser end-to-end checks | 10 | 15 | – | – | – | – |
| Required journeys 1–15 (section 4) | 1 | 5 | – | 7 | 2 | – |
| **Executed checks total** | **57** | **30** | **1** | **1** | – | – |

The journey rows summarise the end-to-end checks above. They are not extra tests.

### What was mocked, and what needs real devices or a sandbox
- **Mocked by the app itself:** OTP delivery, payments, dispatch, driver location, maps/ETA, SMS/push/email, support chat, payouts, emergency contacts. I added no mocks of my own; the app has no integrations to mock.
- **Needs a real environment once built:** payment provider sandbox (UPI/card success, decline, timeout, webhooks), SMS OTP provider (rate limits, delivery order), background GPS on Android/iOS, push notifications, call masking, SOS/112 handling. **I did not tap SOS → Police, because it dials 112.**
- **No data was written to Supabase.** The only calls were read-only settings/bucket lookups and the app's own `/api/health`.

### Coverage gaps and assumptions
- **The highest-risk areas cannot be tested because they don't exist yet:** server-side authorization, object-level access control, database constraints/RLS, transactions, idempotency, webhooks, refunds, real dispatch concurrency and real-time event ordering. The 15 required journeys are mapped to what exists (section 4).
- Expected behaviour comes from code comments, UI copy and coupon text. Where none exists (e.g. what "Book Any" should charge, who absorbs a coupon discount), I report a **conflict / needs decision** rather than inventing a rule.
- I tested Chromium only, emulated at phone size. No real iOS/Android devices.

### Critical launch blockers
1. No real authentication anywhere. Admin accepts any password, any OTP works, sessions are editable browser storage (BUG-01, BUG-02, BUG-05).
2. No backend: rides, payments, pricing, approvals and suspensions are not persisted and not shared between apps (BUG-08, BUG-12).
3. Ride OTP not verified (BUG-03).
4. Duplicate financial side effects on double tap (BUG-04, BUG-06).
5. Self-approval of unverified drivers (BUG-02).
6. Critical Next.js advisories (BUG-14).

---

## 3. Bug report

Severity reflects launch impact if the current behaviour shipped. Each item lists the evidence that reproduces it.

### Critical

**BUG-01 — Admin panel accepts any password; admin session is a browser flag**
- **Affected:** Admin; all customers and drivers whose data it controls.
- **Steps:** open `/admin`, type any email and the password `x`, then press Login. Alternatively, run `sessionStorage.setItem("driveway:admin","1")` in the console and reload.
- **Expected:** Credential check against a server, with role-based access (UI copy: *"role-based access & audit logs come with the real API"*).
- **Actual:** Logged in as "Super admin" with `attacker@example.test` / `x`.
- **Evidence:** E2E-20 (`loggedInWithAnyPassword: true, roleShown: "Super admin"`).
- **Where:** `app/admin/AdminApp.tsx:243` (`if (pw) onLogin()`), `:36-37` (`readAdmin`/`writeAdmin`).
- **Root cause (established):** demo login with no backend.
- **Fix:** Supabase Auth (or SSO) plus a server-checked `role` claim. Protect admin data through RLS policies or server routes, never the client flag. Add audit-log tables.
- **Regression test:** API test showing that a non-admin JWT gets 403 on every admin endpoint and RLS-protected table.

**BUG-02 — New driver signs into an existing verified driver's account; self-approval buttons ship to production**
- **Affected:** Driver, customers (safety).
- **Steps:** `/rider` → Start Riding → phone `9000000002` → OTP `1111` → tap "Demo: skip KYC" → open Account.
- **Expected:** New, unapproved account that cannot go online until KYC is approved by an admin.
- **Actual:** The app opens as **Rohit Kumar, DRV1001, "✓ VERIFIED RIDER", +91 98100 12345**, with his ₹1,840 wallet and trip history, and can go online. "approve my account" on the pending screen does the same.
- **Evidence:** E2E-17.
- **Where:** `app/rider/RiderApp.tsx:47` (`useState<Driver>(DRIVERS[0])`), `:256` (skip KYC), `app/components/rider/Kyc.tsx:160` (approve my account).
- **Fix:** Driver identity comes from the authenticated user. Approval is an admin-only server mutation, and going online is checked server-side (`kyc = Approved AND NOT suspended`). Remove all `DemoButton`s from production builds.
- **Regression test:** an unapproved driver calling "go online" or "accept" is rejected by the API.

**BUG-03 — Ride start does not verify the ride OTP**
- **Affected:** Customer safety, driver.
- **Steps:** Driver app → go online → "send a ride request now" → Accept → Arrived → enter `9999` → Start Trip.
- **Expected:** The trip starts only when the entered code equals the customer's OTP (customer UI: *"Share this OTP to start the ride"*).
- **Actual:** The trip started ("End Trip" shown). Any 4 digits pass. The customer's generated OTP (`CustomerApp.tsx:154`) is never compared anywhere.
- **Evidence:** E2E-18.
- **Where:** `app/components/rider/RiderScreens.tsx:371` (`otp.length === 4 ? onStart(fee) : …`).
- **Fix:** Server-side `start_ride(ride_id, otp)` that checks driver assignment, current state `Arrived`, the OTP (hashed, single use) and an attempt limit, all in one transaction.
- **Regression test:** wrong OTP → 4xx and state unchanged; correct OTP → `Started`; second correct call → idempotent no-op; more than N wrong attempts → locked.

**BUG-04 — Double tap at trip completion credits driver earnings and wallet twice**
- **Affected:** Driver, finance.
- **Steps:** Driver trip → End Trip → Continue → 5★ → double-tap "Submit & Go Online".
- **Expected:** One earning of ₹128 (₹160 fare − 20%).
- **Actual:** Today's earnings ₹1,240 → **₹1,496 (+₹256)**; wallet ₹1,840 → **₹2,096**; wallet shows **two "Ride RD1301 · UPI +₹128" entries**. The trip count went up only once (3 → 4), so earnings and trips disagree.
- **Evidence:** E2E-19.
- **Where:** `app/rider/RiderApp.tsx:153-188` (`finish`). The guard `if (!trip) return` reads a stale closure, so both clicks pass it. Functional updaters (`d.earnings + net`, `w.balance + net`) then apply twice, while `trips: count` is computed from the closure and applies once.
- **Fix:** completion as a single idempotent server transaction keyed by `ride_id` (unique ledger entry per `(ride_id, kind)`). In the UI, disable the button on first tap.
- **Regression test:** call `complete_ride` twice, or concurrently, and assert exactly one earning row and one wallet credit.

**BUG-05 — Customer login accepts any OTP; session is editable `localStorage`**
- **Affected:** Customer.
- **Steps:** `/customer` → phone `0000000000` → OTP `0000` → profile.
- **Expected:** OTP verified against the code sent, with expiry, resend limits and attempt limits.
- **Actual:** Any 4 digits sign in (*"Demo: any 4 digits work"*). Writing `localStorage["driveway:customer"]` signs in as anyone.
- **Evidence:** E2E-01, E2E-02.
- **Where:** `app/components/Auth.tsx:109-114`, `app/customer/CustomerApp.tsx:40-41`.
- **Fix:** Supabase phone auth (needs an SMS provider; phone is currently disabled in the project), with server-side rate limiting.
- **Regression test:** wrong/expired/reused OTP rejected; 6th attempt locked; resend throttled.

### High

**BUG-06 — Double tap on "Submit Rating" or on a cancel reason creates duplicate ride records**
- **Affected:** Customer, support, finance.
- **Steps:** finish a ride, then double-tap "Submit Rating". Or, while the driver is on the way, Cancel Ride and double-tap "Changed my plans".
- **Actual:** **Two identical completed rides** (IGI Airport, ₹240) and **two identical cancelled rides** (Akshardham) in My Rides. Control: a single tap gives one record (E2E-14).
- **Evidence:** E2E-13, E2E-16.
- **Where:** `app/customer/CustomerApp.tsx:182-196` (`cancelRide`, `finishRide`) — same stale-closure guard as BUG-04.
- **Fix:** idempotent server mutations, and disable buttons after the first tap.
- **Regression test:** two concurrent cancel/complete calls give exactly one state change.

**BUG-07 — Dispatch never reports "no drivers"; it silently assigns a different vehicle category**
- **Affected:** Customer.
- **Steps:** book **Mini** (Current location → IGI Airport T3).
- **Expected:** a Mini driver, or a clear "no drivers available" outcome. The only Mini drivers are offline (DRV1003) or suspended (DRV1008).
- **Actual:** **Rohit Kumar's Sedan** (Maruti Dzire) is assigned. The ride is relabelled "Sedan · AC" but charged the Mini fare of ₹240. E-Rickshaw has no drivers at all and hits the same fallback (code inspection).
- **Evidence:** E2E-10.
- **Where:** `app/customer/CustomerApp.tsx:103` (`?? DRIVERS[0]`).
- **Fix:** a server dispatch that returns `NoDriversAvailable` (with retry/expiry) and never crosses categories unless a rule allows upgrades.
- **Regression test:** with no eligible driver, the booking ends in `Expired`/`NoDrivers` and the customer is not charged.
- **Related conflict:** "Book Any" charges the cheapest of Mini/Sedan/XL (`BookingScreens.tsx:155`) but may assign a Sedan or XL. No rule says whether that's intended. **Needs a business decision.**

**BUG-08 — Active ride is lost when the app restarts**
- **Steps:** book a Bike, wait for "Driver is on the way", reload the page.
- **Expected:** the app reopens on the live ride (journey 12).
- **Actual:** Home screen, no ride card, OTP gone, and the ride is not in history. Only the login JSON survives in storage.
- **Evidence:** E2E-09.
- **Where:** `CustomerApp.tsx:62` (`active` held only in React state).
- **Fix:** persist rides server-side and rehydrate on launch (`GET /rides/active`).

**BUG-09 — Cancellation fee is warned about but never charged or recorded**
- **Steps:** Sedan ride → "Driver is on the way" → Cancel.
- **Actual:** The sheet says *"A cancellation fee of ₹40 may apply"*, but the record shows "—" with `paid: false` and no fee line, refund or ledger entry.
- **Evidence:** E2E-15.
- **Where:** `CustomerApp.tsx:182-188`, `BookingScreens.tsx:698`.
- **Fix:** define the fee rule (when it applies, grace period, driver no-show), apply it server-side, and show it on the receipt.

**BUG-10 — Coupon eligibility rules are not enforced**
- **Evidence:** `tests/coupons.test.ts` PR-12 (4 failures).
- **Actual:** `AUTO20` (*"Valid on Auto rides above ₹80"*) discounts a ₹60 fare on any vehicle. `AUTO20` still applies after its 15 Oct 2026 expiry. `WEEKEND` (*"Sat & Sun"*) applies on a Wednesday. `discountFor` ignores `active`; only the coupon list filters it. "First ride" and per-user limits are not modelled at all.
- **Where:** `app/lib/data.ts:109-113`, `BookingScreens.tsx` `CouponSheet`.
- **Fix:** server-side coupon validation (category, minimum fare, dates/days, active, per-user/total limits, atomic redemption count). The client should never send the discount amount.

**BUG-11 — Commission is computed on different bases (conflict)**
- **Evidence:** `tests/earnings.test.ts` ER-03 (3 failures).
- **Actual:** The driver app takes 20% of the **full fare** (RD1287: ₹107). The ledger (`TXNS`) and admin CSV export take 20% of **fare − discount** (RD1287: ₹87). Differences: RD1287 ₹20, RD1284 ₹4, RD1280 ₹15.
- **Where:** `RiderApp.tsx:157-158` vs `AdminApp.tsx:659`, `data.ts:212-214`.
- **Needs decision:** who funds coupon discounts, the platform or the driver? Then use one shared function.

**BUG-12 — Admin changes are not saved or shared, yet the UI confirms them**
- **Steps:** Admin → Pricing → set Mini base to 999 → Save → reload.
- **Actual:** Toast *"Pricing saved — applies to new bookings"*, but after reload the value is back to 45. Customer fares always use `surge = 1` and the shipped constants. Driver suspension/approval, customer blocking, new coupons and the commission slider affect nothing outside the admin tab.
- **Evidence:** E2E-23.
- **Where:** `AdminApp.tsx:105` and the section components (local `useState`).
- **Fix:** persist config with versioning and an audit trail. Snapshot the price into each quote/booking so mid-ride changes don't alter active rides.

**BUG-13 — Admin forms accept negative fares and negative coupons; a negative coupon raises the fare**
- **Steps:** Pricing → Mini base `-100` (accepted). Coupons → create `QANEG` worth `-50` (created as "-50% off").
- **Evidence:** E2E-21, E2E-22; `tests/coupons.test.ts` PR-11 (`discountFor` returns a negative discount).
- **Where:** `AdminApp.tsx:536-537`, `:581-588`; `data.ts:109-113`.
- **Fix:** server-side validation (`base, perKm, perMin, minFare ≥ 0`; `0 < off ≤ 100` for percentages; `max > 0`). Clamp `discountFor` to `[0, fare]`.

**BUG-14 — Next.js version has a critical advisory**
- **Evidence:** `npm audit`: `next` ≤ 16.3.7 — middleware/proxy bypass (GHSA-6gpp-xcg3-4w24), Server Actions DoS and SSRF, cache confusion; plus `postcss`, `sharp`, `source-map-js` highs.
- **Fix:** upgrade to `next@16.4.0` (non-major) and re-run `npm audit`.

**BUG-15 — Demo controls are shipped in the production build**
- "Demo: skip to next step" (customer live ride), "send a ride request now", "skip KYC", "approve my account", the any-password admin hint and "Demo: any 4 digits work". These let any user advance ride states, approve themselves or bypass checks.
- **Where:** `DemoButton` usages: `BookingScreens.tsx:688`, `RiderApp.tsx:256, 309`, `Kyc.tsx:160`, `Auth.tsx:125`.
- **Fix:** gate behind `process.env.NODE_ENV !== "production"` or remove them.

### Medium

**BUG-16 — New accounts inherit the sample customer's data**
- **Actual:** A fresh sign-up (E2E-06) sees Amit Sharma's four past rides in My Rides, plus the "Visa ending 4821" card, "amit@okaxis" UPI, ₹240 wallet and a **4.9 rating** it never earned (stored in its session JSON).
- **Where:** `CustomerApp.tsx:63` (`useState(MY_RIDES)`), `:230` (`{ ...USER, … }`), `ProfileInfo` payments/wallet.
- **Fix:** load per-user data from the backend. A new account starts empty.

**BUG-17 — Pickup equal to destination is allowed and priced as a 3+ km trip**
- **Evidence:** `tests/pricing.test.ts` PR-05 (`tripEstimate("home","home")` = 3 km).
- **Where:** `SearchPage` `pick` (`BookingScreens.tsx:39`) has no equality check; `tripEstimate` floors at 3 km.
- **Note:** I checked this in code and unit tests, not by clicking through the UI.
- **Fix:** reject identical or near-identical pickup and drop, and compute distance from real routing.

**BUG-18 — Fare breakdown doesn't add up to the total shown**
- **Evidence:** PR-04 (2 failures). A 1 km/4 min Mini lists ₹45 + ₹12 + ₹8 = ₹65 but totals ₹80 (minimum fare, not shown). Non-AC Sedan lines sum to ₹310 but the total is ₹264 ("Non-AC discount … applied" has no amount).
- **Where:** `BookingScreens.tsx:368-378`.
- **Fix:** generate breakdown lines from the same function that computes the total, including min-fare top-up and Non-AC discount lines.

**BUG-19 — Phone validation only checks length**
- **Actual:** `0000000000` is accepted (E2E-01). There's no check for Indian mobile format (`[6-9]\d{9}`), and the same check applies to passenger, receiver and driver numbers.
- **Where:** `Auth.tsx:60`, `PassengerSheet`, `ParcelPage`.
- **Fix:** validate and normalise to E.164 on the server.

**BUG-20 — Wallet payments skip balance checks and are marked paid immediately**
- **Actual:** "DriveWay Wallet · Balance ₹240" can pay any fare, and the trip-done screen starts as paid for Wallet.
- **Where:** `BookingScreens.tsx:731`.
- **Fix:** atomic debit with an insufficient-balance error; block concurrent spends with row locks or idempotency keys.

**BUG-21 — `/api/health` is public and calls the Auth Admin API with the service key on every request**
- **Actual:** No auth or rate limit. Each anonymous GET triggers a privileged `listUsers` call, and error paths return raw `error.message`.
- **Where:** `app/api/health/route.ts`.
- **Fix:** use a cheap non-privileged check (or protect the route), return generic errors, and add rate limiting.

### Low

**BUG-22 — Pricing helpers propagate NaN/Infinity**
- `fareFor` and `waitFeeFor` return NaN/∞ for malformed input (PR-03, ER-02).
- Latent today because inputs are internal, but it becomes real once distance or time comes from a client or maps API.
- **Fix:** validate inputs at the API boundary.

**BUG-23 — Admin dashboard figures and date are hard-coded**
- "Today's Revenue ₹2,48,000", "1,248" rides, "↑ 15% vs last Sunday" and the header "Monday, 28 September 2026" are hard-coded, not derived from records.
- **Where:** `AdminApp.tsx:127, 265-268`.

**BUG-24 — CSV export does no quoting or formula-injection escaping**
- Fields are joined with `,` (`AdminApp.tsx:659`). This is latent until real, user-entered names and addresses are exported.

**BUG-25 — Supabase project allows open email sign-up**
- The app has no email login, but anyone with the public anon key can create auth users in the project.
- **Fix:** disable sign-ups until the auth design is final.

### Observations (not defects)
- Waiting charge rounds up to the **started minute**: 181 s → ₹2 (ER-02). This matches "per-minute" copy, but confirm the policy.
- Negative distance/time silently falls back to the minimum fare (PR-03). No rule covers it; reject it at the API.

---

## 4. Required journeys

| # | Journey | Status | Evidence / reason |
|---|---|---|---|
| 1 | Successful ride: sign-up → payment → rating | **Passed (simulated)** | E2E-01…-07, -11, -12: sign-up, Bike quote ₹162 matches the formula, driver assigned, UPI "paid", rated. No real payment; the double-tap variant fails (E2E-13). |
| 2 | No available drivers | **Failed** | E2E-10: Mini with no eligible driver is given a Sedan. Taxi correctly shows "no cabs" (E2E-25). |
| 3 | Driver rejection, then another driver accepts | **Not Applicable** | No shared dispatch: a decline in the driver app never reaches a customer ride. |
| 4 | Rider cancels before / after assignment | **Failed** | E2E-15: the after-assignment fee is warned but not recorded. E2E-16: double tap duplicates the record. |
| 5 | Driver cancels and the ride is reassigned | **Not Applicable** | The driver app can cancel its own simulated trip; no reassignment exists. |
| 6 | Invalid OTP, then valid OTP | **Failed** | E2E-18: an invalid OTP starts the trip. |
| 7 | Payment failure, then retry | **Blocked** | No payment provider; payments cannot fail. |
| 8 | Payment succeeds but the client response is lost | **Blocked** | No provider or webhook. |
| 9 | Duplicate payment webhook | **Not Applicable** | No webhooks. |
| 10 | Two drivers accept the same ride | **Not Applicable** | Separate simulations; no shared state. |
| 11 | One driver accepts two rides | **Not Applicable** | The driver UI shows one offer at a time; no server to race. |
| 12 | App restart during an active ride | **Failed** | E2E-09: the ride is lost. |
| 13 | Network loss during completion | **Not Applicable** | No network call happens at completion. |
| 14 | Unauthorized access to another user's ride | **Not Applicable** (no API) | But see BUG-16: new users see the sample user's rides and payment methods. |
| 15 | Repeated cancel / complete / refund / payout | **Failed** | E2E-13, -16, -19: duplicates on completion, cancel and earnings. Payout is guarded by the ₹100 minimum (code inspection); refunds are not implemented. |

---

## 5. Coverage matrix

### 5a. Unit and property tests (executed — `npm test`)
| ID | Feature / scenario | Priority | Expected (source) | Actual | Status | File |
|---|---|---|---|---|---|---|
| PR-01 ×21 | Every category: zero trip = min fare; min-fare threshold below/at/above; Non-AC only on AC-capable | High | `data.ts:60-62` | As expected | Passed | `tests/pricing.test.ts` |
| PR-02 ×3 | Fare is an integer ≥ min fare; monotonic in km/min; surge never lowers (fast-check) | High | Fare formula | As expected | Passed | `tests/pricing.test.ts` |
| PR-03a | NaN distance | Low | Fare must be finite | NaN | **Failed** (BUG-22) | `tests/pricing.test.ts` |
| PR-03b | Infinite distance | Low | Finite | ∞ | **Failed** (BUG-22) | `tests/pricing.test.ts` |
| PR-03c | Negative inputs | Low | No rule | Min fare | Passed (observation) | `tests/pricing.test.ts` |
| PR-04a | Breakdown sums to total (AC, above min fare) | Medium | UI consistency | ₹310 = ₹310 | Passed | `tests/pricing.test.ts` |
| PR-04b | Breakdown with min fare | Medium | Same | ₹65 vs ₹80 | **Failed** (BUG-18) | `tests/pricing.test.ts` |
| PR-04c | Breakdown, Non-AC | Medium | Same | ₹310 vs ₹264 | **Failed** (BUG-18) | `tests/pricing.test.ts` |
| PR-05a | Estimate symmetric A↔B | Low | Consistency | Symmetric | Passed | `tests/pricing.test.ts` |
| PR-05b | Pickup = drop | Medium | Reject / 0 km | 3 km priced | **Failed** (BUG-17) | `tests/pricing.test.ts` |
| PR-06 ×2 | Rental scaling; parcel = vehicle fare + handling fee | Medium | `data.ts:77-98` | As expected | Passed | `tests/pricing.test.ts` |
| PR-10 ×4 | % cap, flat cap at fare, null coupon, discount ∈ [0, fare] for shipped coupons | High | `discountFor` | As expected | Passed | `tests/coupons.test.ts` |
| PR-11a | Negative coupon | High | Discount ≥ 0 | −50 | **Failed** (BUG-13) | `tests/coupons.test.ts` |
| PR-11b | >100% coupon capped | Medium | ≤ max, ≤ fare | 80 | Passed | `tests/coupons.test.ts` |
| PR-12 ×4 | AUTO20 min fare, AUTO20 expiry, WEEKEND weekday, inactive AIRPORT99 | High | Coupon text in `data.ts:102-107` | Discount applied | **Failed** (BUG-10) | `tests/coupons.test.ts` |
| ER-01 | Net + commission = fare for 0…1,000,000 | High | No money lost | Holds | Passed | `tests/earnings.test.ts` |
| ER-02 ×6 | Waiting fee at 0/179/180/181/240/241 s | Medium | 3 min free, ₹2/min | As expected | Passed | `tests/earnings.test.ts` |
| ER-02b | Negative/NaN wait | Low | ₹0 | NaN | **Failed** (BUG-22) | `tests/earnings.test.ts` |
| ER-03 ×4 | Commission base driver app vs ledger/export (RD1280, RD1284, RD1287) | High | Single rule | Differs | **Failed** ×3 (BUG-11), Passed ×1 (precondition) | `tests/earnings.test.ts` |

### 5b. Security and infrastructure checks (executed)
| ID | Check | Expected | Actual | Status |
|---|---|---|---|---|
| S-01 | Service-role key in client JS bundle | Absent | 0 / 36 files | Passed |
| S-02 | Keys in git history / tracked `.env` | Absent | 0 hits, none tracked | Passed |
| S-03 | `server-only` blocks importing the admin client from a client component | Build fails | Build failed with server-only error | Passed |
| S-04 | Dependency audit | No critical/high | 1 critical, 3 high | **Failed** (BUG-14) |
| S-05 | `/api/health` methods and junk input | GET only; no reflection | GET 200, others 405, junk ignored | Passed |
| S-06 | `/api/health` bounded concurrency (30 req, 10-way) | No errors | 30/30; p50 0.17 s, p95 0.50 s | Passed (no target defined) |
| S-07 | Supabase auth settings | Matches app design | Email sign-up open, phone off | Observation (BUG-25) |
| S-08 | Storage bucket permissions | — | 0 buckets | Not Applicable |

### 5c. Browser end-to-end checks (executed, Chromium 375×812)
| ID | Role | Scenario | Expected | Actual | Status |
|---|---|---|---|---|---|
| E2E-01 | Customer | Phone `0000000000` | Rejected | Accepted | **Failed** (BUG-19) |
| E2E-02 | Customer | OTP `0000` | Rejected unless sent | Accepted | **Failed** (BUG-05) |
| E2E-03 | Customer | Name with `<img onerror>` | Rendered as text | Text only, no execution | Passed |
| E2E-04 | Customer | Invalid email | Blocked | Browser validation blocked | Passed |
| E2E-05 | Customer | Deny location/notifications | App usable | Continued to home | Passed |
| E2E-06 | Customer | New account data | Empty history | Sample user's rides, card, UPI, 4.9 rating | **Failed** (BUG-16) |
| E2E-07 | Customer | Bike quote and dispatch | ₹162; bike driver | ₹162; Imran Khan (bike) | Passed |
| E2E-08 | Customer | Double-tap Book | One active ride | One active ride | Passed |
| E2E-09 | Customer | Reload during active ride | Ride restored | Ride lost | **Failed** (BUG-08) |
| E2E-10 | Customer | Mini with no eligible driver | No-drivers outcome | Sedan assigned, relabelled | **Failed** (BUG-07) |
| E2E-11 | Customer | Complete ride, pay UPI, rate | Paid, recorded | "Paid Successfully · UPI" | Passed (simulated) |
| E2E-12 | Customer | Double-tap Pay | One payment | Single "Processing…" then paid | Passed (simulated) |
| E2E-13 | Customer | Double-tap Submit Rating | One record | Two identical records | **Failed** (BUG-06) |
| E2E-14 | Customer | Single-tap Done (control) | One record | One record | Passed |
| E2E-15 | Customer | Cancel while driver arriving | Fee per warning | Warned ₹40, none recorded | **Failed** (BUG-09) |
| E2E-16 | Customer | Double-tap cancel reason | One record | Two records | **Failed** (BUG-06) |
| E2E-17 | Driver | New phone + skip KYC | New unapproved account | Logged in as DRV1001, verified | **Failed** (BUG-02) |
| E2E-18 | Driver | Start trip with OTP 9999 | Rejected | Trip started | **Failed** (BUG-03) |
| E2E-19 | Driver | Double-tap completion | One earning | +₹256, two wallet credits | **Failed** (BUG-04) |
| E2E-20 | Admin | Any password | Rejected | Super admin | **Failed** (BUG-01) |
| E2E-21 | Admin | Mini base −100 | Rejected | Accepted | **Failed** (BUG-13) |
| E2E-22 | Admin | Coupon −50 | Rejected | Created | **Failed** (BUG-13) |
| E2E-23 | Admin | Save pricing, reload | Persisted | Reverted to 45 | **Failed** (BUG-12) |
| E2E-24 | Customer | A11y scan of home (names, alt text, targets ≥ 24 px, `lang`) | No issues | 0 unnamed, 0 missing alt, 0 small targets | Passed |
| E2E-25 | Customer | Taxi with 0 nearby | Disabled, "no cabs" | Disabled, "no cabs" | Passed |

### 5d. Scope areas from the brief that could not be tested
| Area | Status | Reason |
|---|---|---|
| A. Token refresh, revoked sessions, multi-device, suspended/blocked login | Not Applicable | No auth backend. Blocked customers in admin are not enforced anywhere (BUG-12). |
| B. Document upload safety, oversized/unsupported files | Not Applicable | KYC "upload" is a toggle; no files are stored. |
| C. GPS, permissions revoked, coordinates, geofencing, maps failures | Not Applicable | No location or map services; fixed place list. |
| D. Quote expiry, price change between quote and booking, client fare manipulation | Not Applicable / design gap | Fare is computed and trusted on the client; no server quote. |
| E. Concurrent driver acceptance, offer expiry vs stale accept | Not Applicable | No shared dispatch. Offer auto-expires after 15 s in the driver UI (code inspection). |
| H. Webhooks, refunds, reconciliation, payouts | Not Applicable | Not implemented. Payout UI requires ≥ ₹100 (code inspection). |
| J. Push, WebSocket, deep links | Not Applicable | Not implemented. |
| K. Shared tracking links, SOS delivery | Not Run | Share Trip is a toast; SOS → Police dials real 112, so I deliberately did not trigger it. |
| M. SQL injection, RLS, CSRF, rate limits, mass assignment | Not Applicable | No database queries or mutating endpoints exist yet. |
| N. Queue/worker outages, restart mid-payment | Not Applicable | No queues or workers. |
| O. Real iOS/Android, large text, orientation, timezone/clock-skew | Not Run | Emulated Chromium only. Slot times and "peak hour" use the device clock (`slots()`, `RiderApp.tsx:164`), so changing the device clock changes them. Needs server time. |

---

## 6. Recommended path to launch
1. **Backend first:** Supabase tables for users/roles, drivers, vehicles, rides, ride_events, quotes, payments, ledger and coupons, with RLS on every table. All state changes go through server routes or Postgres functions, never through client state.
2. **Ride state machine on the server:** one transition function with an allowed-transition table, role checks, `SELECT … FOR UPDATE` on the ride row, and unique constraints (one active ride per rider and per driver; one ledger row per `(ride_id, kind)`).
3. **Real auth:** phone OTP via an SMS provider with rate limits; admin via SSO or email + MFA; driver approval as an admin-only mutation.
4. **Payments:** a provider sandbox with signed, idempotent webhooks, and a ledger reconciled against provider records.
5. **Remove demo controls** from production builds, and **upgrade `next` to 16.4.0**.
6. Turn the failing tests in `tests/` into passing regression tests as each fix lands. Add API-level tests for authorization and concurrency once the server exists.
