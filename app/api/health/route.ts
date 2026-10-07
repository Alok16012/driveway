import { supabaseAdmin } from "../../lib/supabase/admin";

/** GET /api/health — confirms the server can reach Supabase with the configured keys. */
export async function GET() {
  try {
    const { error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1 });
    if (error) return Response.json({ supabase: "error", message: error.message }, { status: 502 });
    return Response.json({ supabase: "ok" });
  } catch (e) {
    return Response.json({ supabase: "error", message: (e as Error).message }, { status: 500 });
  }
}
