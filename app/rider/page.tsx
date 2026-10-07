import type { Metadata } from "next";
import RiderApp from "./RiderApp";
import { getCatalog } from "../lib/catalog";
import { CatalogProvider } from "../lib/CatalogProvider";

export const metadata: Metadata = { title: "DriveWay Rider", description: "Go online, accept rides, manage your wallet and track your earnings." };

// Hotspots and incentives — refresh from Supabase at most once a minute.
export const revalidate = 60;

export default async function Page() {
  const catalog = await getCatalog();
  return (
    <CatalogProvider catalog={catalog}>
      <RiderApp />
    </CatalogProvider>
  );
}
