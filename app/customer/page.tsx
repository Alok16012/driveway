import type { Metadata } from "next";
import CustomerApp from "./CustomerApp";

export const metadata: Metadata = { title: "DriveWay", description: "Book a Bike, Auto, Mini, Sedan or XL. Ride · Reach · Relax." };

export default function Page() {
  return <CustomerApp />;
}
