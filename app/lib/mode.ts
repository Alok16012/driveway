"use client";

/* One DriveWay app for customers and riders: the side the person last used opens next time.
 * Kept on the device only; the login is shared, so switching never asks to sign in again. */
export type AppMode = "customer" | "rider";
const KEY = "driveway-mode";

export function savedMode(): AppMode | null {
  try { const v = localStorage.getItem(KEY); return v === "rider" || v === "customer" ? v : null; } catch { return null; }
}
export function saveMode(m: AppMode) {
  try { localStorage.setItem(KEY, m); } catch { /* storage blocked: the app opens on the customer side */ }
}

/** The launch animation plays once per app start, not again when switching between the customer and rider side. */
let introPlayed = false;
export const firstIntro = () => { const first = !introPlayed; introPlayed = true; return first; };
