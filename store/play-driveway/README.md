# DriveWay (customer + rider in one app) — Google Play kit

One app, **DriveWay** (`com.driveway.customer`): customers book rides, and riders drive and earn, with the same login.
New users pick a side on the welcome screen ("Get Started" or "Drive with DriveWay"); the app remembers the side
used last, and switches from **Profile → Drive & earn** / **Account → Book a ride**. The Admin app stays separate
and is not for the Play Store.

| File | Use in Play Console |
|---|---|
| `mobile/dist/driveway-customer.aab` (`npm run build:aab -- customer`) | Release → App bundle |
| `icon-512.png` | Store listing → App icon (512 × 512) |
| `feature-graphic-1024x500.png` | Store listing → Feature graphic |
| `screenshots/1…8.png` (1080 × 1920) | Store listing → Phone screenshots (customer 1–3, rider 4–8) |

Upload key: `~/DriveWay-PlayStore-Keys/` (**not in git**). Back it up somewhere safe. Use **Play App Signing** —
Google keeps the app signing key, we only sign uploads with this key. If the upload key is lost, Google support can reset it.

Every new upload needs a higher `versionCode` in `mobile/customer/android/app/build.gradle` (1 → 2 → 3 …).

---

## Store listing

**App name** (30/30): `DriveWay: Ride or Drive & Earn`

**Short description** (74/80):
`Book bike, auto & cab rides in your city, or drive with DriveWay and earn.`

**Full description:**

```
DriveWay is one app to get around your city — and to earn by driving.

BOOK A RIDE
• Bike, auto, e-rickshaw, Mini, Sedan and XL — AC or Non-AC.
• See the fare before you book, worked out on the real road distance and traffic.
• Sharing rides: book a seat and pay less when others are going your way.
• Add ₹5–₹30 for a faster pickup, and raise it while we look for a driver.
• Pin your exact pickup gate on the map; swap pickup and drop in one tap.
• Track your driver live, share your OTP only at pickup, SOS on every trip.
• Pay by cash, UPI or DriveWay wallet. Coupons and offers inside.
• Parcel delivery and hourly rentals.

DRIVE AND EARN
• Switch to the rider side from your profile and register your bike, auto or cab.
• Go online when you want; see the pickup, drop and your earning before you accept.
• A small flat fee per ride — the rest of the fare and every add-on is yours.
• Daily and weekly incentives, Refer & Earn bonuses, payouts to your UPI.

One login for both. Available in cities where DriveWay operates.
```

**Category:** Maps & Navigation (ride-hailing apps usually sit here; *Travel & Local* also fits)
**Contact email:** *(your support email — required)* · **Website:** https://drivewayride.in
**Privacy policy:** https://drivewayride.in/privacy

---

## App content (Policy → App content)

| Section | Answer |
|---|---|
| Privacy policy | https://drivewayride.in/privacy |
| Ads | No |
| App access | **Restricted** → give reviewers two logins on the live app: a customer, and an *approved* rider (approve it in Admin). Steps: "Customer: Get Started → log in → book a ride. Rider: Profile → Drive & earn (or log in as the rider) → toggle Online." |
| Content rating | Category *All other app types*. No violence, sexual content, gambling, drugs. Users interact / share location: **Yes** (customer and rider see each other's location during a trip). Expected: Everyone / 3+, "Shares location". |
| Target audience | 18 and over. Not designed for children. |
| News / Health / Government | No |
| Financial features | None (the wallet only pays for rides and holds rider earnings) |
| Account deletion | In app: **Profile/Account → Delete account**. Web: https://drivewayride.in/delete-account |
| Foreground service permissions | `FOREGROUND_SERVICE_LOCATION`, task type **Location sharing**: *"In rider mode, while a trip is in progress the app shares the rider's live location with the customer — including when the screen is off — so the customer can see the vehicle approaching. It stops when the trip ends."* Play asks for a short video (YouTube unlisted): accept a ride as a rider, show the trip, lock the phone with the notification visible. |

No background-location permission is requested, so no background location declaration is needed.

### Data safety

Encrypted in transit: **Yes**. Users can request deletion: **Yes**. Data is not sold.

| Data type | Collected | Shared* | Required? | Purposes |
|---|---|---|---|---|
| Location → Precise location | Yes | Yes (the other person on the trip) | Required | App functionality |
| Personal info → Name | Yes | Yes (the other person on the trip) | Required | App functionality, Account management |
| Personal info → Email address | Yes | No | Required | Account management |
| Personal info → Phone number | Yes | Yes (the other person on the trip) | Required | App functionality, Account management |
| Personal info → Other info (riders: licence, RC, insurance, Aadhaar) | Yes | No | Optional (riders only) | App functionality, Fraud prevention |
| Photos and videos → Photos (riders' KYC documents) | Yes | No | Optional (riders only) | App functionality |
| Financial info → Purchase history (rides, payments, wallet) | Yes | No | Required | App functionality |
| Financial info → Other financial info (riders' UPI ID, earnings) | Yes | No | Optional (riders only) | App functionality |
| Messages → Other in-app messages (support chat) | Yes | No | Optional | Customer support |
| App activity → Other actions (trips, ratings) | Yes | No | Required | App functionality |

\* Service providers (Supabase, Netlify, Ola Maps, OpenStreetMap) process data for us — Google does not count that as sharing.

---

## Release steps

1. Play Console → **Create app** → *DriveWay*, App, Free.
2. Fill **Store listing** and **App content** from this file.
3. **Testing → Internal testing** → upload `driveway-customer.aab` → add testers → roll out.
4. A new *personal* developer account must run a **closed test with 12+ testers for 14 days** before production.
5. **Production** → release the tested bundle → send for review.
