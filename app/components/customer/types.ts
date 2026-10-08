import type { VehicleKind } from "../../lib/data";

/** A row on the choose-ride screen. */
export type RideOption = VehicleKind | "any" | "rental" | "parcel";
