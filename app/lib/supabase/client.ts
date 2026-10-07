/* Browser-side Supabase client — uses the public anon key, so every query is subject to RLS.
 * The customer app (/) and the rider app (/rider) share one origin, so each keeps its sign-in under its own
 * storage key; otherwise logging in to one app in another tab silently swaps the other app's user. */
import { createClient } from "@supabase/supabase-js";

const app = typeof window !== "undefined" && window.location.pathname.startsWith("/rider") ? "rider" : "customer";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { storageKey: `driveway-${app}-auth` } },
);
