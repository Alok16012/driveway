"use server";

/* Rider-side server actions for live rides. Each checks the caller's Supabase session (the access token)
 * and that they're an approved, active rider — see lib/rides-server.ts. */
import { saveRiderProfile, type ProfileInput } from "../lib/profile-server";
import { acceptForRider, activityForRider, advanceForRider, cancelForRider, collectedForRider, declineForRider, pollForRider } from "../lib/rides-server";

type Out<T> = { data?: T; error?: string };
const wrap = async <T,>(fn: () => Promise<T>): Promise<Out<T>> => {
  try { return { data: await fn() }; } catch (e) { return { error: e instanceof Error ? e.message : "Something went wrong" }; }
};

export async function riderPoll(token: string, watching?: string) { return wrap(() => pollForRider(token, watching)); }
export async function acceptRide(token: string, rideId: string) { return wrap(() => acceptForRider(token, rideId)); }
export async function declineRide(token: string, rideId: string) { return wrap(() => declineForRider(token, rideId)); }
export async function advanceRide(token: string, rideId: string, to: "Arrived" | "Started" | "Completed", opts: { otp?: string; waitFee?: number } = {}) {
  return wrap(() => advanceForRider(token, rideId, to, opts));
}
export async function cashCollected(token: string, rideId: string) { return wrap(() => collectedForRider(token, rideId)); }
export async function cancelTrip(token: string, rideId: string, reason: string) { return wrap(() => cancelForRider(token, rideId, reason)); }
export async function updateRiderProfile(token: string, p: ProfileInput) { return wrap(() => saveRiderProfile(token, p)); }
export async function myActivity(token: string) { return wrap(() => activityForRider(token)); }
