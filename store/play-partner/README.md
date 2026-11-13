# DriveWay Partner (rider / driver app) — Google Play kit

App: **DriveWay Partner** · package `com.driveway.partner` · for bike, auto, e-rickshaw and cab drivers.
(Customers use the separate **DriveWay** app — see `store/play-driveway`.)

| File | Use in Play Console |
|---|---|
| `DriveWay-Partner.aab` (in `mobile/dist/PlayStore/DriveWay-Partner/`, from `npm run release`) | Release → App bundle |
| `icon-512.png` | Store listing → App icon |
| `feature-graphic-1024x500.png` | Store listing → Feature graphic |
| `screenshots/1…6.png` (1080 × 1920) | Store listing → Phone screenshots |

Upload key: `~/DriveWay-PlayStore-Keys/` (not in git — keep a backup). Use **Play App Signing**.
Bump `versionCode` in `mobile/rider/android/app/build.gradle` before every upload.

---

## Store listing

**App name** (30/30): `DriveWay Partner: Drive & Earn`

**Short description** (77/80):
`Drive your bike, auto or cab with DriveWay. Low fee per ride, earn every day.`

**Full description:**

```
DriveWay Partner is the app for bike, auto, e-rickshaw and cab drivers who want to earn on their own time.

GO ONLINE WHEN YOU WANT
• One tap to go online or offline — no fixed shifts.
• See each request before you accept: pickup, drop, distance, trip time and exactly what you will earn.

EARN MORE
• A small flat platform fee per ride — the rest of the fare is yours.
• Customers can add an add-on for faster pickup; it goes fully to you.
• Daily and weekly incentives, and Refer & Earn bonuses when partners you invite complete their trips.
• Sharing rides: carry more than one passenger going the same way.

SIMPLE, SAFE TRIPS
• One tap opens Google Maps navigation to the pickup and drop.
• OTP check at pickup so you always start the right ride.
• Share trip details and an SOS button on every trip.

YOUR MONEY, CLEARLY
• Today, weekly and monthly earnings in one place.
• Wallet with platform fee, cash collected and bonuses.
• Payouts to your own UPI ID.

GET STARTED
1. Sign up with your mobile number and email.
2. Upload your licence, RC, insurance and ID for verification.
3. Once approved, recharge your wallet and go online.

Available in cities where DriveWay operates. You need a valid driving licence and vehicle documents.
```

**Category:** Auto & Vehicles · **Contact email:** *(your support email — required)* · **Website:** https://drivewayride.in
**Privacy policy:** https://drivewayride.in/privacy

---

## App content

| Section | Answer |
|---|---|
| Privacy policy | https://drivewayride.in/privacy |
| Ads | No |
| App access | Restricted → login **testrider@gmail.com / rider@123** (already approved) + the instructions below |
| Content rating | *All other app types*; no violence / sexual content / gambling / drugs; users share location: **Yes**. Expected: Everyone / 3+ |
| Target audience | 18 and over |
| News / Health / Government | No |
| Financial features | None (the wallet only holds platform fees and earnings) |
| Account deletion | In app: **Account → Delete account**. Web: https://drivewayride.in/delete-account |
| Foreground service permissions | `FOREGROUND_SERVICE_LOCATION`, task type **Location sharing**: *"While a trip is in progress the app shares the partner's live location with the customer so they can see the vehicle approaching, including when the screen is off. It stops when the trip ends."* Play asks for a short video (YouTube unlisted): accept a ride, show the trip screen, lock the phone with the notification visible. |

No background-location permission is requested, so no background location declaration is needed.

**App access instructions (paste):**
```
Tap "Start Earning" → Log in with the account above. The account is already verified.
Tap the Online switch on Home. Ride requests appear when a customer books nearby (service area: Kolkata, India).
```

### Data safety

Encrypted in transit: **Yes**. Deletion: **Yes**. Not sold.

| Data type | Collected | Shared* | Required? | Purposes |
|---|---|---|---|---|
| Location → Precise location | Yes | Yes (the customer on the trip) | Required | App functionality |
| Personal info → Name | Yes | Yes (the customer on the trip) | Required | App functionality, Account management |
| Personal info → Email address | Yes | No | Required | Account management |
| Personal info → Phone number | Yes | Yes (the customer on the trip) | Required | App functionality, Account management |
| Personal info → Other info (licence, RC, insurance, Aadhaar) | Yes | No | Required | App functionality (verification), Fraud prevention |
| Photos and videos → Photos (KYC documents) | Yes | No | Required | App functionality (verification) |
| Financial info → Other financial info (UPI ID, wallet, earnings) | Yes | No | Required | App functionality |
| Messages → Other in-app messages (support chat) | Yes | No | Optional | Customer support |
| App activity → Other actions (trips, ratings) | Yes | No | Required | App functionality |

\* Supabase, Netlify, Ola Maps and OpenStreetMap process data for us — not counted as sharing.

---

## Release steps

1. Play Console → **Create app** → *DriveWay Partner*, App, Free.
2. Store listing + App content from this file.
3. **Internal testing** → upload `DriveWay-Partner.aab` → testers → roll out.
4. New personal developer accounts: **closed test with 12+ testers for 14 days** before production.
5. **Production** → release → review.
