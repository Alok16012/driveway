import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/* Browser-safe Supabase client (anon key). Row Level Security decides what it can read and write. */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const clients = new Map<string, SupabaseClient>();

/* Each app keeps its own sign-in, so being logged in to one of /admin, /rider or the customer app (at / and
 * /customer) never signs you in to another. One client per app, since in-app links move between them without a reload. */
function storageKey(): string {
  const app = typeof window === "undefined" ? "" : window.location.pathname.split("/")[1];
  return `driveway-${app === "rider" || app === "admin" ? app : "customer"}-auth`;
}

export function supabase(): SupabaseClient {
  if (!url || !anonKey) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local");
  const key = storageKey();
  let client = clients.get(key);
  if (!client) { client = createClient(url, anonKey, { auth: { storageKey: key } }); clients.set(key, client); }
  return client;
}
