# Google Maps

With a Google Maps key the customer, rider and admin apps use Google for:

| What | Google API |
|---|---|
| The map itself | Map Tiles API (2D roadmap) |
| Name of the current location | Geocoding API |
| Searching any pickup / drop | Places API (New) |
| Road route drawn on the map | Routes API |

Without a key — or if a Google call fails — they fall back to OpenStreetMap (tiles, Nominatim addresses, OSRM
routes) and search covers the saved places only.

## 1. Create the key

1. Go to https://console.cloud.google.com → create a project (e.g. "DriveWay").
2. **Billing** → link a billing account. Google Maps needs one, even within the free monthly usage.
3. **APIs & Services → Library** → enable each of: **Map Tiles API**, **Geocoding API**, **Places API (New)**, **Routes API**.
4. **APIs & Services → Credentials → Create credentials → API key**. Copy it.

## 2. Restrict the key (do this — the key ships inside the apps)

Edit the key:

- **Application restrictions → Websites**, add:
  - `https://localhost/*` — the Android/iOS apps
  - `http://localhost:3000/*` and `http://localhost:3001/*` — local development
  - your live site, e.g. `https://driveway.example.com/*`
- **API restrictions → Restrict key** → tick only the four APIs above.

Optionally set quotas (APIs & Services → each API → Quotas) and a budget alert (Billing → Budgets & alerts).

## 3. Add it to the app

In `.env.local`:

```
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIza...
```

Then restart `npm run dev`, and rebuild the apps (`npm run build:apk`, `npm run build:ios`) — the key is baked in
at build time.

## How searched places are booked

Rides keep place ids. A searched pickup goes as `cur` and a searched drop as `pin`, each with its position, name
and address (migration `20261025000000_google_places.sql`). Trips with such an end are priced on real distance
(straight line × 1.35 for roads); trips between the fixed places keep their old estimate.
