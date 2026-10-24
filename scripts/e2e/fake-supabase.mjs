#!/usr/bin/env node
/* A local stand-in for Supabase, for clicking through the whole app end to end without touching production.
 * Runs the real migrations in PGlite (in-process Postgres) and speaks just enough of Supabase's HTTP APIs for
 * supabase-js: GoTrue auth (sign up / password sign-in / refresh / user), PostgREST (table reads with filters,
 * ordering, embeds, single rows; RPC calls) and Storage (upload + signed URLs). RLS and grants apply, as the
 * signed-in user's role. Realtime isn't served — the apps poll.
 *
 *   node scripts/e2e/fake-supabase.mjs          → http://localhost:54321
 *   then run the app with NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321 (see scripts/e2e/README.md)
 *
 * Every account is auto-confirmed. `POST /e2e/admin` {email} makes an account an admin; `POST /e2e/sql` runs SQL
 * as the superuser (test setup only). Data lives in memory and is gone when the process stops. */
import http from "node:http";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";

const PORT = Number(process.env.PORT ?? 54321);
const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

const SHIM = `
  create role anon nologin; create role authenticated nologin; create role service_role nologin;
  create schema auth;
  grant usage on schema auth to anon, authenticated;
  create table auth.users (id uuid primary key, phone text, email text, raw_user_meta_data jsonb, password text);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant execute on function auth.uid() to anon, authenticated;
  grant usage on schema public to anon, authenticated;
`;

const db = new PGlite();
await db.exec(SHIM);
for (const f of readdirSync(join(root, "supabase/migrations")).filter((x) => x.endsWith(".sql")).sort()) {
  await db.exec(readFileSync(join(root, "supabase/migrations", f), "utf8"));
}

/* One connection, so requests run one at a time. */
let chain = Promise.resolve();
const serial = (fn) => { const p = chain.then(fn, fn); chain = p.catch(() => {}); return p; };

const q = (s) => `"${String(s).replace(/"/g, '""')}"`;
const lit = (v) => (v === null ? "null" : `'${String(v).replace(/'/g, "''")}'`);

/** Run `fn` as the caller: anon, or authenticated with auth.uid() = uid. */
async function asUser(uid, fn) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', ${lit(uid ?? "")}, false); set role ${uid ? "authenticated" : "anon"};`);
  try { return await fn(); } finally { await db.exec("reset role; select set_config('request.jwt.claim.sub', '', false);"); }
}

/* ── tokens: unsigned JWT-shaped strings; supabase-js only reads their claims ── */
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const sessions = new Map();   // refresh token → user id
function session(user) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const access_token = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: user.id, email: user.email, role: "authenticated", aud: "authenticated", exp })}.e2e`;
  const refresh_token = randomUUID();
  sessions.set(refresh_token, user.id);
  return { access_token, token_type: "bearer", expires_in: 3600, expires_at: exp, refresh_token, user: userJson(user) };
}
const userJson = (u) => ({
  id: u.id, aud: "authenticated", role: "authenticated", email: u.email, phone: u.phone ?? "", email_confirmed_at: new Date().toISOString(),
  user_metadata: u.raw_user_meta_data ?? {}, app_metadata: { provider: "email" }, created_at: new Date().toISOString(),
});
function uidFrom(req) {
  const t = (req.headers.authorization ?? "").replace(/^Bearer /, "");
  try { const c = JSON.parse(Buffer.from(t.split(".")[1], "base64url").toString()); return c.sub ?? null; } catch { return null; }
}
const findUser = async (where, v) => (await db.query(`select * from auth.users where ${where} = $1`, [v])).rows[0];

/* ── PostgREST: function signatures, cached ── */
const fnCache = new Map();
async function fnInfo(name) {
  if (!fnCache.has(name)) {
    const r = (await db.query(`
      select p.proargnames as names, array(select format_type(t, null) from unnest(p.proargtypes) t) as types,
             p.proargmodes as modes, t.typtype, p.proretset, format_type(p.prorettype, null) as ret
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace join pg_type t on t.oid = p.prorettype
      where n.nspname = 'public' and p.proname = $1`, [name])).rows;
    fnCache.set(name, r);
  }
  return fnCache.get(name);
}

async function callRpc(uid, name, args) {
  const overloads = await fnInfo(name);
  const keys = Object.keys(args);
  const f = overloads.find((o) => keys.every((k) => (o.names ?? []).includes(k))) ?? overloads[0];
  if (!f) throw Object.assign(new Error(`Could not find the function public.${name} in the schema cache`), { code: "PGRST202", status: 404 });
  const inNames = (f.names ?? []).filter((_, i) => !f.modes || f.modes[i] === "i" || f.modes[i] === "b");
  const params = []; const parts = [];
  for (const k of keys) {
    const i = inNames.indexOf(k);
    const type = f.types[i];
    let v = args[k];
    // PostgREST turns a JSON array into a Postgres array for array parameters, and anything else into JSON.
    if (Array.isArray(v) && type?.endsWith("[]")) v = `{${v.map((x) => `"${String(x).replace(/["\\]/g, "\\$&")}"`).join(",")}}`;
    else if (v !== null && typeof v === "object") v = JSON.stringify(v);
    params.push(v);
    parts.push(`${q(k)} := $${params.length}::${type}`);
  }
  const call = `public.${q(name)}(${parts.join(", ")})`;
  const sql = f.ret === "void" ? `select ${call}; ` : f.typtype === "c" || f.proretset ? `select coalesce(jsonb_agg(to_jsonb(t)), '[]') as r from ${call} t`
    : `select to_jsonb(${call}) as r`;
  return asUser(uid, async () => {
    if (f.ret === "void") { await db.query(sql, params); return null; }
    const r = (await db.query(sql, params)).rows[0]?.r ?? null;
    if (f.typtype === "c" && !f.proretset) return r?.[0] ?? null;
    return r;
  });
}

/* ── PostgREST: table reads ── */
const OPS = { eq: "=", neq: "<>", gt: ">", gte: ">=", lt: "<", lte: "<=", like: "like", ilike: "ilike" };
function where(params) {
  const out = []; const vals = [];
  for (const [col, raw] of params) {
    if (["select", "order", "limit", "offset", "columns"].includes(col)) continue;
    const m = /^(not\.)?(\w+)\.(.*)$/s.exec(raw);
    if (!m) continue;
    const [, not, op, val] = m;
    let cond;
    if (op === "is") cond = `${q(col)} is ${val === "null" ? "null" : val === "true" ? "true" : "false"}`;
    else if (op === "in") { const items = val.replace(/^\(|\)$/g, "").split(",").map((x) => x.replace(/^"|"$/g, "")); cond = `${q(col)}::text in (${items.map((x) => { vals.push(x); return `$${vals.length}`; }).join(",")})`; }
    else if (OPS[op]) { vals.push(val); cond = `${q(col)}::text ${OPS[op]} $${vals.length}::text`; if (["gt", "gte", "lt", "lte"].includes(op)) cond = `${q(col)} ${OPS[op]} $${vals.length}`; }
    else continue;
    out.push(not ? `not (${cond})` : cond);
  }
  return { sql: out.length ? `where ${out.join(" and ")}` : "", vals };
}
function selectList(sel, table) {
  // "*", "id,name", or "*, profiles(*)" — embeds join on the shared id (drivers/profiles) or <embed>_id.
  const cols = []; const embeds = [];
  for (const part of (sel || "*").split(/,(?![^(]*\))/).map((s) => s.trim()).filter(Boolean)) {
    const m = /^(\w+)\((.*)\)$/.exec(part);
    if (m) embeds.push(m[1]); else cols.push(part === "*" ? "t.*" : `t.${q(part)}`);
  }
  const extra = embeds.map((e) => `, (select to_jsonb(e) from public.${q(e)} e where e.id = t.id) as ${q(e)}`).join("");
  return `select ${cols.join(", ")}${extra} from public.${q(table)} t`;
}
function orderBy(o) {
  if (!o) return "";
  return "order by " + o.split(",").map((p) => {
    const [col, ...mods] = p.split(".");
    return `${q(col)} ${mods.includes("desc") ? "desc" : "asc"}${mods.includes("nullsfirst") ? " nulls first" : mods.includes("nullslast") ? " nulls last" : ""}`;
  }).join(", ");
}
async function readTable(uid, table, url) {
  const params = [...url.searchParams.entries()];
  const w = where(params);
  const lim = url.searchParams.get("limit");
  const sql = `select coalesce(jsonb_agg(to_jsonb(x)), '[]') as r from (${selectList(url.searchParams.get("select"), table)} ${w.sql} ${orderBy(url.searchParams.get("order"))} ${lim ? `limit ${Number(lim)}` : ""}) x`;
  return asUser(uid, async () => (await db.query(sql, w.vals)).rows[0].r);
}

/* ── Storage (in memory; the app only uploads its own KYC files and asks for signed links) ── */
const files = new Map();

/* ── HTTP ── */
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "Access-Control-Expose-Headers": "Content-Range",
};
const send = (res, status, body, headers = {}) => {
  res.writeHead(status, { "Content-Type": "application/json", ...cors, ...headers });
  res.end(body === undefined ? "" : JSON.stringify(body));
};
const pgError = (res, e) => {
  const code = e.code ?? "P0001";
  const status = e.status ?? (code === "42501" ? 403 : code === "P0002" ? 404 : 400);
  send(res, status, { code, message: e.message, details: e.detail ?? null, hint: e.hint ?? null });
};
const body = (req) => new Promise((ok) => { const c = []; req.on("data", (d) => c.push(d)); req.on("end", () => ok(Buffer.concat(c))); });
const json = (buf) => { try { return buf.length ? JSON.parse(buf.toString()) : {}; } catch { return {}; } };

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return send(res, 204);
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const p = url.pathname;
  const raw = await body(req);
  try {
    await serial(async () => {
      /* auth */
      if (p === "/auth/v1/signup" && req.method === "POST") {
        const b = json(raw);
        const email = String(b.email ?? "").trim().toLowerCase();
        if (await findUser("email", email)) return send(res, 422, { code: 422, error_code: "user_already_exists", msg: "User already registered" });
        const id = randomUUID();
        await db.query(`insert into auth.users (id, email, phone, raw_user_meta_data, password) values ($1, $2, $3, $4, $5)`,
          [id, email, b.phone ?? null, JSON.stringify(b.data ?? {}), b.password]);
        return send(res, 200, session(await findUser("id", id)));
      }
      if (p === "/auth/v1/token" && req.method === "POST") {
        const b = json(raw);
        if (url.searchParams.get("grant_type") === "password") {
          const u = await findUser("email", String(b.email ?? "").trim().toLowerCase());
          if (!u || u.password !== b.password) return send(res, 400, { code: 400, error_code: "invalid_credentials", msg: "Invalid login credentials" });
          return send(res, 200, session(u));
        }
        const id = sessions.get(b.refresh_token);
        if (!id) return send(res, 400, { code: 400, error_code: "refresh_token_not_found", msg: "Invalid Refresh Token" });
        return send(res, 200, session(await findUser("id", id)));
      }
      if (p === "/auth/v1/user") {
        const u = uidFrom(req) && (await findUser("id", uidFrom(req)));
        if (!u) return send(res, 401, { code: 401, msg: "invalid JWT" });
        const b = json(raw);
        if (req.method === "PUT" && b.password) await db.query(`update auth.users set password = $2 where id = $1`, [u.id, b.password]);
        return send(res, 200, userJson(u));
      }
      if (p === "/auth/v1/logout") return send(res, 204);
      if (p === "/auth/v1/recover") return send(res, 200, {});
      if (p === "/auth/v1/settings") return send(res, 200, { external: { email: true }, disable_signup: false, mailer_autoconfirm: true });

      /* rest */
      const rpcM = /^\/rest\/v1\/rpc\/(\w+)$/.exec(p);
      if (rpcM) {
        const args = req.method === "GET" ? Object.fromEntries(url.searchParams) : json(raw);
        return send(res, 200, await callRpc(uidFrom(req), rpcM[1], args));
      }
      const tblM = /^\/rest\/v1\/(\w+)$/.exec(p);
      if (tblM && req.method === "GET") {
        const rows = await readTable(uidFrom(req), tblM[1], url);
        const single = /vnd\.pgrst\.object/.test(req.headers.accept ?? "");
        if (single) {
          if (rows.length !== 1) return send(res, 406, { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned", details: `The result contains ${rows.length} rows`, hint: null });
          return send(res, 200, rows[0]);
        }
        return send(res, 200, rows, { "Content-Range": `0-${Math.max(rows.length - 1, 0)}/*` });
      }

      /* storage */
      const up = /^\/storage\/v1\/object\/([\w-]+)\/(.+)$/.exec(p);
      if (up && (req.method === "POST" || req.method === "PUT") && !p.includes("/sign/")) {
        files.set(`${up[1]}/${decodeURIComponent(up[2])}`, { type: req.headers["content-type"], data: raw });
        return send(res, 200, { Key: `${up[1]}/${up[2]}`, Id: randomUUID() });
      }
      const sign = /^\/storage\/v1\/object\/sign\/([\w-]+)\/(.+)$/.exec(p);
      if (sign) return send(res, 200, { signedURL: `/object/public/${sign[1]}/${sign[2]}?token=e2e` });
      const pub = /^\/storage\/v1\/object\/public\/([\w-]+)\/(.+)$/.exec(p);
      if (pub) {
        const f = files.get(`${pub[1]}/${decodeURIComponent(pub[2])}`);
        if (!f) return send(res, 404, { message: "not found" });
        res.writeHead(200, { "Content-Type": f.type ?? "application/octet-stream", ...cors }); return res.end(f.data);
      }

      /* test helpers */
      if (p === "/e2e/admin" && req.method === "POST") {
        await db.query(`update public.profiles set is_admin = true where id = (select id from auth.users where email = $1)`, [String(json(raw).email).toLowerCase()]);
        return send(res, 200, { ok: true });
      }
      if (p === "/e2e/sql" && req.method === "POST") return send(res, 200, (await db.query(json(raw).sql)).rows);
      if (p === "/rest/v1/" || p === "/") return send(res, 200, { ok: true });

      send(res, 404, { message: `not served by the e2e stand-in: ${req.method} ${p}` });
    });
  } catch (e) {
    pgError(res, e);
  }
});

server.listen(PORT, () => console.log(`fake Supabase (PGlite, real migrations) on http://localhost:${PORT}`));
