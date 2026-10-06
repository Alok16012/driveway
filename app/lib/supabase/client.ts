import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/* Browser-safe Supabase client (anon key). Row Level Security decides what it can read and write. */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (!url || !anonKey) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local");
  client ??= createClient(url, anonKey);
  return client;
}
