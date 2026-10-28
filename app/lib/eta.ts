"use client";

import { useEffect, useRef, useState } from "react";
import { distanceM, type LatLng } from "./location";
import { hasOla, olaRoute } from "./olamaps";

/* Live "minutes away" on the road, with traffic, from Ola Maps Directions. To stay well inside Ola's free monthly
 * allowance it asks again only after the vehicle has moved 250 m or 90 s have passed, and counts down in between.
 * Returns null when Ola isn't set up, hasn't answered yet or the destination changed — callers keep their own estimate. */
const REFRESH_MS = 90_000;
const REFRESH_M = 250;

export function useRoadEta(from: LatLng | null | undefined, to: LatLng | null | undefined): number | null {
  const [fix, setFix] = useState<{ mins: number; at: number; origin: LatLng; dest: LatLng } | null>(null);
  const [, setTick] = useState(0);
  const asking = useRef(false);
  const lastTry = useRef<{ at: number; origin: LatLng; dest: LatLng } | null>(null);

  // Re-render every 15 s so the countdown moves even when nothing else does.
  useEffect(() => { const t = setInterval(() => setTick((n) => n + 1), 15_000); return () => clearInterval(t); }, []);

  useEffect(() => {
    if (!from || !to || !hasOla() || asking.current) return;
    const last = lastTry.current;
    const due = !last || distanceM(last.dest, to) > 50 || distanceM(last.origin, from) > REFRESH_M || Date.now() - last.at > REFRESH_MS;
    if (!due) return;
    asking.current = true;
    lastTry.current = { at: Date.now(), origin: from, dest: to };
    void olaRoute(from, to)
      .then((r) => { if (r) setFix({ mins: r.mins, at: Date.now(), origin: from, dest: to }); })
      .finally(() => { asking.current = false; });
  });   // checked on every render (the guard above keeps calls rare); position changes arrive as re-renders

  if (!fix || !to || distanceM(fix.dest, to) > 50) return null;
  return Math.max(1, Math.round(fix.mins - (Date.now() - fix.at) / 60_000));
}
