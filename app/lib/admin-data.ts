/* Loads everything the admin panel lists — rides, drivers, customers, transactions, tickets — with the
 * service-role key. Server-only; the admin page calls this only after isAdmin(). */
import "server-only";
import { supabaseAdmin } from "./supabase/admin";
import { RIDE_SELECT, toCustomer, toDriver, toRide, toTicket, toTxn } from "./mappers";
import type { Customer, Driver, Ride, Ticket, Txn } from "./data";

export interface AdminData { rides: Ride[]; drivers: Driver[]; customers: Customer[]; txns: Txn[]; tickets: Ticket[] }

export async function getAdminData(): Promise<AdminData> {
  const db = supabaseAdmin;
  const [rides, drivers, customers, txns, tickets] = await Promise.all([
    db.from("rides").select(RIDE_SELECT).order("created_at", { ascending: false }),
    db.from("drivers").select("*").order("id"),
    db.from("customers").select("*").order("id"),
    db.from("transactions").select("*").order("created_at", { ascending: false }),
    db.from("tickets").select("*, notes:ticket_notes(body, created_at)").order("created_at", { ascending: false }),
  ]);
  const err = [rides, drivers, customers, txns, tickets].find((r) => r.error)?.error;
  if (err) throw new Error(`Couldn't load admin data from Supabase: ${err.message}`);

  return {
    rides: rides.data!.map(toRide),
    drivers: drivers.data!.map((d) => toDriver(d, rides.data!)),
    customers: customers.data!.map((c) => toCustomer(c, rides.data!)),
    txns: txns.data!.map(toTxn),
    tickets: tickets.data!.map(toTicket),
  };
}
