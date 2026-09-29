import type { Metadata } from "next";
import RiderApp from "./RiderApp";

export const metadata: Metadata = { title: "DriveWay Rider", description: "Go online, accept rides, manage your wallet and track your earnings." };

export default function Page() {
  return <RiderApp />;
}
