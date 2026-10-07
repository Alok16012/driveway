/* Server-only Supabase client with the service-role key — bypasses RLS.
 * Import only from server code (route handlers, server actions); `server-only` fails the build otherwise. */
import "server-only";
import { createClient } from "@supabase/supabase-js";

const missing = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"].filter((k) => !process.env[k]);
if (missing.length) throw new Error(`Missing ${missing.join(" and ")} in .env.local (copy .env.example, fill it in, then restart npm run dev).`);

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
