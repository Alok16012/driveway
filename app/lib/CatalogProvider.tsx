"use client";

/* Makes the Supabase catalog available to every screen: `const { vehicles, vehicleById } = useCatalog()`. */
import { createContext, useContext, useMemo } from "react";
import type { Catalog } from "./catalog";
import { isPeak, type Announcement, type VehicleKind } from "./data";

function build(c: Catalog) {
  const vehicleById = (id: VehicleKind) => c.vehicles.find((v) => v.id === id)!;
  return {
    ...c,
    vehicleById,
    /** "Sedan · AC", "Mini · Non-AC" — or just "Bike" for vehicles without an AC choice. */
    vehicleLabel: (id: VehicleKind, ac?: boolean) => {
      const v = vehicleById(id);
      return v.acOption && ac !== undefined ? `${v.name} · ${ac ? "AC" : "Non-AC"}` : v.name;
    },
    /** Enabled vehicles that carry parcels. */
    parcelVehicles: c.vehicles.filter((v) => v.enabled && v.parcelMaxKg > 0),
    activeCoupons: c.coupons.filter((x) => x.active),
    /** Platform commission as a fraction (0.2 = 20%). */
    commission: c.settings.commissionPct / 100,
    /** Surge multiplier for a booking made now — 1 outside peak hours or when surge is off. */
    surgeNow: () => (c.settings.surgeOn && isPeak() ? c.settings.surgeMult : 1),
    /** Broadcasts meant for customers or for riders. */
    announcementsFor: (who: "customer" | "rider"): Announcement[] => c.announcements.filter((a) =>
      who === "customer" ? a.audience === "All customers" || a.audience === "Noida only" : a.audience === "All drivers" || a.audience === "Inactive riders"),
  };
}

const Ctx = createContext<ReturnType<typeof build> | null>(null);

export function CatalogProvider({ catalog, children }: { catalog: Catalog; children: React.ReactNode }) {
  const value = useMemo(() => build(catalog), [catalog]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCatalog() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCatalog must be used inside <CatalogProvider>");
  return c;
}
