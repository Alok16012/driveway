"use client";

import type { LatLng } from "./location";

/* Ola Maps (maps.olakrutrim.com): India-first addresses, with a free allowance of 100,000 calls a month.
 * Switches on when NEXT_PUBLIC_OLA_MAPS_API_KEY is set; without it, or when a call fails, the callers fall back to
 * Google (if configured) and then OpenStreetMap. The key is public by design — restrict it to the app's origins in
 * the Ola Maps console. */

export const OLA_KEY = process.env.NEXT_PUBLIC_OLA_MAPS_API_KEY ?? "";
export const hasOla = () => OLA_KEY !== "";

type OlaComponent = { types: string | string[]; short_name: string; long_name: string };
type OlaResult = { formatted_address: string; name?: string; types?: string[]; address_components?: OlaComponent[] };

const has = (c: OlaComponent, t: string) => (Array.isArray(c.types) ? c.types.includes(t) : c.types.split(/[,\s]+/).includes(t));

/** "<place or street>, <locality>, <city>" from the best result, like the other geocoders. */
export function formatOlaAddress(results: OlaResult[]): string | null {
  const r = results[0];
  if (!r) return null;
  const comps = r.address_components ?? [];
  const pick = (...types: string[]) => comps.find((c) => types.some((t) => has(c, t)))?.long_name;
  const street = pick("premise", "point_of_interest", "establishment", "route", "street_address");
  const locality = pick("sublocality_level_2", "sublocality_level_1", "sublocality", "neighborhood");
  const city = pick("locality", "administrative_area_level_3", "administrative_area_level_2");
  const first = r.name && r.name.length <= 60 ? r.name : street;
  const parts = [first, locality, city].filter((x, i, all): x is string => !!x && all.indexOf(x) === i);
  if (parts.length >= 2) return parts.slice(0, 3).join(", ");
  return r.formatted_address?.split(",").slice(0, 3).map((x) => x.trim()).filter(Boolean).join(", ") || null;
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
