"use client";

import { useEffect, useState } from "react";

/* The device's real position, shared by every map on screen. One `watchPosition` runs while anything is
 * subscribed. Works in the browser (HTTPS or localhost only) and in the Capacitor apps, whose WebView asks
 * for the Android/iOS location permission declared in mobile/*. */

export type LatLng = { lat: number; lng: number };
export type DeviceLocation =
  | { status: "locating" }
  | { status: "ok"; pos: LatLng; accuracy: number; at: number }
  | { status: "denied" | "unavailable" | "insecure"; message: string };

/** Kolkata city centre — where maps open before the first GPS fix. */
export const KOLKATA: LatLng = { lat: 22.5726, lng: 88.3639 };

/** Where each place in `public.places` really is. Ids are fixed (rides and coupons point at them). */
export const PLACE_COORDS: Record<string, LatLng> = {
  cur: { lat: 22.553, lng: 88.3525 },        // Park Street
  home: { lat: 22.5765, lng: 88.4318 },      // Salt Lake Sector V
  work: { lat: 22.5806, lng: 88.4627 },      // New Town, Action Area I
  dlf: { lat: 22.5016, lng: 88.3616 },       // South City Mall
  airport: { lat: 22.652, lng: 88.4463 },    // NSCBI Airport
  cp: { lat: 22.5646, lng: 88.351 },         // Esplanade
  botanical: { lat: 22.5675, lng: 88.37 },   // Sealdah Station
  akshardham: { lat: 22.5448, lng: 88.3426 },// Victoria Memorial
  gip: { lat: 22.5392, lng: 88.3654 },       // Quest Mall
};

export const placeCoords = (id: string | undefined | null): LatLng | null => (id && PLACE_COORDS[id]) || null;

let current: DeviceLocation = { status: "locating" };
const listeners = new Set<(l: DeviceLocation) => void>();
let watchId: number | null = null;

function set(l: DeviceLocation) {
  current = l;
  listeners.forEach((f) => f(l));
}

function start() {
  if (watchId !== null || typeof window === "undefined") return;
  if (!window.isSecureContext) {
    set({ status: "insecure", message: "Location needs HTTPS — open the app over https:// or localhost." });
    return;
  }
  if (!("geolocation" in navigator)) {
    set({ status: "unavailable", message: "This device can't share its location." });
    return;
  }
  watchId = navigator.geolocation.watchPosition(
    (p) => set({ status: "ok", pos: { lat: p.coords.latitude, lng: p.coords.longitude }, accuracy: p.coords.accuracy, at: p.timestamp }),
    (e) => {
      // A timeout or a lost fix keeps the last good position on screen.
      if (e.code === e.TIMEOUT && current.status === "ok") return;
      set(e.code === e.PERMISSION_DENIED
        ? { status: "denied", message: "Location is off — allow it for DriveWay in your settings." }
        : { status: "unavailable", message: "Couldn't find your location. Check GPS is on." });
    },
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
  );
}

function stop() {
  if (watchId !== null) navigator.geolocation.clearWatch(watchId);
  watchId = null;
  if (current.status !== "ok") current = { status: "locating" };
}

/** Live device position. `enabled: false` neither starts GPS nor re-renders on fixes. */
export function useDeviceLocation(enabled = true): DeviceLocation {
  const [loc, setLoc] = useState<DeviceLocation>(current);
  useEffect(() => {
    if (!enabled) return;
    listeners.add(setLoc);
    setLoc(current);
    start();
    return () => {
      listeners.delete(setLoc);
      if (listeners.size === 0) stop();
    };
  }, [enabled]);
  return loc;
}

/** Ask again after the person turns location back on. */
export function retryLocation() {
  stop();
  set({ status: "locating" });
  if (listeners.size) start();
}

/** Metres between two points (haversine). */
export function distanceM(a: LatLng, b: LatLng): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const s = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(s));
}

/* Street address for a point, from OpenStreetMap Nominatim. Its usage policy allows ~1 request a second,
 * so results are cached and only looked up again after moving 150 m. */
const geoCache: { pos: LatLng; address: string }[] = [];

export async function reverseGeocode(pos: LatLng): Promise<string | null> {
  const hit = geoCache.find((c) => distanceM(c.pos, pos) < 150);
  if (hit) return hit.address;
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=17&addressdetails=1&lat=${pos.lat}&lon=${pos.lng}`,
      { headers: { "Accept-Language": "en" } });
    if (!res.ok) return null;
    const j = await res.json();
    const a = j.address ?? {};
    const parts = [a.road ?? a.pedestrian ?? a.neighbourhood, a.suburb ?? a.quarter ?? a.city_district, a.city ?? a.town ?? a.village ?? a.state_district]
      .filter((x, i, all): x is string => !!x && all.indexOf(x) === i);
    const address = parts.length ? parts.join(", ") : (j.display_name as string | undefined)?.split(",").slice(0, 3).join(",") ?? null;
    if (address) geoCache.push({ pos, address });
    return address;
  } catch { return null; }
}

/** Address of where the device is now; null until both a fix and a lookup succeed. */
export function useCurrentAddress(enabled = true): { loc: DeviceLocation; address: string | null } {
  const loc = useDeviceLocation(enabled);
  const [address, setAddress] = useState<string | null>(null);
  const pos = loc.status === "ok" ? loc.pos : null;
  const lat = pos ? Math.round(pos.lat * 1000) / 1000 : null;   // ~100 m buckets, so walking doesn't refetch every fix
  const lng = pos ? Math.round(pos.lng * 1000) / 1000 : null;
  useEffect(() => {
    if (lat === null || lng === null) return;
    let live = true;
    void reverseGeocode({ lat, lng }).then((a) => { if (live && a) setAddress(a); });
    return () => { live = false; };
  }, [lat, lng]);
  return { loc, address };
}
