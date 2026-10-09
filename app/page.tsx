import type { Metadata } from "next";
import CustomerApp from "./customer/CustomerApp";

/* Entry point: the main route opens the customer app directly (also served at /customer). */
export const metadata: Metadata = { title: "DriveWay", description: "Book a Bike, Auto, Mini, Sedan or XL. Ride · Reach · Relax." };

export default function Home() {
  return <CustomerApp />;
}
