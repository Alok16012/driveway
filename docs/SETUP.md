# DriveWay — backend setup

The apps need four things in your Supabase project before they work. Steps 1–4 are done in the
Supabase dashboard (https://supabase.com/dashboard → your project).

## 1. Create the database (once)

1. Open **SQL Editor → New query**.
2. Paste the whole of `supabase/migrations/20261009000000_driveway_init.sql` and press **Run**.
   It creates the tables, access rules (RLS), server functions, seed data (vehicles, fares, places,
   coupons, incentives) and the private `driver-docs` storage bucket. Running it again is safe.
3. Check: `curl http://localhost:3000/api/health` → `{"supabase":"ok"}`.

## 2. Turn on phone sign-in (customers and drivers)

**Authentication → Sign In / Providers → Phone** → enable, pick an SMS provider (Twilio, Vonage,
MessageBird or Textlocal) and paste its credentials. SMS messages are billed by that provider.

For testing without sending real SMS, add test numbers in the same screen under
**"Phone numbers for testing"**, e.g. `919000000001=123456, 919000000002=123456`
(country code, no `+`). Sign in with `90000 00001` and OTP `123456`.

Recommended in **Authentication → Rate Limits**: keep SMS OTPs at a low per-hour limit, and in
**Authentication → Sign In / Providers → Phone**, an OTP expiry of 300 seconds.

## 3. Create an admin account

1. **Authentication → Users → Add user → Create new user**: email + strong password, tick
   "Auto Confirm User".
2. **SQL Editor** — give that account admin rights (only possible from here, never from the apps):

   ```sql
   update public.profiles set is_admin = true, name = 'Your Name'
   where id = (select id from auth.users where email = 'you@example.com');
   ```

3. Sign in at `/admin` with that email and password.

To remove access later: same query with `is_admin = false`.

## 4. Schedule housekeeping (recommended)

**Database → Extensions** → enable `pg_cron`, then in the SQL Editor:

```sql
select cron.schedule('driveway-tick', '* * * * *', $$ select public.system_tick() $$);
```

Every minute this ends searches that found no driver, starts scheduled rides 15 minutes before
pickup, and takes drivers offline whose app stopped responding. Without it the same rules still
run whenever the customer or driver opens the app.

## 5. Try a full ride

1. **Driver** (`/rider`, phone `90000 00002`): fill in the application and upload the five documents.
2. **Admin** (`/admin` → Drivers): open the driver, view the documents, **Approve**.
3. **Driver**: Check status → go **Online**.
4. **Customer** (`/customer` in another browser/profile, phone `90000 00001`): book the same vehicle type.
5. **Driver**: accept → I've Arrived → enter the customer's 4-digit OTP → Start → End Trip.
6. **Customer**: pay (UPI/Card are simulated until a payment gateway is connected) and rate.

## Environment variables

See `.env.example`. `SUPABASE_SERVICE_ROLE_KEY` is server-only — never prefix it with `NEXT_PUBLIC_`.

## Still simulated / not connected

| Area | Today | To make it real |
|---|---|---|
| Online payments (UPI, card) | `pay_ride` marks the ride paid immediately | Payment gateway (e.g. Razorpay) + signed, idempotent webhooks calling a server function |
| Maps, distance, ETA | Fixed list of places; distance from a stable formula | Maps/geocoding/routing API and live driver GPS |
| Push notifications, SMS to passengers | Not sent; in-app status only | FCM/APNs + device tokens; SMS provider for passenger/receiver OTPs |
| SOS | Calls 112 / creates a priority support ticket | 24×7 safety desk integration |
| Driver payouts | Recorded in the ledger as paid | Payout API (e.g. RazorpayX) with reconciliation |

## Mobile apps (Android APK, iOS)

`npm run build:apk` builds two apps into `mobile/dist/`:

| File | App | Package |
|---|---|---|
| `driveway-customer.apk` | DriveWay (customer) | `com.driveway.customer` |
| `driveway-rider.apk` | DriveWay Rider | `com.driveway.rider` |

Each bundles a static export of its page (`NEXT_PUBLIC_NATIVE_APP=1`) and talks to Supabase directly,
using the URL and anon key from `.env.local` at build time. Build just one with `npm run build:apk -- rider`.
Needs JDK 21 (`JAVA_HOME`, or `~/.local/jdk21`) and the Android SDK (`~/Library/Android/sdk`).
The Android projects live in `mobile/customer/android` and `mobile/rider/android` (open them in Android Studio).

The APKs are debug-signed: fine for installing on test phones, not for the Play Store. A store release needs
a signing key and `./gradlew bundleRelease`.

### iOS

`npm run build:ios` builds the same two apps for iOS (bundle IDs `com.driveway.customer`, `com.driveway.rider`).
The Xcode projects are `mobile/customer/ios/App/App.xcodeproj` and `mobile/rider/ios/App/App.xcodeproj`.

- Without signing: `npm run build:ios` → `mobile/dist/driveway-<app>-simulator.app`, which runs only in the
  iOS Simulator (drag it onto a running simulator).
- For iPhones: sign in to Xcode with an Apple Developer account (Settings → Accounts), then
  `APPLE_TEAM_ID=<your team id> npm run build:ios` → `mobile/dist/driveway-<app>.ipa`. It installs on iPhones
  registered to that team. For TestFlight or the App Store, add `IOS_EXPORT_METHOD=app-store-connect` and
  upload the .ipa with Xcode or Transporter.

The iOS projects use Swift Package Manager, so CocoaPods isn't needed. They were created from Capacitor's SPM
template directly because `cap add ios --packagemanager SPM` still demands CocoaPods in Capacitor 7.6.
