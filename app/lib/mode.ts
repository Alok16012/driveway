"use client";

/* On the website the customer side (/) and the DriveWay Partner side (/rider) link to each other and share one
 * login. On phones they are separate apps. The last side used is noted on the device for future use. */
export type AppMode = "customer" | "rider";
const KEY = "driveway-mode";

export function saveMode(m: AppMode) {
  try { localStorage.setItem(KEY, m); } catch { /* storage blocked */ }
}

/** The launch animation plays once per page load, not again when moving between the two sides. */
let introPlayed = false;
export const firstIntro = () => { const first = !introPlayed; introPlayed = true; return first; };
