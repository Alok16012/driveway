import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";

// Same typeface as the Zavtoo customer app — self-hosted via next/font.
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-poppins",
});

export const metadata: Metadata = {
  title: "DriveWay",
  description: "DriveWay — book a Bike, Auto, Mini, Sedan or XL. Ride · Reach · Relax.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ea580c",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={poppins.variable} style={{ background: "#ea580c" }}>
      {/* Inline orange so the first paint matches the launch screen, before the stylesheet arrives. */}
      <body style={{ margin: 0, padding: 0, minHeight: "100vh", fontFamily: "var(--font-poppins)", background: "#ea580c" }}>
        {children}
      </body>
    </html>
  );
}
