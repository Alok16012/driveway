"use client";

/* Typed client for the DriveWay backend (Supabase Auth + Postgres functions in
 * supabase/migrations). The browser never computes prices or changes ride state itself:
 * every action is a server function that checks who is calling and what is allowed. */

import type { RealtimeChannel, Session } from "@supabase/supabase-js";
import { supabase } from "./supabase/client";
import type { PayMethod, RideStatus, VehicleKind } from "./data";

/* ───────────── Types returned by the server ───────────── */

export interface PlaceRef { id: string; name: string; address: string }
export interface Place extends PlaceRef { kind: "home" | "work" | "recent" | "current" | null }
export interface FareLine { label: string; amount: number }
export interface CouponResult { ok: boolean; reason?: string; discount?: number; code?: string; title?: string }

export interface QuoteOption {
  id: VehicleKind; name: string; tagline: string; seats: number; ac: boolean; eta: number; cancel_fee: number;
  fare: number; alt_fare: number; lines: FareLine[]; available: number; discount: number; coupon: CouponResult | null;
}
export interface RentalQuote { pkg: string; hours: number; km: number; extra_km: number; extra_hour: number; car: VehicleKind; fare: number; discount: number; coupon: CouponResult | null; available: number }
export interface ParcelQuote { id: "light" | "medium" | "heavy"; label: string; sub: string; vehicle: VehicleKind; fee: number; fare: number; discount: number; coupon: CouponResult | null; available: number }
export interface Quote { km: number; mins: number; options: QuoteOption[]; any: QuoteOption | null; any_available: number; rentals: RentalQuote[]; parcels: ParcelQuote[] }

export type PaymentStatus = "unpaid" | "pending" | "paid" | "refunded" | "partially_refunded";
export interface RideView {
  id: string; code: string; status: RideStatus; service: "ride" | "any" | "rental" | "parcel";
  vehicle: VehicleKind; requested: VehicleKind[]; ac: boolean; from: PlaceRef; to: PlaceRef; km: number; mins: number;
  fare: number; discount: number; coupon: string | null; wait_fee: number; cancel_fee: number; total: number;
  pay: PayMethod; payment_status: PaymentStatus; refunded: number; scheduled_for: string | null;
  passenger: { name: string; phone: string } | null;
  parcel: { type: string; weight: string; weight_label: string; receiver: { name: string; phone: string }; note: string; sender: { name: string; phone: string } } | null;
  rental: { pkg: string; hours: number; km: number; extra_km: number; extra_hour: number } | null;
  cancel_reason: string | null; cancelled_by: string | null; rating: number | null;
  created_at: string; assigned_at: string | null; arrived_at: string | null; started_at: string | null; completed_at: string | null;
  search_timeout_sec: number; free_wait_sec: number; wait_fee_per_min: number; commission_pct: number; cancel_fee_now: number;
  otp?: string | null;
  driver: { name: string; vehicle: VehicleKind; model: string; plate: string; rating: number | null; trips: number; phone: string | null } | null;
  customer: { name: string; rating: number | null; phone: string | null } | null;
  earn?: number;   // driver offers only
}

export interface Profile {
  id: string; name: string; email: string | null; phone: string | null; rating: number | null; blocked: boolean;
  is_admin: boolean; is_driver: boolean; completed: number; wallet: number;
}
export interface Txn { id: number; kind: string; amount: number; note: string | null; at: string }
export interface Incentive { id: string; title: string; body: string; kind: "today" | "peak" | "week"; target: number; reward: number; progress: number }
export interface DriverMe {
  id: string; name: string; vehicle: VehicleKind; model: string; plate: string; ac: boolean; city: string;
  kyc: "Pending" | "Approved" | "Rejected"; kyc_note: string | null; upi: string | null; suspended: boolean; online: boolean;
  rating: number | null; trips: number; offers_accepted: number; offers_declined: number; cancellations: number;
  phone: string | null; balance: number; commission_pct: number; free_wait_sec: number; wait_fee_per_min: number;
  min_payout: number; payout_fee: number; today: { trips: number; earnings: number }; week_trips: number;
  earnings: { week: number; month: number; incentives_week: number }; incentives: Incentive[]; txns: Txn[];
}
export interface CouponRow {
  code: string; title: string; body: string; off: number; pct: boolean; max_off: number | null; min_fare: number;
  expires_at: string; active: boolean; uses: number; total_limit: number | null; per_user_limit: number;
}

/* ───────────── Plumbing ───────────── */

/** Turn a Postgres/Supabase error into one sentence a user can act on. */
export function friendly(e: unknown): string {
  const m = (e as { message?: string })?.message ?? String(e);
  if (/Failed to fetch|NetworkError|network/i.test(m)) return "No connection — check your internet and try again.";
  if (/JWT|not signed in|session/i.test(m)) return "Your session has expired. Please sign in again.";
  if (/check constraint|violates/i.test(m)) return "That value isn't allowed.";
  if (/phone provider|sms provider/i.test(m)) return "SMS sign-in isn't switched on yet — please try again later.";
  if (/rate limit|too many/i.test(m)) return "Too many attempts. Please wait a minute and try again.";
  if (/could not find the function|schema cache|relation .* does not exist/i.test(m)) return "DriveWay is being set up — please try again shortly.";
  return m.replace(/^coupon: /, "").replace(/^(ERROR:\s*)/, "").replace(/^./, (c) => c.toUpperCase());
}

export async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase().rpc(fn, args);
  if (error) throw new Error(friendly(error));
  return data as T;
}

/** A random key so a retried request (double tap, lost response) is applied once. */
export const newKey = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`.slice(0, 40));

/* ───────────── Auth (phone OTP for customers and drivers, email for admins) ───────────── */

export const isIndianMobile = (p: string) => /^[6-9]\d{9}$/.test(p);
const e164 = (p: string) => `+91${p}`;

export async function sendOtp(phone10: string) {
  if (!isIndianMobile(phone10)) throw new Error("Enter a valid 10-digit Indian mobile number.");
  const { error } = await supabase().auth.signInWithOtp({ phone: e164(phone10) });
  if (error) throw new Error(friendly(error));
}
export async function verifyOtp(phone10: string, token: string) {
  const { error } = await supabase().auth.verifyOtp({ phone: e164(phone10), token, type: "sms" });
  if (error) throw new Error(/expired|invalid/i.test(error.message) ? "That code is wrong or has expired." : friendly(error));
}
export async function adminSignIn(email: string, password: string) {
  const { error } = await supabase().auth.signInWithPassword({ email, password });
  if (error) throw new Error("Wrong email or password.");
  const me = await myProfile();
  if (!me?.is_admin) { await signOut(); throw new Error("This account doesn't have admin access."); }
  return me;
}
export const signOut = async () => { await supabase().auth.signOut(); };
export async function getSession(): Promise<Session | null> {
  const { data } = await supabase().auth.getSession();
  return data.session;
}
export function onAuthChange(cb: (signedIn: boolean) => void) {
  const { data } = supabase().auth.onAuthStateChange((_e, s) => cb(!!s));
  return () => data.subscription.unsubscribe();
}

/* ───────────── Reference data ───────────── */

export async function places(): Promise<Place[]> {
  const { data, error } = await supabase().from("places").select("id,name,address,kind").order("kind", { nullsFirst: false });
  if (error) throw new Error(friendly(error));
  return data as Place[];
}
export async function activeCoupons(): Promise<CouponRow[]> {
  const { data, error } = await supabase().from("coupons").select("*").eq("active", true).gt("expires_at", new Date().toISOString()).order("expires_at");
  if (error) throw new Error(friendly(error));
  return data as CouponRow[];
}

/* ───────────── Customer ───────────── */

export const myProfile = () => rpc<Profile | null>("my_profile");
export const updateMyProfile = (name: string, email: string) => rpc<void>("update_my_profile", { p_name: name, p_email: email });
export const quote = (from: string, to: string, ac: boolean, coupon: string | null) =>
  rpc<Quote>("quote", { p_from: from, p_to: to, p_ac: ac, p_coupon: coupon });

export interface BookRequest {
  option: string; from: string; to: string; ac: boolean; pay: PayMethod; coupon: string | null; when: string | null;
  passenger?: { name: string; phone: string } | null;
  parcel?: { type: string; weight: string; receiver: { name: string; phone: string }; note: string };
  rental?: { pkg: string; car: VehicleKind };
  idem: string;
}
export const bookRide = (p: BookRequest) => rpc<{ id: string; code: string; status: RideStatus; duplicate: boolean }>("book_ride", { p });
export const myActiveRide = () => rpc<RideView | null>("my_active_ride");
export const myRides = () => rpc<RideView[]>("my_rides");
export const cancelRide = (id: string, reason: string) => rpc<RideView>("cancel_ride", { p_ride: id, p_reason: reason });
export const payRide = (id: string, method: Exclude<PayMethod, "Cash">) => rpc<RideView>("pay_ride", { p_ride: id, p_method: method });
export const rateRide = (id: string, stars: number, tags: string[]) => rpc<void>("rate_ride", { p_ride: id, p_stars: stars, p_tags: tags });
export const closeRide = (id: string) => rpc<void>("close_ride", { p_ride: id });
export const myWallet = () => rpc<{ balance: number; txns: Txn[] }>("my_wallet");
export const supportMessage = (body: string, role: "Customer" | "Driver", ride: string | null = null) =>
  rpc<{ id: string; code: string; status: string }>("support_message", { p_body: body, p_role: role, p_ride: ride });

/* ───────────── Driver ───────────── */

export interface DriverApplication {
  name: string; city: string; vehicle: VehicleKind; model: string; plate: string; ac: boolean;
  docs: Record<"photo" | "licence" | "rc" | "insurance" | "aadhaar", string>;   // storage paths in the driver-docs bucket
  upi: string;
}
export const registerDriver = (p: DriverApplication) => rpc<unknown>("register_driver", { p });
export const myDriver = () => rpc<DriverMe | null>("my_driver");
export const setOnline = (online: boolean) => rpc<{ online: boolean }>("set_online", { p_online: online });
export const driverOffers = () => rpc<RideView[]>("driver_offers");
export const acceptRide = (id: string) => rpc<RideView>("accept_ride", { p_ride: id });
export const declineRide = (id: string) => rpc<void>("decline_ride", { p_ride: id });
export const myTrip = () => rpc<RideView | null>("my_trip");
export const driverArrived = (id: string) => rpc<RideView>("driver_arrived", { p_ride: id });
export const startRide = (id: string, otp: string) => rpc<RideView & { error?: "wrong_otp"; attempts_left?: number }>("start_ride", { p_ride: id, p_otp: otp });
export const completeRide = (id: string) => rpc<RideView>("complete_ride", { p_ride: id });
export const confirmCash = (id: string) => rpc<RideView>("confirm_cash", { p_ride: id });
export const rateCustomer = (id: string, stars: number) => rpc<void>("rate_customer", { p_ride: id, p_stars: stars });
export const driverCloseRide = (id: string) => rpc<void>("driver_close_ride", { p_ride: id });
export const driverCancelRide = (id: string, reason: string) => rpc<void>("driver_cancel_ride", { p_ride: id, p_reason: reason });
export const myDriverTrips = () => rpc<RideView[]>("my_driver_trips");
export const requestPayout = (idem: string) => rpc<{ paid_out?: number; fee?: number; duplicate?: boolean }>("request_payout", { p_idem: idem });
export const payDues = (idem: string) => rpc<{ cleared: number }>("pay_dues", { p_idem: idem });
export const updateMyUpi = (upi: string) => rpc<void>("update_my_upi", { p_upi: upi });

/* ───────────── Live updates ───────────── */

/** Calls `onChange` whenever a ride row visible to this user changes (RLS applies). */
export function watchRides(onChange: () => void): () => void {
  const ch: RealtimeChannel = supabase().channel(`rides-${newKey()}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "rides" }, () => onChange())
    .subscribe();
  return () => { void supabase().removeChannel(ch); };
}

/** Calls `onResume` when the app comes back to the foreground. Phones pause background tabs and apps
 *  (timers and the realtime socket included), so without this a returning user sees stale state until the next poll. */
export function watchResume(onResume: () => void): () => void {
  const handler = () => { if (document.visibilityState === "visible") onResume(); };
  document.addEventListener("visibilitychange", handler);
  return () => document.removeEventListener("visibilitychange", handler);
}

/* ───────────── Formatting ───────────── */

export const fmtWhen = (iso: string) => {
  const d = new Date(iso); const now = new Date();
  const day = d.toDateString() === now.toDateString() ? "Today"
    : d.toDateString() === new Date(now.getTime() - 864e5).toDateString() ? "Yesterday"
    : d.toDateString() === new Date(now.getTime() + 864e5).toDateString() ? "Tomorrow"
    : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
  return `${day}, ${d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })}`;
};

/** "Sedan · AC", "Parcel · Bike", "Rental 2 hr · Mini", "Book Any · AC". */
export function rideLabel(r: Pick<RideView, "service" | "vehicle" | "ac" | "rental" | "assigned_at">, vehicleName: string) {
  if (r.service === "parcel") return `Parcel · ${vehicleName}`;
  if (r.service === "rental" && r.rental) return `Rental ${r.rental.hours} hr · ${vehicleName}`;
  if (r.service === "any" && !r.assigned_at) return `Book Any · ${r.ac ? "AC" : "Non-AC"}`;
  return ["bike", "auto", "erick"].includes(r.vehicle) ? vehicleName : `${vehicleName} · ${r.ac ? "AC" : "Non-AC"}`;
}
