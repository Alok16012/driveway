import { supabaseAdmin } from "../../lib/supabase/admin";

/** Per-instance limiter: at most 30 checks a minute per client address. */
const WINDOW_MS = 60_000;
const LIMIT = 30;
const hits = new Map<string, number[]>();

function limited(key: string) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.clear();          // bound memory
  return recent.length > LIMIT;
}

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** GET /api/health — confirms the database is reachable. Reads one public config row; never user data. */
export async function GET(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (limited(ip)) return json({ supabase: "rate_limited" }, 429);
  try {
    const { error } = await supabaseAdmin().from("settings").select("id").limit(1);
    if (error) {
      console.error("[health] supabase error:", error.message);
      return json({ supabase: "error" }, 502);
    }
    return json({ supabase: "ok" });
  } catch (e) {
    console.error("[health] failure:", (e as Error).message);
    return json({ supabase: "error" }, 500);
  }
}
