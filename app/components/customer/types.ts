import type { Coupon, Driver, ParcelInfo, PayMethod, Place, RideStatus, Service, VehicleKind } from "../../lib/data";

/** What the customer has picked so far in the booking flow. */
export interface Booking {
  service: Service;
  from: Place;
  to: Place;
  vehicle: VehicleKind;
  ac: boolean;        // ignored for vehicles without an AC choice
  parcel?: ParcelInfo;
  km: number;
  min: number;
  fare: number;       // before discount
  surge: number;      // peak multiplier baked into `fare` (1 = none)
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
