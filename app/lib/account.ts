/* Customer & rider accounts in the browser: email + password sign-in plus loading the signed-in person's own data.
 * Everything here runs with the anon key + the user's session, so row-level security decides what comes back. */
import { supabase } from "./supabase/client";
import { prettyPhone, toCustomer, toDriver } from "./mappers";
import type { Customer, Driver, VehicleKind } from "./data";

/** Supabase's messages, reworded where a customer would otherwise see jargon. */
function friendly(message: string) {
  if (/invalid login credentials/i.test(message)) return "Wrong email or password.";
  if (/already registered|already been registered|user already exists/i.test(message)) return "An account with this email already exists — please log in.";
  if (/email not confirmed/i.test(message)) return "Please confirm your email first — check your inbox for the link.";
  if (/password should be|weak password/i.test(message)) return "Choose a stronger password (at least 8 characters).";
  if (/unable to validate email|invalid email|email address .* is invalid/i.test(message)) return "Please enter a valid email address.";
  if (/rate limit|too many|security purposes/i.test(message)) return "Too many attempts — please wait a minute and try again.";
  if (/customers_phone_key|drivers_phone_key/i.test(message)) return "This mobile number is already registered with another account.";
  if (/drivers_plate_key/i.test(message)) return "That vehicle number is already registered.";
  return message;
}

/* ───────── Sign-in ───────── */

export interface SignUp { name: string; email: string; phone: string; password: string }

/** Creates the login (name and mobile ride along as metadata for later profile steps). Returns an error message, or null. */
export async function signUp(p: SignUp) {
  const { data, error } = await supabase.auth.signUp({
    email: p.email.trim(), password: p.password,
    options: { data: { name: p.name.trim(), phone: prettyPhone(p.phone) } },
  });
  if (error) return friendly(error.message);
  // With "Confirm email" switched on, Supabase returns no session until the link is clicked.
  if (!data.session) return "Check your email to confirm your account, then log in.";
  return null;
}

export async function signIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  return error ? friendly(error.message) : null;
}

/** Name, email and mobile given at sign-up — used to prefill profile and KYC steps. */
export async function signUpDetails() {
  const { data } = await supabase.auth.getUser();
  const m = data.user?.user_metadata ?? {};
  return { name: String(m.name ?? ""), email: data.user?.email ?? "", phone: String(m.phone ?? "") };
}

/** The current session's access token — server actions use it to identify the caller. */
export async function accessToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function hasSession() {
  const { data } = await supabase.auth.getSession();
  return !!data.session;
}

export async function signOut() {
  await supabase.auth.signOut();
}

async function uid() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Not signed in");
  return data.user.id;
}

const check = <T,>(res: { data: T; error: { message: string } | null }) => {
  if (res.error) throw new Error(friendly(res.error.message));
  return res.data;
};
/** Like check, for list queries — an empty result is []. */
const list = <T,>(res: { data: T[] | null; error: { message: string } | null }) => check(res) ?? [];

/* ───────── Customers ───────── */

/** The signed-in customer's profile, or null if they haven't set one up yet. */
export async function loadCustomer(): Promise<Customer | null> {
  const row = check(await supabase.from("customers").select("*").eq("user_id", await uid()).maybeSingle());
  return row ? toCustomer(row) : null;
}

/** `phone` is the 10-digit mobile number. */
export async function createCustomer(p: { name: string; email: string; phone: string }): Promise<Customer> {
  const row = check(await supabase.from("customers")
    .insert({ user_id: await uid(), name: p.name.trim(), email: p.email.trim() || null, phone: prettyPhone(p.phone.replace(/\D/g, "").slice(-10)) })
    .select().single());
  return toCustomer(row);
}


/** True when the signed-in login is registered as a rider (used to keep rider logins out of the customer app). */
export async function isRiderLogin() {
  const rows = list(await supabase.from("drivers").select("id").eq("user_id", await uid()).limit(1));
  return rows.length > 0;
}

/* ───────── Riders ───────── */

export async function loadRider(): Promise<Driver | null> {
  const row = check(await supabase.from("drivers").select("*").eq("user_id", await uid()).maybeSingle());
  if (!row) return null;
  const rides = list(await supabase.from("rides").select("driver_id, status, fare, discount").eq("driver_id", row.id));
  return toDriver(row, rides);
}

/** `phone` is the mobile number from sign-up, in either "9876543210" or "+91 98765 43210" form. */
export async function registerRider(k: { name: string; email: string; phone: string; vehicle: VehicleKind; model: string; plate: string; city: string }): Promise<Driver> {
  if (k.phone.replace(/\D/g, "").length < 10) throw new FieldError("Enter your 10-digit mobile number.", "phone");
  const res = await supabase.from("drivers").insert({
    user_id: await uid(), name: k.name.trim(), email: k.email.trim() || null, phone: prettyPhone(k.phone.replace(/\D/g, "").slice(-10)), vehicle: k.vehicle, model: k.model, plate: k.plate.toUpperCase(), city: k.city,
  }).select().single();
  if (res.error) {
    const field = /drivers_phone_key/i.test(res.error.message) ? "phone" : /drivers_plate_key/i.test(res.error.message) ? "plate" : undefined;
    throw new FieldError(friendly(res.error.message), field);
  }
  return toDriver(res.data);
}

/** An error tied to one form field, so the form can jump to it and show the message there. */
export class FieldError extends Error {
  constructor(message: string, readonly field?: "phone" | "plate") { super(message); }
}


/** Returns an error message, or null. RLS refuses "online" for riders who aren't approved. */
export async function setRiderOnline(driverId: string, online: boolean) {
  const { error } = await supabase.from("drivers").update({ online }).eq("id", driverId);
  return error ? error.message : null;
}
