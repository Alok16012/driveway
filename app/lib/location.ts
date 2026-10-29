"use client";

import { useEffect, useRef, useState } from "react";
import { Capacitor, registerPlugin } from "@capacitor/core";
import type { GeolocationPlugin } from "@capacitor/geolocation";
import { googleReverseGeocode, hasGoogle } from "./google";
import { hasOla, olaReverseGeocode } from "./olamaps";

/* The device's real position, shared by every map on screen. One watch runs while anything is subscribed.
 * In the Android/iOS apps it comes from @capacitor/geolocation — Google's Fused Location Provider (GPS + Wi-Fi +
 * cell towers) on Android and Core Location on iOS — which is much sharper than the WebView's own geolocation.
 * In a browser (HTTPS or localhost only) it is navigator.geolocation. */

// Kept on globalThis so a dev hot reload doesn't register the plugin twice.
const gg = globalThis as { __drivewayGeo?: GeolocationPlugin };
const NativeGeo = (gg.__drivewayGeo ??= registerPlugin<GeolocationPlugin>("Geolocation"));
const nativeGps = () => Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("Geolocation");

export type LatLng = { lat: number; lng: number };
export type DeviceLocation =
  | { status: "locating" }
  | { status: "ok"; pos: LatLng; accuracy: number; at: number }
  | { status: "denied" | "unavailable" | "insecure"; message: string };

/** Middle of India — where maps open, zoomed out, before the first GPS fix. */
export const INDIA_CENTER: LatLng = { lat: 22.35, lng: 78.67 };

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

/** The fixed places within `km` of the phone (plus "Current location"). They are all in the first launch
 *  city, so someone in another city shouldn't be offered them. Until there's a fix, everything is kept. */
export function nearbyPlaces<T extends { id: string; kind?: string | null }>(places: T[], pos: LatLng | null, km = 60): T[] {
  if (!pos) return places;
  return places.filter((p) => { const c = placeCoords(p.id); return p.kind === "current" || !c || distanceM(pos, c) <= km * 1000; });
}

/** Where a ride's place really is: its GPS pickup when it has one, else the fixed place. */
export const placePos = (p: { id: string; lat?: number; lng?: number } | undefined | null): LatLng | null =>
  p && typeof p.lat === "number" && typeof p.lng === "number" ? { lat: p.lat, lng: p.lng } : placeCoords(p?.id);

let current: DeviceLocation = { status: "locating" };
const listeners = new Set<(l: DeviceLocation) => void>();
let running = false;
let gen = 0;                                  // bumped on stop, so a slow permission prompt can't revive a stopped watch
let stops: (() => void)[] = [];

function set(l: DeviceLocation) {
  current = l;
  listeners.forEach((f) => f(l));
}

const OFF = "Location is off — allow it for DriveWay in your settings.";
const NO_FIX = "Couldn't find your location. Check GPS is on.";

/** A fix from any source. With two sources running, keep the sharper one unless ours is getting old, and hold
 *  the pin still while new fixes only wobble within GPS error — so the address doesn't keep flipping. */
function onFix(lat: number, lng: number, accuracy: number, at: number) {
  if (current.status === "ok") {
    const moved = distanceM(current.pos, { lat, lng });
    const sharper = accuracy < current.accuracy * 0.7;
    if (!sharper && moved < Math.max(15, accuracy)) { current = { ...current, at }; return; }   // same spot, still fresh
    if (accuracy > current.accuracy * 1.5 && Date.now() - current.at < 10_000) return;
  }
  set({ status: "ok", pos: { lat, lng }, accuracy, at });
}

/** Ask Android for location at most once per app session: someone who picked "Approximate" (or declined) isn't
 *  shown the system prompt again every time a screen with a map opens. */
let asked = false;

/** The browser's / WebView's own geolocation (Android LocationManager inside the apps). */
function watchBrowser(reportErrors: boolean) {
  if (!("geolocation" in navigator)) return false;
  const id = navigator.geolocation.watchPosition(
    (p) => onFix(p.coords.latitude, p.coords.longitude, p.coords.accuracy, p.timestamp),
    (e) => {
      // A timeout or a lost fix keeps the last good position on screen.
      if (!reportErrors || current.status === "ok") return;
      if (e.code === e.TIMEOUT) return;
      set(e.code === e.PERMISSION_DENIED ? { status: "denied", message: OFF } : { status: "unavailable", message: NO_FIX });
    },
    { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },   // fresh fixes only: a cached one can be from another place
  );
  stops.push(() => navigator.geolocation.clearWatch(id));
  return true;
}

/** The app builds: ask for precise location, then watch two sources at once — @capacitor/geolocation (Google's
 *  fused provider) and the WebView's geolocation (Android LocationManager). Phones whose Google location service is
 *  missing or broken (Huawei, de-Googled or outdated Play services) still get fixes from the second. */
async function startNative(g: number) {
  try {
    let perm = await NativeGeo.checkPermissions();
    if (perm.location !== "granted" && !asked) { asked = true; perm = await NativeGeo.requestPermissions({ permissions: ["location", "coarseLocation"] }); }
    if (g !== gen) return;
    if (perm.location !== "granted" && perm.coarseLocation !== "granted") { set({ status: "denied", message: OFF }); return; }
    watchBrowser(false);
    const id = await NativeGeo.watchPosition(
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000, minimumUpdateInterval: 1000 },
      (p, err) => {
        if (p) { onFix(p.coords.latitude, p.coords.longitude, p.coords.accuracy, p.timestamp); return; }
        if (current.status === "ok") return;
        if (/denied|permission/i.test(String(err?.message ?? err))) set({ status: "denied", message: OFF });
      },
    );
    if (g !== gen) { void NativeGeo.clearWatch({ id }); return; }   // stopped while we were asking
    stops.push(() => void NativeGeo.clearWatch({ id }));
    // Neither source has answered: say so instead of spinning forever (fixes still land if they come later).
    const t = setTimeout(() => { if (g === gen && current.status !== "ok") set({ status: "unavailable", message: NO_FIX }); }, 25_000);
    stops.push(() => clearTimeout(t));
  } catch (e) {
    if (g !== gen) return;
    // Thrown when the phone's location services are switched off — the WebView may still manage.
    if (!watchBrowser(true)) set({ status: "unavailable", message: /disabled|services/i.test(String((e as Error)?.message)) ? "Turn on Location in your phone's settings." : NO_FIX });
  }
}

function start() {
  if (running || typeof window === "undefined") return;
  running = true;
  if (nativeGps()) { void startNative(gen); return; }
  if (!window.isSecureContext) {
    set({ status: "insecure", message: "Location needs HTTPS — open the app over https:// or localhost." });
    return;
  }
  if (!watchBrowser(true)) set({ status: "unavailable", message: "This device can't share its location." });
}

function stop() {
  gen++;
  running = false;
  stops.forEach((f) => f());
  stops = [];
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
  asked = false;   // the person tapped retry: they expect the permission prompt again
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

/* Street address for a point, best source first: Ola Maps (India-first, free tier) when its key is set, then Google
 * Geocoding when a Maps key is set, then OpenStreetMap Nominatim (no key; ~1 request a second).
 * Cached; looked up again after moving 50 m. */
const geoCache: { pos: LatLng; address: string }[] = [];

type NominatimReverse = { category?: string; type?: string; name?: string; display_name?: string; address?: Record<string, string> };
const PLACE_CATEGORIES = new Set(["amenity", "shop", "building", "tourism", "office", "leisure", "healthcare", "railway", "aeroway"]);

/** Short pickup label from a Nominatim reverse result: "<place or street>, <locality>, <area>".
 * Many Indian roads in OSM are unnamed, so the locality (neighbourhood / residential area) carries the name people
 * know — e.g. "Peer Gate Area, Ibrahimpura, Bhopal" rather than just "Ibrahimpura, Bhopal". */
export function formatAddress(j: NominatimReverse): string | null {
  const a = j.address ?? {};
  const place = j.name && j.category && PLACE_CATEGORIES.has(j.category) ? j.name : undefined;
  const street = a.road ?? a.pedestrian ?? a.footway;
  const locality = a.neighbourhood ?? a.residential ?? a.hamlet ?? a.quarter ?? a.isolated_dwelling;
  const area = a.suburb ?? a.city_district ?? a.village;
  const city = a.city ?? a.town ?? a.village ?? a.municipality ?? a.state_district;
  const parts = [place ?? street, locality, area, city]
    .filter((x, i, all): x is string => !!x && all.indexOf(x) === i)
    .slice(0, 3);
  if (parts.length >= 2) return parts.join(", ");
  return j.display_name?.split(",").slice(0, 3).map((x) => x.trim()).join(", ") ?? parts[0] ?? null;
}

/** Map data often has roads in capitals ("STEPHEN KING SARANI"); show them in title case. Short codes such as
 *  "DF" or "II" stay as they are. */
export function tidyAddress(a: string): string {
  return a.split(",").map((part) => {
    const t = part.trim();
    if (t !== t.toUpperCase() || !/[A-Z]{3}/.test(t)) return t;
    return t.split(/\s+/).map((w) => (w.length <= 2 ? w : w[0] + w.slice(1).toLowerCase())).join(" ");
  }).join(", ");
}

export async function reverseGeocode(pos: LatLng): Promise<string | null> {
  const hit = geoCache.find((c) => distanceM(c.pos, pos) < 50);
  if (hit) return hit.address;
  const g = (hasOla() ? await olaReverseGeocode(pos) : null) ?? (hasGoogle() ? await googleReverseGeocode(pos) : null);
  if (g) { const t = tidyAddress(g); geoCache.push({ pos, address: t }); return t; }
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&addressdetails=1&lat=${pos.lat}&lon=${pos.lng}`,
      { headers: { "Accept-Language": "en" } });
    if (!res.ok) return null;
    const found = formatAddress(await res.json());
    const address = found && tidyAddress(found);
    if (address) geoCache.push({ pos, address });
    return address;
  } catch { return null; }
}

/** Address of where the device is now; null until both a fix and a lookup succeed. */
export function useCurrentAddress(enabled = true): { loc: DeviceLocation; address: string | null } {
  const loc = useDeviceLocation(enabled);
  const [address, setAddress] = useState<string | null>(null);
  const pos = loc.status === "ok" ? loc.pos : null;
  const lat = pos ? Math.round(pos.lat * 2000) / 2000 : null;   // ~50 m buckets, so walking doesn't refetch every fix
  const lng = pos ? Math.round(pos.lng * 2000) / 2000 : null;
  const exact = useRef<LatLng | null>(null);
  exact.current = pos;
  useEffect(() => {
    if (lat === null || lng === null || !exact.current) return;
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Look up the fix itself, not the bucket's corner, which can sit on the next street. A failed lookup
    // (offline, or Nominatim's 1 req/s limit) is retried, so an earlier, rougher address doesn't stick.
    const look = (tries: number) => {
      if (!exact.current) return;
      void reverseGeocode(exact.current).then((a) => {
        if (!live) return;
        if (a) setAddress(a);
        else if (tries > 1) timer = setTimeout(() => look(tries - 1), 2500);
      });
    };
    look(4);
    return () => { live = false; clearTimeout(timer); };
  }, [lat, lng]);
  return { loc, address };
}
