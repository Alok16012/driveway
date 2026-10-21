/* Pickup labels built from OpenStreetMap (Nominatim) reverse-geocoding results. */
import { describe, expect, it } from "vitest";
import { formatAddress } from "../app/lib/location";
import { decodePolyline, formatGoogleAddress } from "../app/lib/google";

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
