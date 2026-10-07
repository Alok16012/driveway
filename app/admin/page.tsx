import type { Metadata } from "next";
import AdminApp, { AdminLogin } from "./AdminApp";
import { isAdmin } from "../lib/admin-auth";
import { getAdminData } from "../lib/admin-data";
import { getCatalog } from "../lib/catalog";
import { CatalogProvider } from "../lib/CatalogProvider";

export const metadata: Metadata = { title: "DriveWay Admin", description: "Manage rides, drivers, customers, pricing and payments." };

// Admins always see live data, including inactive coupons.
export const revalidate = 0;

export default async function Page() {
  // Nothing is loaded with the service-role key until the admin session checks out.
  if (!(await isAdmin())) return <AdminLogin />;
  const [catalog, data] = await Promise.all([getCatalog({ asAdmin: true }), getAdminData()]);
  return (
    <CatalogProvider catalog={catalog}>
      <AdminApp data={data} />
    </CatalogProvider>
  );
}
