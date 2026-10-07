/* Admin sign-in: one shared admin account from env vars, kept in a signed httpOnly cookie.
 * Stand-in until Supabase Auth with roles replaces it (step 3). */
import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

const COOKIE = "rw_admin";
const MAX_AGE = 60 * 60 * 12; // 12 hours

const secret = () => {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (!s) throw new Error("ADMIN_SESSION_SECRET is not set");
  return s;
};
const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

const same = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

export function checkCredentials(email: string, password: string) {
  const e = process.env.ADMIN_EMAIL, p = process.env.ADMIN_PASSWORD;
  if (!e || !p) return false;
  return same(email.trim().toLowerCase(), e.toLowerCase()) && same(password, p);
}

export async function startSession() {
  const exp = String(Math.floor(Date.now() / 1000) + MAX_AGE);
  (await cookies()).set(COOKIE, `${exp}.${sign(exp)}`, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: MAX_AGE,
  });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

export async function isAdmin() {
  const v = (await cookies()).get(COOKIE)?.value;
  if (!v) return false;
  const [exp, sig] = v.split(".");
  return !!exp && !!sig && same(sig, sign(exp)) && Number(exp) > Date.now() / 1000;
}

/** Call at the top of every admin server action — they are reachable by direct POST. */
export async function requireAdmin() {
  if (!(await isAdmin())) throw new Error("Not signed in as admin");
}
