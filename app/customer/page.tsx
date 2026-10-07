import type { Metadata } from "next";
import CustomerApp from "./CustomerApp";
import { getCatalog } from "../lib/catalog";
import { CatalogProvider } from "../lib/CatalogProvider";

export const metadata: Metadata = { title: "DriveWay", description: "Book a Bike, Auto, Mini, Sedan or XL. Ride · Reach · Relax." };

// Pricing and offers change rarely — refresh from Supabase at most once a minute.
export const revalidate = 60;

export default async function Page() {
  const catalog = await getCatalog();
  return (
    <CatalogProvider catalog={catalog}>
      <CustomerApp />
    </CatalogProvider>
  );
}
