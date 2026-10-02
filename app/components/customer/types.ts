import type { Coupon, Driver, ParcelWeight, PayMethod, Place, RentalPackage, RideStatus, VehicleKind } from "../../lib/data";

/** What kind of trip the customer is booking. "any" = first free Mini / Sedan / SUV. */
export type Service = "ride" | "any" | "rental" | "parcel";

export interface ParcelInfo {
  type: string;
  weight: ParcelWeight;
  sender: { name: string; phone: string };
  receiver: { name: string; phone: string };
  note: string;
}

/** What the customer has picked so far in the booking flow. */
export interface Booking {
  from: Place;
  to: Place;
  vehicle: VehicleKind;
  service: Service;
  ac: boolean;
  km: number;
  min: number;
  fare: number;       // before discount
  coupon: Coupon | null;
  pay: PayMethod;
  when: string | null;            // null = now, otherwise a scheduled slot label
  passenger: { name: string; phone: string } | null;   // null = myself
  rental?: RentalPackage;
  parcel?: ParcelInfo;
}

export interface ActiveRide extends Booking {
  id: string;
  status: RideStatus;
  progress: number;   // 0–1 along the current leg (approach, then trip)
  driver: Driver;
  otp: string;
  eta: number;        // minutes
}

/** Display name for what was booked — "Sedan · AC", "Parcel · Bike", "Rental 2 hr · Mini". */
export function serviceLabel(b: Pick<Booking, "service" | "vehicle" | "ac" | "rental">, name: string) {
  if (b.service === "parcel") return `Parcel · ${name}`;
  if (b.service === "rental" && b.rental) return `Rental ${b.rental.hours} hr · ${name}`;
  if (b.service === "any") return `Book Any · ${b.ac ? "AC" : "Non-AC"}`;
  return name === "Bike" || name === "Auto" ? name : `${name} · ${b.ac ? "AC" : "Non-AC"}`;
}

/** A row on the choose-ride screen. */
export type RideOption = VehicleKind | "any" | "rental" | "parcel";
