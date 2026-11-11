# DriveWay Rider — Google Play kit

Everything needed to publish **DriveWay Rider** (`com.driveway.rider`) on Google Play.

| File | Use in Play Console |
|---|---|
| `mobile/dist/driveway-rider.aab` (build with `npm run build:aab -- rider`) | Release → App bundle |
| `icon-512.png` | Store listing → App icon (512 × 512) |
| `feature-graphic-1024x500.png` | Store listing → Feature graphic |
| `screenshots/01…06.png` (1080 × 1920) | Store listing → Phone screenshots |

Upload key: `~/DriveWay-PlayStore-Keys/` (**not in git**). Back up that folder (e.g. to a password manager or an
offline drive). Use **Play App Signing** — Google keeps the app signing key, we only sign uploads with this key.
If the upload key is ever lost, Google support can reset it.

Every new upload needs a higher `versionCode` in `mobile/rider/android/app/build.gradle` (1 → 2 → 3 …).

---

## Store listing

**App name** (28/30): `DriveWay Rider: Drive & Earn`

**Short description** (77/80):
`Drive your bike, auto or cab with DriveWay. Low fee per ride, earn every day.`

**Full description:**

```
DriveWay Rider is the partner app for bike, auto, e-rickshaw and cab drivers who want to earn on their own time.

GO ONLINE WHEN YOU WANT
• One tap to go online or offline — no fixed shifts.
• See each request before you accept: pickup, drop, distance, trip time and exactly what you will earn.

EARN MORE
• A small flat platform fee per ride — the rest of the fare is yours.
• Customers can add a tip-style add-on for faster pickup; it goes fully to you.
• Daily and weekly incentives, and Refer & Earn bonuses when riders you invite complete their trips.
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

**Category:** Auto & Vehicles · **Tags:** Ride hailing, Driving
**Contact email:** *(your support email — required by Play)* · **Website:** https://drivewayride.in
**Privacy policy:** https://drivewayride.in/privacy

---

## App content (Policy → App content)

| Section | Answer |
|---|---|
| Privacy policy | https://drivewayride.in/privacy |
| Ads | No, the app does not contain ads |
| App access | **All or some functionality is restricted** → give reviewers an *approved* test rider login (email + password) and the steps: "Log in → toggle Online". Create this rider on the live app and approve it in Admin. |
| Content rating | Questionnaire category: *All other app types*. No violence, sexual content, gambling or drugs. "Users can interact / share location": **Yes** (location is shared with the customer during a trip). Expected rating: Everyone / 3+ with "Shares location". |
| Target audience | 18 and over only. Not designed for children. |
| News app | No |
| Financial features | My app doesn't provide any financial features (the wallet only holds platform fees and earnings) |
| Health | No |
| Government app | No |
| Data safety | see below |
| Account deletion | Yes, users can delete their account. In app: **Account → Delete account**. Web: https://drivewayride.in/delete-account |
| Foreground service permissions | `FOREGROUND_SERVICE_LOCATION` → task type **Location sharing / navigation**: *"While a trip is in progress the app shares the rider's live location with the customer so they can see the vehicle approaching and the route, including when the screen is off. It stops when the trip ends."* Play asks for a short video link (YouTube unlisted is fine): record accepting a ride, the trip screen, then locking the phone with the notification visible. |

No background-location permission is requested (location runs in a visible foreground service only during a trip),
so no background location declaration is needed.

### Data safety form

Data is **encrypted in transit**: Yes. Users **can request deletion**: Yes. No data is sold.

| Data type | Collected | Shared* | Optional? | Purposes |
|---|---|---|---|---|
| Location → Precise location | Yes | Yes (customer on the trip) | Required | App functionality |
| Personal info → Name | Yes | Yes (customer on the trip) | Required | App functionality, Account management |
| Personal info → Email address | Yes | No | Required | Account management |
| Personal info → Phone number | Yes | Yes (customer on the trip) | Required | App functionality, Account management |
| Personal info → Other info (licence, RC, insurance, Aadhaar numbers/images) | Yes | No | Required | App functionality (verification), Fraud prevention |
| Photos and videos → Photos | Yes | No | Required | App functionality (verification) |
| Financial info → Other financial info (UPI ID, wallet, earnings) | Yes | No | Required | App functionality |
| Messages → Other in-app messages (support chat) | Yes | No | Optional | Customer support |
| App activity → Other actions (trips, ratings) | Yes | No | Required | App functionality |

\* Service providers (Supabase, Netlify, Ola Maps, OpenStreetMap) process data on our behalf — Google does not count
that as sharing.

---

## Release steps

1. Play Console → **Create app** → name *DriveWay Rider*, App, Free, accept declarations.
2. Fill **Store listing** and **App content** with the above.
3. **Testing → Internal testing** → create release → upload `driveway-rider.aab` → add your testers' emails → roll out.
4. New personal developer accounts must run a **closed test with at least 12 testers for 14 days** before
   production access. (Organisation accounts skip this.)
5. **Production** → create release from the tested bundle → send for review (usually 1–7 days).
