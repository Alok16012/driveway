"use server";

/* Customer-side server actions for live rides. Each checks the caller's Supabase session (the access
 * token) before touching rides with the service-role key — see lib/rides-server.ts. */
import { saveCustomerProfile, type ProfileInput } from "../lib/profile-server";
import { book, cancelForCustomer, currentForCustomer, historyForCustomer, payForCustomer, rateForCustomer, statusForCustomer, type BookingInput } from "../lib/rides-server";

type Out<T> = { data?: T; error?: string };
const wrap = async <T,>(fn: () => Promise<T>): Promise<Out<T>> => {
  try { return { data: await fn() }; } catch (e) { return { error: e instanceof Error ? e.message : "Something went wrong" }; }
};

export async function bookRide(token: string, b: BookingInput) { return wrap(() => book(token, b)); }
export async function rideStatus(token: string, rideId: string) { return wrap(() => statusForCustomer(token, rideId)); }
export async function cancelRide(token: string, rideId: string, reason: string) { return wrap(() => cancelForCustomer(token, rideId, reason)); }
export async function payRide(token: string, rideId: string) { return wrap(() => payForCustomer(token, rideId)); }
export async function rateRide(token: string, rideId: string, stars: number, tags: string[]) { return wrap(() => rateForCustomer(token, rideId, stars, tags)); }
export async function currentRide(token: string) { return wrap(() => currentForCustomer(token)); }
export async function updateProfile(token: string, p: ProfileInput) { return wrap(() => saveCustomerProfile(token, p)); }
export async function myRides(token: string) { return wrap(() => historyForCustomer(token)); }
