import Link from "next/link";
import { ArrowRight, GridIcon, SteeringIcon, UserIcon } from "./components/icons";

/* Entry point: pick which DriveWay app to open. Each app lives on its own route. */
const APPS = [
  { href: "/customer", title: "Customer", body: "Book a Bike, Auto, Mini, Sedan or SUV, track it live and pay.", Icon: UserIcon, tone: "var(--blue)", tint: "var(--blue-tint)" },
  { href: "/rider", title: "Rider", body: "Go online, accept ride requests, run trips and manage earnings.", Icon: SteeringIcon, tone: "var(--green)", tint: "var(--success)" },
  { href: "/admin", title: "Admin", body: "Live rides, riders & KYC, customers, pricing, payments and support.", Icon: GridIcon, tone: "var(--gold-dark)", tint: "var(--gold-tint)" },
];

export default function Home() {
  return (
    <main style={{ minHeight: "100vh", background: "linear-gradient(165deg,#04246b 0%,#020b24 100%)", display: "flex", flexDirection: "column", alignItems: "center", padding: "56px 16px 40px" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/driveway-logo.png" alt="DriveWay" style={{ width: 200, maxWidth: "60%", height: "auto" }} />
      <p style={{ margin: "16px 0 32px", fontSize: 14.5, color: "rgba(255,255,255,0.7)", letterSpacing: "0.04em", textAlign: "center" }}>Ride · Reach · Relax — choose an app</p>
      <div style={{ width: "100%", maxWidth: 440, display: "flex", flexDirection: "column", gap: 12 }}>
        {APPS.map(({ href, title, body, Icon, tone, tint }) => (
          <Link key={href} href={href} className="press" style={{ display: "flex", alignItems: "center", gap: 14, background: "var(--surface)", borderRadius: 20, padding: 16, textDecoration: "none", color: "var(--ink)", boxShadow: "0 10px 28px rgba(0,0,0,0.25)" }}>
            <span style={{ width: 50, height: 50, borderRadius: 14, background: tint, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon s={25} c={tone} /></span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 16, fontWeight: 700 }}>{title} <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)" }}>{href}</span></span>
              <span style={{ display: "block", fontSize: 12.5, color: "var(--ink-soft)", lineHeight: 1.45 }}>{body}</span>
            </span>
            <ArrowRight s={18} c="var(--ink-mute)" />
          </Link>
        ))}
      </div>
    </main>
  );
}
