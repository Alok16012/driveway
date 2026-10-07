/* Turn Supabase rows into the shapes the screens use. Shared by the admin loader (server) and the
 * customer/rider apps (browser), so both format dates, names and money the same way. */
/* eslint-disable @typescript-eslint/no-explicit-any -- rows come from an untyped Supabase client */
import type { Customer, Driver, Ride, Ticket, Txn, WalletTxn } from "./data";

/** Share of each fare a driver keeps — mirrors the 20% platform commission. */
export const DRIVER_SHARE = 0.8;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (n: number) => String(n).padStart(2, "0");

/** Timestamps are shown in IST: "28 Sep 2026", "10:38 AM", and "28 Sep, 10:38 AM". */
export function ist(iso: string) {
  const d = new Date(new Date(iso).getTime() + 5.5 * 3600 * 1000);
  const h = d.getUTCHours();
  const day = `${pad(d.getUTCDate())} ${MONTHS[d.getUTCMonth()]}`;
  const time = `${pad(h % 12 || 12)}:${pad(d.getUTCMinutes())} ${h < 12 ? "AM" : "PM"}`;
  return { date: `${day} ${d.getUTCFullYear()}`, time, at: `${day}, ${time}` };
}

export const initials = (name: string) => name.split(/\s+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

/** "9876543210" → "+91 98765 43210" (how phones are stored and shown). */
export const prettyPhone = (tenDigits: string) => `+91 ${tenDigits.slice(0, 5)} ${tenDigits.slice(5)}`;

const net = (r: any) => +r.fare - +r.discount;
const sum = (rows: any[], f: (r: any) => number) => rows.reduce((s, r) => s + f(r), 0);

/** Select string that brings along everything toRide needs. Columns are listed explicitly because signed-in
 * users can't read rides.otp (migration 0007); rides links to drivers twice (driver_id and offered_to), so the
 * driver embed names its foreign key. */
export const RIDE_SELECT =
  "id, service, customer_id, driver_id, vehicle, ac, from_address, to_address, km, min, fare, discount, pay, paid, status, rating, " +
  "cancel_reason, parcel_type, parcel_note, parcel_receiver, parcel_receiver_phone, created_at, wait_fee, " +
  "customer:customers(name), driver:drivers!rides_driver_id_fkey(name), weight:parcel_weights(label)";

export function toRide(r: any): Ride {
  const t = ist(r.created_at);
  return {
    id: r.id, service: r.service, customer: r.customer?.name ?? "—", driver: r.driver?.name ?? "—", vehicle: r.vehicle,
    ac: r.ac ?? undefined, from: r.from_address, to: r.to_address, km: +r.km, min: r.min,
    fare: +r.fare, discount: +r.discount, pay: r.pay, paid: r.paid, status: r.status,
    date: t.date, time: t.time, rating: r.rating ?? undefined, cancelReason: r.cancel_reason ?? undefined,
    parcel: r.service === "parcel" ? {
      type: r.parcel_type, weight: r.weight?.label ?? "", receiver: r.parcel_receiver ?? "",
      receiverPhone: r.parcel_receiver_phone ?? "", note: r.parcel_note ?? undefined,
    } : undefined,
  };
}

/** `rides` are raw ride rows; completed ones count towards trips and earnings. */
export function toDriver(d: any, rides: any[] = []): Driver {
  const mine = rides.filter((r) => r.driver_id === d.id && r.status === "Completed");
  return {
    id: d.id, name: d.name, initials: initials(d.name), phone: d.phone, email: d.email ?? undefined, rating: +d.rating, trips: mine.length,
    vehicle: d.vehicle, model: d.model, plate: d.plate, city: d.city, kyc: d.kyc, online: d.online, suspended: d.suspended,
    joined: ist(d.joined).date, earnings: Math.round(sum(mine, net) * DRIVER_SHARE),
  };
}

export function toCustomer(c: any, rides: any[] = []): Customer {
  const mine = rides.filter((r) => r.customer_id === c.id && r.status === "Completed");
  return {
    id: c.id, name: c.name, initials: initials(c.name), phone: c.phone, email: c.email ?? "", rides: mine.length,
    spent: sum(mine, net), rating: +c.rating, joined: ist(c.joined).date, blocked: c.blocked, complaints: c.complaints,
  };
}

export const toTxn = (t: any): Txn => ({
  id: t.id, kind: t.kind, who: t.who, amount: +t.amount, method: t.method, at: ist(t.created_at).at, ride: t.ride_id ?? undefined,
});

export const toTicket = (t: any): Ticket => ({
  id: t.id, from: t.from_name, role: t.role, subject: t.subject, ride: t.ride_id ?? undefined, status: t.status,
  at: ist(t.created_at).at,
  notes: [...(t.notes ?? [])].sort((a: any, b: any) => a.created_at.localeCompare(b.created_at)).map((n: any) => n.body),
});

export const toWalletTxn = (w: any): WalletTxn => ({ id: w.id, kind: w.kind, note: w.note, amount: +w.amount, at: ist(w.created_at).at });

export interface Feedback { who: string; stars: number; text: string; at: string }

/** "Amit Sharma" → "Amit S." */
export const toFeedback = (f: any): Feedback => {
  const [first, last] = (f.customer?.name ?? "").split(/\s+/);
  return { who: first ? `${first}${last ? ` ${last[0]}.` : ""}` : "A rider", stars: f.stars, text: f.text, at: ist(f.created_at).date };
};
