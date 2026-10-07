import type { Viewport } from "next";

/* Admin app — its own blue shade comes from .theme-admin in globals.css. */
export const viewport: Viewport = { themeColor: "#0369a1" };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="theme-admin">{children}</div>;
}
