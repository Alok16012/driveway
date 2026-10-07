# DriveWay — Ride Booking Platform

Uber-style multi-vehicle ride booking (Bike · Auto · Mini · Sedan · XL).
Three apps in one Next.js project:

| Route | App | For |
|---|---|---|
| `/` | Launcher | Pick an app |
| `/customer` | Customer app | Book, track, pay and rate rides |
| `/rider` | Rider panel | For the person driving: KYC, go online, accept requests, run trips (waiting charge, cancel, SOS, navigation), earnings, wallet & instant payout, incentives, ratings & performance, hotspots, documents, preferences (auto-accept, Go Home, cash rides), refer & earn, support |
| `/admin` | Admin panel | Dashboard, live rides, customers, riders/KYC, pricing, coupons, payments, reports, support, broadcasts |

`/driver` permanently redirects to `/rider` (see `next.config.ts`).

Built with Next.js 16, React 19 and Poppins. Blue-and-white theme; colours live as tokens in `app/globals.css`.

> **Demo build.** All data is sample data in `app/lib/data.ts` and lives in memory. OTPs accept any 4 digits, the admin login accepts any password, and driver matching, live tracking, payments and support replies are simulated. Look for the dashed **Demo:** buttons to fast-forward. A real backend (REST API, realtime sockets, maps SDK, payment gateway, push) plugs in later — see PRD §9–10.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000 and pick an app. The mobile apps are capped at 430px wide, so they're best viewed at phone width. The admin panel is responsive.

## Where things live

- `app/customer/CustomerApp.tsx`, `app/rider/RiderApp.tsx`, `app/admin/AdminApp.tsx` — app shells, navigation and demo state
- `app/components/customer/`, `app/components/rider/` — screens (`RiderScreens.tsx` for home/request/trip/earnings/trips/account, `RiderPages.tsx` for wallet, incentives, performance, documents, preferences, etc.)
- `app/components/` — shared UI (`ui.tsx`, `icons.tsx`, `MapView.tsx`, `VehicleArt.tsx`, `BottomNav.tsx`, `Auth.tsx`, `Brand.tsx`)
- `app/lib/data.ts` — vehicle categories & fare rules, places, rides, drivers, customers, coupons, rider hotspots/incentives/wallet
- `public/driveway-*.png` (cut from `assets/driveway-logo-source.png`), `app/icon.png`, `app/components/Brand.tsx` — logo and brand mark

## Database setup (Supabase → SQL Editor)

Run each file on its own, as a whole, in this order:

1. `supabase/setup.sql` — fresh database only: drops the DriveWay tables, creates the schema (0001) and loads the sample data.
2. `supabase/migrations/0002_auth.sql` through `0007_integrity.sql`, in number order.

Don't run `seed.sql` after `0007`: the sample data has two active rides for one rider, which 0007's one-active-ride rule rejects. `setup.sql` already includes it.
