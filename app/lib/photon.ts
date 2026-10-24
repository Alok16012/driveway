"use client";

import type { LatLng } from "./location";
import { tidyAddress } from "./location";

/* Free place search on OpenStreetMap data — Photon (photon.komoot.io), no key needed. Used when no Google Maps key is
 * set, so customers can search any address in India instead of only the saved places. Results carry their position,
 * so no second "details" call is needed. Fair use: requests are debounced by the caller and limited to 6 results. */

export interface FreePlace { placeId: string; name: string; address: string; lat: number; lng: number }

type PhotonFeature = {
  geometry: { coordinates: [number, number] };
  properties: { osm_type?: string; osm_id?: number; name?: string; housenumber?: string; street?: string; locality?: string;
    district?: string; city?: string; county?: string; state?: string; countrycode?: string };
};

export async function searchFree(input: string, near: LatLng): Promise<FreePlace[]> {
  const u = new URL("https://photon.komoot.io/api/");
  u.search = new URLSearchParams({ q: input, lat: String(near.lat), lon: String(near.lng), limit: "8", lang: "en", bbox: "68,6,97.5,37.5" }).toString();
  const res = await fetch(u);
  if (!res.ok) throw new Error("Place search isn't responding — try again in a moment.");
  const j = (await res.json()) as { features?: PhotonFeature[] };
  const seen = new Set<string>();
  return (j.features ?? [])
    .filter((f) => f.properties.countrycode === "IN")
    .map((f) => {
      const p = f.properties;
      const street = [p.housenumber, p.street].filter(Boolean).join(" ");
      const name = p.name || street || p.locality || p.district || p.city || input;
      const address = tidyAddress([street !== name ? street : "", p.locality ?? p.district, p.city ?? p.county, p.state]
        .filter((x, i, all): x is string => !!x && x !== name && all.indexOf(x) === i).join(", "));
      return { placeId: `osm-${p.osm_type ?? ""}${p.osm_id ?? `${f.geometry.coordinates.join(",")}`}`, name: tidyAddress(name), address,
        lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] };
    })
    .filter((x) => { const k = `${x.name}|${x.address}`; if (seen.has(k)) return false; seen.add(k); return true; })
    .slice(0, 6);
}
