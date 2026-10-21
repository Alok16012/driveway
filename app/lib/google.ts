"use client";

import type { LatLng } from "./location";

/* Google Maps Platform, called straight from the app (the APKs are static, there is no server of ours in between).
 * Everything here switches on when NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is set; without it, or when a call fails, the
 * callers fall back to OpenStreetMap. The key is public by design: restrict it in Google Cloud to these APIs
 * (Map Tiles, Geocoding, Places (New), Routes) and to the app's origins — see docs/SETUP.md. */

export const GOOGLE_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
export const hasGoogle = () => GOOGLE_KEY !== "";

/** The logo Google requires next to its map tiles. */
export const GOOGLE_LOGO = "https://maps.gstatic.com/mapfiles/api-3/images/google4_hdpi.png";

const headers = (fields: string) => ({ "Content-Type": "application/json", "X-Goog-Api-Key": GOOGLE_KEY, "X-Goog-FieldMask": fields });

/* ───────────── Map tiles (Map Tiles API, 2D roadmap) ───────────── */

const SESSION_KEY = "driveway-gmaps-tiles";
let session: Promise<string | null> | null = null;

/** A tile session, kept until a day before Google expires it (sessions last about two weeks). */
export async function tileSession(): Promise<string | null> {
  if (!hasGoogle()) return null;
  session ??= (async () => {
    try {
      const saved = JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null") as { id: string; expires: number } | null;
      if (saved && saved.expires - Date.now() > 86_400_000) return saved.id;
    } catch { /* storage blocked: fetch a new session */ }
    try {
      const res = await fetch(`https://tile.googleapis.com/v1/createSession?key=${GOOGLE_KEY}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mapType: "roadmap", language: "en-US", region: "IN" }),
      });
      if (!res.ok) return null;
      const j = (await res.json()) as { session?: string; expiry?: string };
      if (!j.session) return null;
      try { localStorage.setItem(SESSION_KEY, JSON.stringify({ id: j.session, expires: Number(j.expiry) * 1000 })); } catch { /* fine */ }
      return j.session;
    } catch { return null; }
  })();
  const s = await session;
  if (!s) session = null;   // try again next time
  return s;
}

export const tileUrl = (s: string) => `https://tile.googleapis.com/v1/2dtiles/{z}/{x}/{y}?session=${s}&key=${GOOGLE_KEY}`;

/** Copyright line Google asks to show for the area on screen. */
export async function tileCopyright(s: string, zoom: number, b: { north: number; south: number; east: number; west: number }): Promise<string | null> {
  try {
    const q = new URLSearchParams({ session: s, key: GOOGLE_KEY, zoom: String(Math.round(zoom)), north: String(b.north), south: String(b.south), east: String(b.east), west: String(b.west) });
    const res = await fetch(`https://tile.googleapis.com/v1/2dtiles/viewport?${q}`);
    if (!res.ok) return null;
    return ((await res.json()) as { copyright?: string }).copyright ?? null;
  } catch { return null; }
}

/* ───────────── Address of a point (Geocoding API) ───────────── */

type GComponent = { long_name: string; short_name: string; types: string[] };
type GResult = { types: string[]; address_components: GComponent[]; formatted_address: string };

/** Short pickup label from Geocoding results: "<place or street>, <locality>, <area>", like the OSM one. */
export function formatGoogleAddress(results: GResult[]): string | null {
  const best = results.find((r) => !r.types.includes("plus_code"));
  if (!best) return null;
  const get = (...types: string[]) => {
    for (const t of types) {
      const c = best.address_components.find((x) => x.types.includes(t));
      if (c && !/^unnamed road$/i.test(c.long_name) && !/^[A-Z0-9]{4}\+[A-Z0-9]{2,}/.test(c.long_name)) return c.long_name;
    }
    return undefined;
  };
  const parts = [
    get("point_of_interest", "establishment", "premise") ?? get("route"),
    get("sublocality_level_3", "sublocality_level_2", "neighborhood"),
    get("sublocality_level_1", "sublocality"),
    get("locality", "administrative_area_level_3"),
  ].filter((x, i, all): x is string => !!x && all.indexOf(x) === i).slice(0, 3);
  if (parts.length >= 2) return parts.join(", ");
  return best.formatted_address.split(",").slice(0, 3).map((x) => x.trim()).join(", ") || null;
}

export async function googleReverseGeocode(pos: LatLng): Promise<string | null> {
  if (!hasGoogle()) return null;
  try {
    const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${pos.lat},${pos.lng}&language=en&key=${GOOGLE_KEY}`);
    if (!res.ok) return null;
    const j = (await res.json()) as { status: string; results?: GResult[] };
    return j.status === "OK" && j.results ? formatGoogleAddress(j.results) : null;
  } catch { return null; }
}

/* ───────────── Place search (Places API (New)) ───────────── */

export interface PlaceSuggestion { placeId: string; name: string; address: string }
export interface FoundPlace { placeId: string; name: string; address: string; lat: number; lng: number }

/** One token per search, ended by the details lookup, so Google bills the typing as a single session. */
export const newSearchSession = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

export async function searchPlaces(input: string, near: LatLng, sessionToken: string): Promise<PlaceSuggestion[]> {
  if (!hasGoogle() || input.trim().length < 2) return [];
  const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    headers: headers("suggestions.placePrediction.placeId,suggestions.placePrediction.structuredFormat"),
    body: JSON.stringify({
      input, sessionToken, languageCode: "en", includedRegionCodes: ["in"],
      locationBias: { circle: { center: { latitude: near.lat, longitude: near.lng }, radius: 50000 } },
      origin: { latitude: near.lat, longitude: near.lng },
    }),
  });
  if (!res.ok) throw new Error("Place search isn't available right now.");
  const j = (await res.json()) as { suggestions?: { placePrediction?: { placeId: string; structuredFormat?: { mainText?: { text: string }; secondaryText?: { text: string } } } }[] };
  return (j.suggestions ?? []).flatMap((s) => {
    const p = s.placePrediction;
    return p ? [{ placeId: p.placeId, name: p.structuredFormat?.mainText?.text ?? "", address: p.structuredFormat?.secondaryText?.text ?? "" }] : [];
  });
}

export async function placeDetails(placeId: string, sessionToken: string): Promise<FoundPlace> {
  const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=en&sessionToken=${encodeURIComponent(sessionToken)}`,
    { headers: headers("id,displayName,formattedAddress,location") });
  if (!res.ok) throw new Error("Couldn't load that place — try again.");
  const j = (await res.json()) as { id: string; displayName?: { text: string }; formattedAddress?: string; location?: { latitude: number; longitude: number } };
  if (!j.location) throw new Error("That place has no location — pick another.");
  return { placeId: j.id, name: (j.displayName?.text ?? "").slice(0, 120), address: (j.formattedAddress ?? "").slice(0, 200), lat: j.location.latitude, lng: j.location.longitude };
}

/* ───────────── Road route (Routes API) ───────────── */

/** Decodes Google's encoded polyline format. */
export function decodePolyline(s: string): LatLng[] {
  const out: LatLng[] = [];
  let i = 0, lat = 0, lng = 0;
  const next = () => {
    let shift = 0, result = 0, b: number;
    do { b = s.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (i < s.length) { lat += next(); lng += next(); out.push({ lat: lat / 1e5, lng: lng / 1e5 }); }
  return out;
}

export async function googleRoute(a: LatLng, b: LatLng): Promise<LatLng[] | null> {
  if (!hasGoogle()) return null;
  try {
    const at = (p: LatLng) => ({ location: { latLng: { latitude: p.lat, longitude: p.lng } } });
    const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST", headers: headers("routes.polyline.encodedPolyline"),
      body: JSON.stringify({ origin: at(a), destination: at(b), travelMode: "DRIVE", polylineEncoding: "ENCODED_POLYLINE" }),
    });
    if (!res.ok) return null;
    const line = ((await res.json()) as { routes?: { polyline?: { encodedPolyline?: string } }[] }).routes?.[0]?.polyline?.encodedPolyline;
    return line ? decodePolyline(line) : null;
  } catch { return null; }
}
