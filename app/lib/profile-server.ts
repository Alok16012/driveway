/* Profile edits for customers and riders, server-only. Called from server actions after the caller's
 * session token is checked; validates input and writes with the service-role key. */
import "server-only";
import { supabaseAdmin as db } from "./supabase/admin";
import { prettyPhone, toCustomer, toDriver } from "./mappers";

export interface ProfileInput { name: string; email: string; phone: string; city?: string }

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function userId(token: string) {
  const { data } = await db.auth.getUser(String(token));
  if (!data.user) throw new Error("Please log in again");
  return data.user.id;
}

/** Trims and checks the fields every profile shares; returns them ready to store. */
function clean(p: ProfileInput) {
  const name = String(p.name ?? "").trim().replace(/\s+/g, " ");
  const email = String(p.email ?? "").trim();
  const digits = String(p.phone ?? "").replace(/\D/g, "").slice(-10);
  if (name.length < 2 || name.length > 60) throw new Error("Enter your full name");
  if (email && !EMAIL.test(email)) throw new Error("Enter a valid email address");
  if (digits.length !== 10) throw new Error("Enter a 10-digit mobile number");
  return { name, email: email || null, phone: prettyPhone(digits) };
}

const friendly = (message: string) =>
  /phone_key/i.test(message) ? "This mobile number is already used by another account." : message;

export async function saveCustomerProfile(token: string, p: ProfileInput) {
  const uid = await userId(token);
  const { data, error } = await db.from("customers").update(clean(p)).eq("user_id", uid).select().maybeSingle();
  if (error) throw new Error(friendly(error.message));
  if (!data) throw new Error("Profile not found");
  return toCustomer(data);
}

export async function saveRiderProfile(token: string, p: ProfileInput) {
  const uid = await userId(token);
  const city = String(p.city ?? "").trim();
  if (city.length < 2 || city.length > 40) throw new Error("Choose your city");
  const { data, error } = await db.from("drivers").update({ ...clean(p), city }).eq("user_id", uid).select().maybeSingle();
  if (error) throw new Error(friendly(error.message));
  if (!data) throw new Error("Rider profile not found");
  const { data: done } = await db.from("rides").select("driver_id, status, fare, discount").eq("driver_id", data.id).eq("status", "Completed");
  return toDriver(data, done ?? []);
}
