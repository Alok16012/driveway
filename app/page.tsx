import type { Metadata } from "next";
import CustomerApp from "./components/customer/CustomerApp";

/* The main route is the customer app (/customer redirects here). */
export const metadata: Metadata = { title: "DriveWay", description: "Book a Bike, Auto, Mini, Sedan or XL. Ride · Reach · Relax." };

export default function Home() {
  return <CustomerApp />;
}
