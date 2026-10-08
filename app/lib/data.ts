/* Display constants shared by the Customer app, Driver app and Admin panel.
 * Prices, coupons, rides, drivers and money all live in the database (supabase/migrations) —
 * nothing here decides what anyone pays or earns. */

export type VehicleKind = "bike" | "auto" | "erick" | "mini" | "sedan" | "taxi" | "suv";

export interface VehicleInfo { id: VehicleKind; name: string; seats: number; ac: boolean }

/** Names and capabilities for labels and pictures. Fares come from the server's quote. */
export const VEHICLES: VehicleInfo[] = [
  { id: "bike", name: "Bike", seats: 1, ac: false },
  { id: "auto", name: "Auto", seats: 3, ac: false },
  { id: "erick", name: "E-Rickshaw", seats: 4, ac: false },
  { id: "mini", name: "Mini", seats: 4, ac: true },
  { id: "sedan", name: "Sedan", seats: 4, ac: true },
  { id: "taxi", name: "Taxi", seats: 4, ac: true },
  { id: "suv", name: "XL", seats: 6, ac: true },
];

export const vehicleById = (id: VehicleKind) => VEHICLES.find((v) => v.id === id) ?? VEHICLES[0];

export const PARCEL_TYPES = ["Documents", "Food", "Clothes", "Electronics", "Medicines", "Groceries", "Other"];

export type RideStatus = "Scheduled" | "Searching" | "Arriving" | "Arrived" | "Started" | "Completed" | "Cancelled" | "NoDrivers";

/** Progress steps shown on the live-ride screen. */
export const RIDE_STEPS: RideStatus[] = ["Searching", "Arriving", "Arrived", "Started", "Completed"];

export type PayMethod = "UPI" | "Cash" | "Card" | "Wallet";

export const CITIES = ["Noida", "Delhi", "Gurugram", "Lucknow"] as const;

export const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

export const nowTime = () => new Date().toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
