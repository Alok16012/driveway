# DriveWay (customer app) — Google Play kit

App: **DriveWay** · package `com.driveway.customer` · for people who book rides.
(Riders and drivers use the separate **DriveWay Partner** app — see `store/play-partner`.)

| File | Use in Play Console |
|---|---|
| `DriveWay.aab` (in `mobile/dist/PlayStore/DriveWay/`, from `npm run release`) | Release → App bundle |
| `icon-512.png` | Store listing → App icon |
| `feature-graphic-1024x500.png` | Store listing → Feature graphic |
| `screenshots/1…3.png` (1080 × 1920) | Store listing → Phone screenshots |

Upload key: `~/DriveWay-PlayStore-Keys/` (not in git — keep a backup). Use **Play App Signing**.
Bump `versionCode` in `mobile/customer/android/app/build.gradle` before every upload.

---

## Store listing

**App name** (30/30): `DriveWay: Book Bike, Auto, Cab`

**Short description** (79/80):
`Book bike, auto and cab rides in your city. Fair fares, live tracking, sharing.`

**Full description:**

```
DriveWay gets you across your city — quick, safe and at a fair price.

BOOK IN SECONDS
• Bike, auto, e-rickshaw, Mini, Sedan and XL — AC or Non-AC.
• See the fare before you book, worked out on the real road distance and traffic.
• Pin your exact pickup gate on the map; swap pickup and drop in one tap.
• Schedule a ride for later, or book for someone else.

PAY LESS
• Sharing rides: book a seat and pay less when others are going your way.
• Coupons and offers inside the app.
• Pay by cash, UPI or DriveWay wallet.

GET PICKED UP FASTER
• Add ₹5–₹30 for a faster pickup — it goes fully to your driver — and raise it while we look.

RIDE SAFE
• Verified drivers, OTP check at pickup, live tracking of your driver.
• Share trip details and an SOS button on every ride.

MORE
• Parcel delivery and hourly rentals.

Available in cities where DriveWay operates.
```

**Category:** Maps & Navigation · **Contact email:** *(your support email — required)* · **Website:** https://drivewayride.in
**Privacy policy:** https://drivewayride.in/privacy

---

## App content

| Section | Answer |
|---|---|
| Privacy policy | https://drivewayride.in/privacy |
| Ads | No |
| App access | Restricted → login **testcus@gmail.com / cust@123** + the instructions below |
| Content rating | *All other app types*; no violence / sexual content / gambling / drugs; users share location: **Yes**. Expected: Everyone / 3+ |
| Target audience | 18 and over |
| News / Health / Government | No |
| Financial features | None |
| Account deletion | In app: **Profile → Delete account**. Web: https://drivewayride.in/delete-account |

No foreground-service or background-location permissions in this app.

**App access instructions (paste):**
```
Log in with the account above (tap "Get Started" → Log in).
DriveWay operates in Kolkata, India. Tap "Where are you going?", tap the pickup field and search a Kolkata
place (e.g. "Esplanade"), then pick a drop (e.g. "Salt Lake Sector V") to see fares, sharing and booking.
```

### Data safety

Encrypted in transit: **Yes**. Deletion: **Yes**. Not sold.

| Data type | Collected | Shared* | Required? | Purposes |
|---|---|---|---|---|
| Location → Precise location | Yes | Yes (your driver, during the trip) | Optional (a pickup can be picked from the list) | App functionality |
| Personal info → Name | Yes | Yes (your driver) | Required | App functionality, Account management |
| Personal info → Email address | Yes | No | Required | Account management |
| Personal info → Phone number | Yes | Yes (your driver) | Required | App functionality, Account management |
| Financial info → Purchase history (rides, payments, wallet) | Yes | No | Required | App functionality |
| Messages → Other in-app messages (support chat) | Yes | No | Optional | Customer support |
| App activity → Other actions (rides, ratings) | Yes | No | Required | App functionality |

\* Supabase, Netlify, Ola Maps and OpenStreetMap process data for us — not counted as sharing.

---

## Release steps

1. Play Console → **Create app** → *DriveWay*, App, Free.
2. Store listing + App content from this file.
3. **Internal testing** → upload `DriveWay.aab` → testers → roll out.
4. New personal developer accounts: **closed test with 12+ testers for 14 days** before production.
5. **Production** → release → review.
