/* Isolated Postgres (PGlite, in-process) with a minimal Supabase shim: auth.users, auth.uid(),
 * and the anon / authenticated roles. Loads the real migration so tests exercise production SQL. */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";

const SHIM = `
  create role anon nologin; create role authenticated nologin; create role service_role nologin;
  create schema auth;
  grant usage on schema auth to anon, authenticated;
  create table auth.users (id uuid primary key, phone text, email text);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant execute on function auth.uid() to anon, authenticated;
  grant usage on schema public to anon, authenticated;
`;

export type Db = Awaited<ReturnType<typeof createDb>>;

export async function createDb() {
  const db = new PGlite();
  await db.exec(SHIM);
  const dir = join(__dirname, "../../supabase/migrations");
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) await db.exec(readFileSync(join(dir, f), "utf8"));

  let phoneSeq = 9000000000;
  const setUser = async (uid: string | null) =>
    db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid ?? ""}', false); set role ${uid ? "authenticated" : "anon"};`);

  /** Run SQL as a signed-in user (or anon when uid is null). RLS and grants apply. */
  async function as<T = Record<string, unknown>>(uid: string | null, sql: string, params: unknown[] = []) {
    await setUser(uid);
    try { return (await db.query<T>(sql, params)).rows; } finally { await db.exec("reset role"); }
  }
  /** Call a public function as a user and return its single result. */
  async function rpc<T = any>(uid: string | null, fn: string, ...args: unknown[]): Promise<T> {
    const ph = args.map((_, i) => `$${i + 1}`).join(", ");
    const rows = await as<{ r: T }>(uid, `select public.${fn}(${ph}) as r`, args.map((a) => (a !== null && typeof a === "object" && !Array.isArray(a) ? JSON.stringify(a) : a)));
    return rows[0].r;
  }
  /** Superuser SQL (test setup / time travel only). */
  const admin = async <T = any>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows;

  async function user(opts: { admin?: boolean; name?: string; email?: string } = {}) {
    const id = randomUUID(); const phone = opts.email ? null : `91${++phoneSeq}`;
    await admin(`insert into auth.users (id, phone, email) values ($1, $2, $3)`, [id, phone, opts.email ?? null]);
    await admin(`update public.profiles set name = $2, is_admin = $3 where id = $1`, [id, opts.name ?? "Test User", !!opts.admin]);
    return id;
  }
  /** An approved, online driver. */
  async function driver(vehicle = "bike", extra: { ac?: boolean; approve?: boolean; online?: boolean } = {}) {
    const id = await user({ name: "Test Driver" });
    await rpc(id, "register_driver", { name: "Test Driver", vehicle, model: "Test Model", plate: `TS${Math.floor(Math.random() * 1e8)}`, ac: !!extra.ac, city: "Noida",
      docs: Object.fromEntries(["photo", "licence", "rc", "insurance", "aadhaar"].map((k) => [k, `${id}/${k}.jpg`])) });
    if (extra.approve !== false) await admin(`update public.drivers set kyc = 'Approved' where id = $1`, [id]);
    if (extra.approve !== false && extra.online !== false) await rpc(id, "set_online", true);
    return id;
  }
  const idem = () => randomUUID();
  const book = (uid: string, p: Record<string, unknown>) =>
    rpc(uid, "book_ride", { from: "cur", to: "dlf", ac: true, pay: "UPI", idem: idem(), ...p });
  const otpOf = async (rideId: string) => (await admin(`select otp from public.ride_otps where ride_id = $1`, [rideId]))[0].otp as string;
  const ledger = (rideId: string) => admin(`select kind, amount, user_id from public.ledger where ride_id = $1 order by id`, [rideId]);
  const ride = async (rideId: string) => (await admin(`select * from public.rides where id = $1`, [rideId]))[0];

  return { db, as, rpc, admin, user, driver, idem, book, otpOf, ledger, ride };
}

/** Expect a promise to reject with a message matching `re`. */
export async function rejects(p: Promise<unknown>, re: RegExp) {
  try { await p; } catch (e) { const m = (e as Error).message; if (!re.test(m)) throw new Error(`expected error ${re}, got: ${m}`); return m; }
  throw new Error(`expected error ${re}, but it succeeded`);
}
