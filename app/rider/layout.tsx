import type { Viewport } from "next";

/* Rider app — its own blue shade comes from .theme-rider in globals.css. */
export const viewport: Viewport = { themeColor: "#1e3a8a" };

export default function RiderLayout({ children }: { children: React.ReactNode }) {
  return <div className="theme-rider">{children}</div>;
}
