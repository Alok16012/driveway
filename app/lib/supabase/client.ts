import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/* Browser-safe Supabase client (anon key). Row Level Security decides what it can read and write. */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const clients = new Map<string, SupabaseClient>();

/* Customers and riders share one sign-in — it's one DriveWay app with a customer side (/) and a rider side
 * (/rider), and switching sides never asks to log in again. The admin panel keeps its own sign-in.
 * One client per key, since in-app links move between the sides without a reload. */
const SHARED = "driveway-customer-auth";
function storageKey(): string {
  const app = typeof window === "undefined" ? "" : window.location.pathname.split("/")[1];
  if (app === "admin") return "driveway-admin-auth";
  // Riders signed in before the sides were merged kept their session under their own key: carry it over once.
  try {
    const old = localStorage.getItem("driveway-rider-auth");
    if (old) { if (!localStorage.getItem(SHARED)) localStorage.setItem(SHARED, old); localStorage.removeItem("driveway-rider-auth"); }
  } catch { /* storage blocked */ }
  return SHARED;
}

export function supabase(): SupabaseClient {
  if (!url || !anonKey) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local");
  const key = storageKey();
  let client = clients.get(key);
  if (!client) { client = createClient(url, anonKey, { auth: { storageKey: key } }); clients.set(key, client); }
  return client;
}
