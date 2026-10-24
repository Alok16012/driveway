# Local end-to-end testing

Click through the customer, rider and admin apps together without touching the production Supabase project.

1. `node scripts/e2e/fake-supabase.mjs` — a local stand-in for Supabase on http://localhost:54321. It loads every
   migration in `supabase/migrations` into PGlite, so pricing, rides, RLS and the rest are the production SQL.
   Data lives in memory and is wiped when it stops.
2. Run the app against it:
   `NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=e2e-anon npx next dev`
   (the `driveway-e2e` entry in `.claude/launch.json` does this).
3. Use a different origin per app so each keeps its own sign-in — the session is stored per origin:
   customer on http://localhost:3000, rider on http://127.0.0.1:3000/rider, admin on http://[::1]:3000/admin.

Accounts are auto-confirmed. Make one an admin with
`curl -X POST localhost:54321/e2e/admin -H 'content-type: application/json' -d '{"email":"…"}'`.

Test accounts used in the manual runs (local stand-in only — they don't exist anywhere else):

| Role | Email | Password | Mobile |
|---|---|---|---|
| Customer | e2e.customer@gmail.com | e2e-pass-1 | 9000000001 |
| Rider | e2e.rider@gmail.com | e2e-pass-2 | 9000000002 |
| Admin | e2e.admin@gmail.com | e2e-pass-3 | 9000000003 |

The browser pane can't share a real GPS position; paste this in the console during the launch screen to fake one
(Salt Lake, Kolkata):

```js
navigator.geolocation.watchPosition = (ok) => { ok({ coords: { latitude: 22.5867, longitude: 88.4171, accuracy: 12 }, timestamp: Date.now() }); return 1; };
navigator.geolocation.clearWatch = () => {};
```
