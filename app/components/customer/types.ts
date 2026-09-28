import type { Coupon, Driver, PayMethod, Place, RideStatus, VehicleKind } from "../../lib/data";

/** What the customer has picked so far in the booking flow. */
export interface Booking {
  from: Place;
  to: Place;
  vehicle: VehicleKind;
  km: number;
  min: number;
  fare: number;       // before discount
  coupon: Coupon | null;
  pay: PayMethod;
}

export interface ActiveRide extends Booking {
  id: string;
  status: RideStatus;
  progress: number;   // 0–1 along the current leg (approach, then trip)
  driver: Driver;
  otp: string;
  eta: number;        // minutes
}
