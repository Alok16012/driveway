/* Pickup labels built from OpenStreetMap (Nominatim) reverse-geocoding results. */
import { describe, expect, it, vi } from "vitest";
import { formatAddress, tidyAddress } from "../app/lib/location";
import { decodePolyline, formatGoogleAddress } from "../app/lib/google";
import { formatOlaAddress, olaSearch } from "../app/lib/olamaps";

const bhopal = { city_district: "Bhopal", city: "Bhopal", state: "Madhya Pradesh", country: "India" };

describe("formatAddress", () => {
  it("names the locality when the nearest road is unnamed", () => {
    expect(formatAddress({ category: "highway", type: "residential", address: { residential: "Peer Gate Area", suburb: "Ibrahimpura", ...bhopal } }))
      .toBe("Peer Gate Area, Ibrahimpura, Bhopal");
    expect(formatAddress({ category: "highway", type: "residential", address: { neighbourhood: "Azad Market", suburb: "Ibrahimpura", ...bhopal } }))
      .toBe("Azad Market, Ibrahimpura, Bhopal");
  });

  it("leads with the street, then the locality", () => {
    expect(formatAddress({ category: "highway", type: "primary", name: "Hamidia Road", address: { road: "Hamidia Road", neighbourhood: "Azad Market", suburb: "Ibrahimpura", ...bhopal } }))
      .toBe("Hamidia Road, Azad Market, Ibrahimpura");
  });

  it("leads with the place the phone is at", () => {
    expect(formatAddress({ category: "amenity", type: "hospital", name: "Hamidia Hospital", address: { road: "Royal Market Road", suburb: "Koh-e-Fiza", ...bhopal } }))
      .toBe("Hamidia Hospital, Koh-e-Fiza, Bhopal");
  });

  it("falls back to the display name", () => {
    expect(formatAddress({ display_name: "Somewhere, Bhopal, Madhya Pradesh, India", address: { state: "Madhya Pradesh" } })).toBe("Somewhere, Bhopal, Madhya Pradesh");
  });
});

describe("formatGoogleAddress", () => {
  const c = (long_name: string, ...types: string[]) => ({ long_name, short_name: long_name, types });
  it("skips plus codes and unnamed roads, and names the locality", () => {
    expect(formatGoogleAddress([
      { types: ["plus_code"], address_components: [c("7JR3+X2W", "plus_code")], formatted_address: "7JR3+X2W Bhopal" },
      { types: ["street_address"], formatted_address: "Unnamed Road, Peer Gate Area, Ibrahimpura, Bhopal, Madhya Pradesh 462001, India", address_components: [
        c("Unnamed Road", "route"), c("Peer Gate Area", "sublocality_level_2", "sublocality", "political"),
        c("Ibrahimpura", "sublocality_level_1", "sublocality", "political"), c("Bhopal", "locality", "political")] },
    ])).toBe("Peer Gate Area, Ibrahimpura, Bhopal");
  });
  it("leads with the place or street", () => {
    expect(formatGoogleAddress([{ types: ["establishment"], formatted_address: "", address_components: [
      c("Hamidia Hospital", "point_of_interest", "establishment"), c("Royal Market", "sublocality_level_2", "sublocality"),
      c("Koh-e-Fiza", "sublocality_level_1", "sublocality"), c("Bhopal", "locality")] }])).toBe("Hamidia Hospital, Royal Market, Koh-e-Fiza");
    expect(formatGoogleAddress([{ types: ["route"], formatted_address: "", address_components: [c("Hamidia Road", "route"), c("Bhopal", "locality")] }]))
      .toBe("Hamidia Road, Bhopal");
  });
});

describe("decodePolyline", () => {
  it("decodes Google's reference example", () => {
    expect(decodePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@")).toEqual([{ lat: 38.5, lng: -120.2 }, { lat: 40.7, lng: -120.95 }, { lat: 43.252, lng: -126.453 }]);
  });
});

describe("formatOlaAddress", () => {
  const comp = (long_name: string, types: string) => ({ long_name, short_name: long_name, types });
  it("prefers a house/street result over nearby shops and stations", () => {
    expect(formatOlaAddress([
      { formatted_address: "Duncan Tea House, Central Park, Sector III, Bidhannagar, Kolkata, West Bengal", name: "Duncan Tea House", types: ["restaurant"] },
      { formatted_address: "13, Neogi Para Rd, Neogipara, Ashokgarh, Kolkata, West Bengal, 700036, India", name: "13, Neogi Para Rd", types: ["street_address"] },
    ])).toBe("13, Neogi Para Rd, Neogipara, Ashokgarh");
    expect(formatOlaAddress([{ formatted_address: "11/2, Neogi Para Rd, 11/2, Neogi Para Rd, Neogipara, Ariadaha, Baranagar", name: "11/2, Neogi Para Rd", types: ["point_of_interest"] }]))
      .toBe("11/2, Neogi Para Rd, Neogipara, Ariadaha");
  });
  it("shows the area, not a landmark's name, when there is no street address", () => {
    expect(formatOlaAddress([{ formatted_address: "East West Metro Karunamoyee Station, Central Park, Sector III, Karunamoyee, West Bengal, 700064, India",
      name: "East West Metro Karunamoyee Station", types: ["supermarket"] }])).toBe("Central Park, Sector III, Karunamoyee");
  });
  it("falls back to the components, accepting string or array types", () => {
    expect(formatOlaAddress([{ formatted_address: "", address_components: [
      { long_name: "Boring Road", short_name: "Boring Rd", types: ["route"] }, comp("Patna", "locality")] }])).toBe("Boring Road, Patna");
    expect(formatOlaAddress([])).toBeNull();
  });
});

describe("tidyAddress", () => {
  it("title-cases roads written in capitals and leaves the rest alone", () => {
    expect(tidyAddress("STEPHEN KING SARANI, DF Block, Sector II")).toBe("Stephen King Sarani, DF Block, Sector II");
    expect(tidyAddress("BANKIM CHANDRA CHATTOPADHYAY SARANI, Salt Lake")).toBe("Bankim Chandra Chattopadhyay Sarani, Salt Lake");
    expect(tidyAddress("Park Street, Kolkata")).toBe("Park Street, Kolkata");
    expect(tidyAddress("NH 12, MG Road")).toBe("NH 12, MG Road");
  });
});

describe("olaSearch", () => {
  it("maps Ola predictions to places with their position", async () => {
    const real = globalThis.fetch;
    globalThis.fetch = (async () => new Response(JSON.stringify({ predictions: [
      { place_id: "x1", description: "Howrah Station, Howrah, West Bengal", geometry: { location: { lat: 22.583, lng: 88.343 } },
        structured_formatting: { main_text: "Howrah Station", secondary_text: "Howrah, West Bengal" } },
      { place_id: "x2", description: "No position" },
    ] }))) as typeof fetch;
    try {
      expect(await olaSearch("howrah", { lat: 22.57, lng: 88.36 })).toEqual([
        { placeId: "ola-x1", name: "Howrah Station", address: "Howrah, West Bengal", lat: 22.583, lng: 88.343 },
      ]);
    } finally { globalThis.fetch = real; vi.unstubAllEnvs(); }
  });
});

describe("olaRoute", () => {
  it("adds up the legs into km and minutes, and gives up quietly on errors", async () => {
    const real = globalThis.fetch;
    vi.stubEnv("NEXT_PUBLIC_OLA_MAPS_API_KEY", "test-key");
    vi.resetModules();
    const { olaRoute } = await import("../app/lib/olamaps");
    try {
      globalThis.fetch = (async () => new Response(JSON.stringify({ routes: [{ legs: [{ distance: 10248, duration: 2625 }] }] }))) as typeof fetch;
      expect(await olaRoute({ lat: 22.5867, lng: 88.4171 }, { lat: 22.5832, lng: 88.3434 })).toEqual({ km: 10.2, mins: 44 });
      globalThis.fetch = (async () => new Response("{}", { status: 403 })) as typeof fetch;
      expect(await olaRoute({ lat: 1, lng: 1 }, { lat: 2, lng: 2 })).toBeNull();
      globalThis.fetch = (async () => { throw new Error("offline"); }) as typeof fetch;
      expect(await olaRoute({ lat: 1, lng: 1 }, { lat: 2, lng: 2 })).toBeNull();
    } finally { globalThis.fetch = real; vi.unstubAllEnvs(); }
  });
});
