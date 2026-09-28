import type { Metadata } from "next";
import DriverApp from "./DriverApp";

export const metadata: Metadata = { title: "DriveWay Driver", description: "Go online, accept rides and track your earnings." };

export default function Page() {
  return <DriverApp />;
}
