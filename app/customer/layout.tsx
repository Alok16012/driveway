import type { Viewport } from "next";

/* Customer app — its own blue shade comes from .theme-customer in globals.css. */
export const viewport: Viewport = { themeColor: "#eef1fb" };

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return <div className="theme-customer">{children}</div>;
}
