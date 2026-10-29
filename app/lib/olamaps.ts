"use client";

import type { LatLng } from "./location";

/* Ola Maps (maps.olakrutrim.com): India-first addresses, with a free allowance of 100,000 calls a month.
 * Used for addresses and place search. Switches on when NEXT_PUBLIC_OLA_MAPS_API_KEY is set; without it, or when a call fails, the callers fall back to
 * Google (if configured) and then OpenStreetMap. The key is public by design — restrict it to the app's origins in
 * the Ola Maps console. */

export const OLA_KEY = process.env.NEXT_PUBLIC_OLA_MAPS_API_KEY ?? "";
export const hasOla = () => OLA_KEY !== "";

type OlaComponent = { types: string | string[]; short_name: string; long_name: string };
type OlaResult = { formatted_address: string; name?: string; types?: string[]; address_components?: OlaComponent[] };

const has = (c: OlaComponent, t: string) => (Array.isArray(c.types) ? c.types.includes(t) : c.types.split(/[,\s]+/).includes(t));

/** A house or street address ("11/2, Neogi Para Rd"), as opposed to a shop, school or station name. */
const isStreetLevel = (r: OlaResult) =>
  /^\d/.test((r.name ?? "").trim()) || (r.types ?? []).some((t) => t === "street_address" || t === "route");

/** Where the point is, in words. Ola lists several nearby places for a point and, in busy areas, those are
 *  shops, schools or stations that can be a few hundred metres away — showing one of those as "your location"
 *  looks wrong. So: a house/street result when there is one, else the area (locality, sector, neighbourhood)
 *  from the first result without its shop/landmark name. */
export function formatOlaAddress(results: OlaResult[]): string | null {
  if (!results.length) return null;
  const parts = (a: string) => a.split(",").map((x) => x.trim()).filter(Boolean);
  const street = results.find(isStreetLevel);
  if (street) {
    const name = (street.name ?? "").trim();
    const rest = parts(street.formatted_address ?? "").filter((p) => p !== name && !name.includes(p));
    return [name || rest.shift(), ...rest].filter(Boolean).slice(0, 3).join(", ") || null;
  }
  const r = results[0];
  const name = (r.name ?? "").trim();
  const area = parts(r.formatted_address ?? "").filter((p) => p !== name && !/^\d{6}$/.test(p) && p !== "India");
  if (area.length) return area.slice(0, 3).join(", ");
  const comps = r.address_components ?? [];
  const pick = (...types: string[]) => comps.find((c) => types.some((t) => has(c, t)))?.long_name;
  const local = [pick("route"), pick("sublocality_level_1", "sublocality", "neighborhood"), pick("locality", "administrative_area_level_3")]
    .filter((x, i, all): x is string => !!x && all.indexOf(x) === i);
  return local.length ? local.join(", ") : name || null;
}

export async function olaReverseGeocode(pos: LatLng): Promise<string | null> {
  if (!hasOla()) return null;
  try {
    const res = await fetch(`https://api.olamaps.io/places/v1/reverse-geocode?latlng=${pos.lat},${pos.lng}&api_key=${encodeURIComponent(OLA_KEY)}`,
      { headers: { Accept: "application/json" } });   // a simple GET, so browsers send it without a CORS preflight
    if (!res.ok) return null;
    const j = (await res.json()) as { status?: string; results?: OlaResult[] };
    return j.results?.length ? formatOlaAddress(j.results) : null;
  } catch { return null; }
}

export interface OlaPlace { placeId: string; name: string; address: string; lat: number; lng: number }
type OlaPrediction = {
  place_id?: string; description?: string; geometry?: { location?: { lat: number; lng: number } };
  structured_formatting?: { main_text?: string; secondary_text?: string };
};

/** Place search near `near`, India-first. Predictions carry their position, so no details call is needed. */
export async function olaSearch(input: string, near: LatLng): Promise<OlaPlace[]> {
  const res = await fetch(`https://api.olamaps.io/places/v1/autocomplete?input=${encodeURIComponent(input)}&location=${near.lat},${near.lng}&api_key=${encodeURIComponent(OLA_KEY)}`,
    { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("Place search isn't responding — try again in a moment.");
  const j = (await res.json()) as { predictions?: OlaPrediction[] };
  return (j.predictions ?? [])
    .filter((p) => p.geometry?.location && typeof p.geometry.location.lat === "number")
    .slice(0, 6)
    .map((p, i) => {
      const main = p.structured_formatting?.main_text || p.description?.split(",")[0] || input;
      const rest = p.structured_formatting?.secondary_text || p.description?.split(",").slice(1).join(",").trim() || "";
      return { placeId: `ola-${p.place_id ?? i}`, name: main.trim(), address: rest, lat: p.geometry!.location!.lat, lng: p.geometry!.location!.lng };
    });
}

/** Driving distance and time (with traffic) between two points. Null when Ola isn't set up or doesn't answer. */
export async function olaRoute(a: LatLng, b: LatLng): Promise<{ km: number; mins: number } | null> {
  if (!hasOla()) return null;
  try {
    const res = await fetch(`https://api.olamaps.io/routing/v1/directions?origin=${a.lat},${a.lng}&destination=${b.lat},${b.lng}&mode=driving&alternatives=false&steps=false&overview=false&api_key=${encodeURIComponent(OLA_KEY)}`,
      { method: "POST", headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const j = (await res.json()) as { routes?: { legs?: { distance?: number; duration?: number }[] }[] };
    const legs = j.routes?.[0]?.legs ?? [];
    const m = legs.reduce((s, l) => s + (l.distance ?? 0), 0), sec = legs.reduce((s, l) => s + (l.duration ?? 0), 0);
    return m > 0 && sec > 0 ? { km: Math.round(m / 100) / 10, mins: Math.round(sec / 60) } : null;
  } catch { return null; }
}
