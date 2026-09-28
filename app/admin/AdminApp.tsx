"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BrandMark, Wordmark } from "../components/Brand";
import MapView from "../components/MapView";
import VehicleArt from "../components/VehicleArt";
import {
  BellIcon, CarIcon, ChartIcon, CheckIcon, DocIcon, DownloadIcon, GearIcon, GridIcon, HelpIcon, LockIcon, LogoutIcon,
  MapIcon, MegaphoneIcon, RupeeIcon, SearchIcon, SteeringIcon, TagIcon, UsersIcon, XIcon,
} from "../components/icons";
import { Avatar, PrimaryButton, StatusBadge, Toggle, card, field, label } from "../components/ui";
import {
  COUPONS, CUSTOMERS, DRIVERS, RIDES, TICKETS, TXNS, VEHICLES, WEEK, inr, vehicleById,
  type Coupon, type Customer, type Driver, type Ride, type Ticket, type Vehicle,
} from "../lib/data";

type Section = "dashboard" | "live" | "rides" | "customers" | "drivers" | "pricing" | "coupons" | "payments" | "reports" | "support" | "notify" | "settings";

const NAV: { id: Section; label: string; Icon: (p: { s?: number; c?: string }) => React.ReactElement }[] = [
  { id: "dashboard", label: "Dashboard", Icon: GridIcon },
  { id: "live", label: "Live Rides", Icon: MapIcon },
  { id: "rides", label: "Rides", Icon: CarIcon },
  { id: "customers", label: "Customers", Icon: UsersIcon },
  { id: "drivers", label: "Drivers", Icon: SteeringIcon },
  { id: "pricing", label: "Pricing", Icon: RupeeIcon },
  { id: "coupons", label: "Coupons", Icon: TagIcon },
  { id: "payments", label: "Payments", Icon: DocIcon },
  { id: "reports", label: "Reports", Icon: ChartIcon },
  { id: "support", label: "Support", Icon: HelpIcon },
  { id: "notify", label: "Notifications", Icon: MegaphoneIcon },
  { id: "settings", label: "Settings", Icon: GearIcon },
];

const AUTH_KEY = "driveway:admin";
const readAdmin = () => { try { return sessionStorage.getItem(AUTH_KEY) === "1"; } catch { return false; } };
const writeAdmin = (v: boolean) => { try { if (v) sessionStorage.setItem(AUTH_KEY, "1"); else sessionStorage.removeItem(AUTH_KEY); } catch { /* storage blocked */ } };

export default function AdminApp() {
  const [authed, setAuthed] = useState(false);
  const [section, setSection] = useState<Section>("dashboard");
  const [drivers, setDrivers] = useState<Driver[]>(DRIVERS);
  const [customers, setCustomers] = useState<Customer[]>(CUSTOMERS);
  const [vehicles, setVehicles] = useState<Vehicle[]>(VEHICLES);
  const [coupons, setCoupons] = useState<Coupon[]>(COUPONS);
  const [tickets, setTickets] = useState<Ticket[]>(TICKETS);
  const [commission, setCommission] = useState(20);
  const [surge, setSurge] = useState({ on: true, mult: 1.3 });
  const [toast, setToast] = useState<string | null>(null);

  // Stay signed in for this browser tab.
  useEffect(() => { if (readAdmin()) setAuthed(true); }, []);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2200); };

  if (!authed) return <AdminLogin onLogin={() => { writeAdmin(true); setAuthed(true); }} />;

  const pending = drivers.filter((d) => d.kyc === "Pending").length;
  const open = tickets.filter((t) => t.status !== "Resolved").length;

  return (
    <div className="adm-shell">
      <aside className="adm-side">
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 6px", flexShrink: 0 }}>
          <BrandMark size={30} />
          <Wordmark light sub="ADMIN PANEL" size={18} />
        </div>
        <nav className="adm-nav" aria-label="Admin sections">
          {NAV.map(({ id, label: l, Icon }) => {
            const on = id === section;
            const badge = id === "drivers" ? pending : id === "support" ? open : 0;
            return (
              <button key={id} onClick={() => setSection(id)} aria-current={on ? "page" : undefined} style={{
                display: "flex", alignItems: "center", gap: 11, border: "none", cursor: "pointer", borderRadius: 12, padding: "10px 12px",
                background: on ? "var(--gold)" : "transparent", color: on ? "var(--blue-dark)" : "rgba(255,255,255,0.75)",
                fontSize: 13.5, fontWeight: on ? 700 : 500, textAlign: "left", whiteSpace: "nowrap", flexShrink: 0,
              }}>
                <Icon s={18} c={on ? "var(--blue-dark)" : "rgba(255,255,255,0.75)"} />
                <span style={{ flex: 1 }}>{l}</span>
                {badge > 0 && <span style={{ minWidth: 20, height: 20, borderRadius: 10, background: on ? "var(--blue-dark)" : "var(--red)", color: "white", fontSize: 10.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 6px" }}>{badge}</span>}
              </button>
            );
          })}
        </nav>
        <div className="adm-side-foot" style={{ marginTop: "auto", paddingTop: 20, display: "flex", flexDirection: "column", gap: 8 }}>
          <p style={{ margin: "0 6px", fontSize: 11.5, color: "rgba(255,255,255,0.5)" }}>
            <Link href="/" style={{ color: "rgba(255,255,255,0.7)" }}>Customer app</Link> · <Link href="/driver" style={{ color: "rgba(255,255,255,0.7)" }}>Driver app</Link>
          </p>
          <button onClick={() => { writeAdmin(false); setAuthed(false); }} style={{ display: "flex", alignItems: "center", gap: 10, border: "none", background: "rgba(255,255,255,0.08)", color: "white", borderRadius: 12, padding: "10px 12px", cursor: "pointer", fontSize: 13.5, fontWeight: 500 }}>
            <LogoutIcon s={18} c="white" /> Log out
          </button>
        </div>
      </aside>

      <main className="adm-main">
        <TopBar title={NAV.find((n) => n.id === section)!.label} alerts={pending + open} />
        {section === "dashboard" && <Dashboard drivers={drivers} pending={pending} open={open} go={setSection} />}
        {section === "live" && <LiveRides />}
        {section === "rides" && <RidesSection />}
        {section === "customers" && <CustomersSection rows={customers} onToggle={(id) => {
          setCustomers((c) => c.map((x) => (x.id === id ? { ...x, blocked: !x.blocked } : x)));
          const c = customers.find((x) => x.id === id)!; flash(`${c.name} ${c.blocked ? "unblocked" : "blocked"}`);
        }} />}
        {section === "drivers" && <DriversSection rows={drivers} onUpdate={(id, p, msg) => { setDrivers((d) => d.map((x) => (x.id === id ? { ...x, ...p } : x))); flash(msg); }} />}
        {section === "pricing" && <PricingSection vehicles={vehicles} setVehicles={setVehicles} commission={commission} setCommission={setCommission} surge={surge} setSurge={setSurge} onSave={() => flash("Pricing saved — applies to new bookings")} />}
        {section === "coupons" && <CouponsSection rows={coupons} setRows={setCoupons} flash={flash} />}
        {section === "payments" && <PaymentsSection />}
        {section === "reports" && <ReportsSection flash={flash} />}
        {section === "support" && <SupportSection rows={tickets} setRows={setTickets} flash={flash} />}
        {section === "notify" && <NotifySection flash={flash} />}
        {section === "settings" && <SettingsSection flash={flash} />}
      </main>

      {toast && (
        <div className="fade-up" role="status" style={{ position: "fixed", left: "50%", bottom: 28, transform: "translateX(-50%)", zIndex: 300, background: "var(--ink)", color: "white", borderRadius: 14, padding: "12px 18px", fontSize: 13.5, fontWeight: 500, boxShadow: "var(--shadow-xl)" }}>{toast}</div>
      )}
    </div>
  );
}

/* ───────────────────────── Shared bits ───────────────────────── */

function TopBar({ title, alerts }: { title: string; alerts: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-soft)" }}>Monday, 28 September 2026</p>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>{title}</h1>
      </div>
      <span style={{ position: "relative", width: 42, height: 42, borderRadius: 12, background: "var(--surface)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "var(--shadow-card)" }}>
        <BellIcon s={20} c="var(--ink-soft)" />
        {alerts > 0 && <span style={{ position: "absolute", top: 8, right: 9, width: 8, height: 8, borderRadius: "50%", background: "var(--red)" }} />}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Avatar initials="AD" size={40} tone="gold" />
        <div className="adm-hide-sm"><p style={{ margin: 0, fontSize: 13.5, fontWeight: 600 }}>Admin</p><p style={{ margin: 0, fontSize: 11.5, color: "var(--ink-soft)" }}>Super admin</p></div>
      </div>
    </div>
  );
}

function Panel({ title, right, children, pad = 16 }: { title?: string; right?: React.ReactNode; children: React.ReactNode; pad?: number }) {
  return (
    <section style={{ ...card, padding: pad }}>
      {title && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
          <h2 style={{ margin: 0, fontSize: 15.5, fontWeight: 700 }}>{title}</h2>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

function Stat({ label: l, value, delta, tone = "plain", onClick }: { label: string; value: string; delta?: string; tone?: "plain" | "blue" | "gold" | "red"; onClick?: () => void }) {
  const blue = tone === "blue";
  return (
    <button onClick={onClick} className="press" style={{
      ...card, border: "none", textAlign: "left", cursor: onClick ? "pointer" : "default", padding: "16px 16px",
      background: blue ? "linear-gradient(150deg,var(--blue-dark),var(--blue))" : "var(--surface)", color: blue ? "white" : "var(--ink)",
      boxShadow: blue ? "0 10px 24px rgba(11,92,255,0.25)" : "var(--shadow-card)",
    }}>
      <p style={{ margin: 0, fontSize: 12.5, color: blue ? "rgba(255,255,255,0.75)" : "var(--ink-soft)", fontWeight: 500 }}>{l}</p>
      <p style={{ margin: "6px 0 0", fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", color: tone === "gold" ? "var(--gold-dark)" : tone === "red" ? "var(--red)" : undefined }}>{value}</p>
      {delta && <p style={{ margin: "2px 0 0", fontSize: 11.5, fontWeight: 600, color: blue ? "var(--gold)" : "var(--success-text)" }}>{delta}</p>}
    </button>
  );
}

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--bg-secondary)", borderRadius: 12, padding: "8px 12px", minWidth: 220 }}>
      <SearchIcon s={17} c="var(--ink-mute)" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} style={{ border: "none", outline: "none", background: "transparent", fontSize: 13.5, flex: 1, color: "var(--ink)" }} />
    </label>
  );
}

function Chips<T extends string>({ value, options, onChange }: { value: T; options: T[]; onChange: (v: T) => void }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {options.map((o) => {
        const on = o === value;
        return <button key={o} onClick={() => onChange(o)} aria-pressed={on} style={{ border: on ? "1.5px solid var(--blue)" : "1.5px solid var(--line)", background: on ? "var(--blue-tint)" : "var(--surface)", color: on ? "var(--blue)" : "var(--ink-soft)", borderRadius: 999, padding: "5px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>{o}</button>;
      })}
    </div>
  );
}

/** Right-side detail drawer. */
function Drawer({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", justifyContent: "flex-end" }}>
      <div onClick={onClose} className="fade-up" style={{ position: "absolute", inset: 0, background: "rgba(15,23,41,0.4)" }} />
      <div className="fade-up" style={{ position: "relative", width: "min(440px, 100%)", height: "100%", background: "var(--app-bg)", overflowY: "auto", padding: 20, boxShadow: "var(--shadow-xl)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{title}</h2>
          <button onClick={onClose} aria-label="Close" style={{ border: "none", background: "var(--surface)", width: 36, height: 36, borderRadius: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><XIcon s={18} c="var(--ink)" /></button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>{children}</div>
      </div>
    </div>
  );
}

const kv = (k: string, v: React.ReactNode) => (
  <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13.5, padding: "6px 0", borderBottom: "1px solid var(--line)" }}>
    <span style={{ color: "var(--ink-soft)" }}>{k}</span><span style={{ fontWeight: 600, textAlign: "right" }}>{v}</span>
  </div>
);

const smallBtn = (tone: "blue" | "green" | "red" | "ghost"): React.CSSProperties => ({
  border: tone === "ghost" ? "1.5px solid var(--line)" : "none", borderRadius: 10, padding: "7px 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer",
  background: { blue: "var(--blue)", green: "var(--green)", red: "var(--error)", ghost: "var(--surface)" }[tone],
  color: { blue: "white", green: "white", red: "var(--error-text)", ghost: "var(--ink)" }[tone],
});

function BarChart({ data, format, color = "var(--blue)" }: { data: { d: string; v: number }[]; format: (n: number) => string; color?: string }) {
  const max = Math.max(...data.map((x) => x.v));
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 190, paddingTop: 20 }}>
      {data.map((b, i) => (
        <div key={b.d} style={{ flex: 1, height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", gap: 6 }} title={`${b.d}: ${format(b.v)}`}>
          <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--ink-soft)" }}>{format(b.v)}</span>
          <div style={{ width: "100%", maxWidth: 40, height: `${(b.v / max) * 78}%`, borderRadius: "8px 8px 4px 4px", background: i === data.length - 1 ? "var(--gold)" : color }} />
          <span style={{ fontSize: 11.5, color: "var(--ink-mute)" }}>{b.d}</span>
        </div>
      ))}
    </div>
  );
}

const compact = (n: number) => (n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

/* ───────────────────────── Login ───────────────────────── */

function AdminLogin({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState("admin@driveway.in");
  const [pw, setPw] = useState("");
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "linear-gradient(165deg,#04246b 0%,#020b24 100%)" }}>
      <form onSubmit={(e) => { e.preventDefault(); if (pw) onLogin(); }} className="fade-up" style={{ ...card, width: "min(400px,100%)", padding: 28, background: "var(--app-bg)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center" }}><BrandMark size={40} /><Wordmark sub="ADMIN PANEL" size={22} /></div>
        <h1 style={{ margin: "22px 0 4px", fontSize: 22, fontWeight: 800, textAlign: "center" }}>Admin Portal</h1>
        <p style={{ margin: "0 0 20px", fontSize: 13.5, color: "var(--ink-soft)", textAlign: "center" }}>Sign in to manage rides, drivers and payments</p>
        <label style={label} htmlFor="ae">Email</label>
        <input id="ae" type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ ...field, marginBottom: 14 }} autoComplete="username" />
        <label style={label} htmlFor="ap">Password</label>
        <input id="ap" type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Any password (demo)" style={{ ...field, marginBottom: 20 }} autoComplete="current-password" />
        <PrimaryButton type="submit" disabled={!pw}><LockIcon s={17} c={pw ? "white" : "var(--ink-mute)"} /> Login</PrimaryButton>
        <p style={{ margin: "14px 0 0", fontSize: 11.5, color: "var(--ink-mute)", textAlign: "center" }}>Demo build · role-based access & audit logs come with the real API</p>
      </form>
    </div>
  );
}

/* ───────────────────────── Dashboard ───────────────────────── */

function Dashboard({ drivers, pending, open, go }: { drivers: Driver[]; pending: number; open: number; go: (s: Section) => void }) {
  const onlineNow = drivers.filter((d) => d.online && !d.suspended).length;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="adm-grid-4">
        <Stat label="Today's Revenue" value={inr(248000)} delta="↑ 15% vs last Sunday" tone="blue" onClick={() => go("reports")} />
        <Stat label="Today's Rides" value="1,248" delta="↑ 12%" onClick={() => go("rides")} />
        <Stat label="Online Drivers" value={`${245 + onlineNow}`} delta="↑ 8%" onClick={() => go("live")} />
        <Stat label="Total Customers" value="18,420" delta="↑ 214 this week" onClick={() => go("customers")} />
        <Stat label="Completed / Cancelled" value="1,164 / 84" />
        <Stat label="Registered Drivers" value="1,032" />
        <Stat label="Pending Approvals" value={String(pending)} tone="gold" onClick={() => go("drivers")} />
        <Stat label="Open Tickets" value={String(open)} tone="red" onClick={() => go("support")} />
      </div>
      <div className="adm-grid-2">
        <Panel title="Revenue · last 7 days" right={<span style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>Total {inr(WEEK.reduce((s, w) => s + w.revenue, 0))}</span>}>
          <BarChart data={WEEK.map((w) => ({ d: w.d, v: w.revenue }))} format={compact} />
        </Panel>
        <Panel title="Rides by vehicle">
          {[["sedan", 34], ["auto", 26], ["mini", 18], ["bike", 15], ["suv", 7]].map(([k, p]) => (
            <div key={k} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0" }}>
              <VehicleArt kind={k as Vehicle["id"]} size={40} />
              <span style={{ width: 52, fontSize: 13, fontWeight: 600 }}>{vehicleById(k as Vehicle["id"]).name}</span>
              <div style={{ flex: 1, height: 8, borderRadius: 4, background: "var(--line)" }}><div style={{ width: `${(p as number) * 2.5}%`, height: "100%", borderRadius: 4, background: "var(--blue)" }} /></div>
              <span style={{ width: 36, textAlign: "right", fontSize: 12.5, fontWeight: 700 }}>{p}%</span>
            </div>
          ))}
        </Panel>
      </div>
      <Panel title="Recent Rides" right={<button onClick={() => go("rides")} style={{ background: "none", border: "none", color: "var(--blue)", fontWeight: 600, cursor: "pointer" }}>View all →</button>}>
        <RidesTable rows={RIDES.slice(0, 5)} onOpen={() => go("rides")} />
      </Panel>
    </div>
  );
}

/* ───────────────────────── Rides ───────────────────────── */

function RidesTable({ rows, onOpen }: { rows: Ride[]; onOpen: (r: Ride) => void }) {
  return (
    <div className="adm-table-wrap">
      <table className="adm-table">
        <thead><tr><th>ID</th><th>Customer</th><th>Driver</th><th>Vehicle</th><th>Route</th><th>Status</th><th>Payment</th><th style={{ textAlign: "right" }}>Fare</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} onClick={() => onOpen(r)}>
              <td style={{ fontWeight: 700 }}>#{r.id}</td><td>{r.customer}</td><td>{r.driver}</td><td>{vehicleById(r.vehicle).name}</td>
              <td style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", color: "var(--ink-soft)" }}>{r.from} → {r.to}</td>
              <td><StatusBadge status={r.status === "Started" || r.status === "Arriving" ? "Ongoing" : r.status} /></td>
              <td>{r.pay} · <span style={{ color: r.paid ? "var(--success-text)" : "var(--warning-text)", fontWeight: 600 }}>{r.paid ? "Paid" : "Pending"}</span></td>
              <td style={{ textAlign: "right", fontWeight: 700 }}>{inr(r.fare - r.discount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <p style={{ textAlign: "center", color: "var(--ink-soft)", padding: 24 }}>No rides match these filters.</p>}
    </div>
  );
}

function RideDrawer({ r, onClose }: { r: Ride; onClose: () => void }) {
  const v = vehicleById(r.vehicle);
  const dist = Math.round(v.perKm * r.km);
  return (
    <Drawer title={`Ride #${r.id}`} onClose={onClose}>
      <MapView mode="route" height={170} radius={16} nearby={false} />
      <div style={{ ...card, padding: 14 }}>
        {kv("Status", <StatusBadge status={r.status} />)}
        {kv("Date", `${r.date}, ${r.time}`)}
        {kv("Customer", r.customer)}
        {kv("Driver", r.driver)}
        {kv("Vehicle", `${v.name} · ${r.km} km · ${r.min} min`)}
        {kv("Pickup", r.from)}
        {kv("Drop", r.to)}
        {r.cancelReason && kv("Cancellation", r.cancelReason)}
        {r.rating && kv("Rating", "★".repeat(r.rating))}
      </div>
      <div style={{ ...card, padding: 14 }}>
        <p style={{ margin: "0 0 6px", fontWeight: 700 }}>Fare breakdown</p>
        {kv("Base fare", inr(v.base))}
        {kv("Distance", inr(dist))}
        {kv("Time", inr(Math.max(0, r.fare - v.base - dist)))}
        {kv("Discount", "− " + inr(r.discount))}
        {kv("Total", inr(r.fare - r.discount))}
        {kv("Platform commission", inr((r.fare - r.discount) * 0.2))}
        {kv("Payment", `${r.pay} · ${r.paid ? "Paid" : "Pending"}`)}
      </div>
    </Drawer>
  );
}

function RidesSection() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("All");
  const [veh, setVeh] = useState("All");
  const [open, setOpen] = useState<Ride | null>(null);
  const rows = RIDES.filter((r) =>
    (status === "All" || (status === "Ongoing" ? ["Started", "Arriving", "Assigned", "Arrived"].includes(r.status) : r.status === status)) &&
    (veh === "All" || vehicleById(r.vehicle).name === veh) &&
    `${r.id} ${r.customer} ${r.driver} ${r.from} ${r.to}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <Panel>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", marginBottom: 14 }}>
        <SearchBox value={q} onChange={setQ} placeholder="Search ride, customer, driver…" />
        <Chips value={status} options={["All", "Ongoing", "Completed", "Cancelled"]} onChange={setStatus} />
        <Chips value={veh} options={["All", ...VEHICLES.map((v) => v.name)]} onChange={setVeh} />
      </div>
      <RidesTable rows={rows} onOpen={setOpen} />
      {open && <RideDrawer r={open} onClose={() => setOpen(null)} />}
    </Panel>
  );
}

function LiveRides() {
  const live = RIDES.filter((r) => ["Started", "Arriving", "Assigned", "Arrived"].includes(r.status));
  const [open, setOpen] = useState<Ride | null>(null);
  return (
    <div className="adm-grid-2">
      <Panel title="Live map" right={<span style={{ fontSize: 12.5, color: "var(--success-text)", fontWeight: 600 }}>● {live.length} rides in progress</span>}>
        <MapView mode="trip" progress={0.45} height={420} radius={14} nearby />
      </Panel>
      <Panel title="Ongoing rides">
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {live.map((r) => (
            <button key={r.id} onClick={() => setOpen(r)} className="press" style={{ display: "flex", alignItems: "center", gap: 12, border: "1px solid var(--line)", background: "var(--surface)", borderRadius: 14, padding: 12, cursor: "pointer", textAlign: "left" }}>
              <VehicleArt kind={r.vehicle} size={48} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700 }}>#{r.id} · {r.driver}</p>
                <p style={{ margin: 0, fontSize: 12, color: "var(--ink-soft)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.from} → {r.to}</p>
              </div>
              <StatusBadge status={r.status} />
            </button>
          ))}
        </div>
      </Panel>
      {open && <RideDrawer r={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

/* ───────────────────────── Customers ───────────────────────── */

function CustomersSection({ rows, onToggle }: { rows: Customer[]; onToggle: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const list = rows.filter((c) => `${c.name} ${c.phone} ${c.email} ${c.id}`.toLowerCase().includes(q.toLowerCase()));
  const sel = rows.find((c) => c.id === open);
  return (
    <Panel title={`${rows.length} customers`} right={<SearchBox value={q} onChange={setQ} placeholder="Search name, phone, email…" />}>
      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead><tr><th>Name</th><th>Phone</th><th>Email</th><th>Rides</th><th>Spent</th><th>Joined</th><th>Status</th><th /></tr></thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.id} onClick={() => setOpen(c.id)}>
                <td><span style={{ display: "flex", alignItems: "center", gap: 10 }}><Avatar initials={c.initials} size={30} />{c.name}</span></td>
                <td>{c.phone}</td><td style={{ color: "var(--ink-soft)" }}>{c.email}</td><td>{c.rides}</td><td>{inr(c.spent)}</td><td>{c.joined}</td>
                <td><StatusBadge status={c.blocked ? "Blocked" : "Active"} /></td>
                <td><button onClick={(e) => { e.stopPropagation(); onToggle(c.id); }} style={smallBtn(c.blocked ? "ghost" : "red")}>{c.blocked ? "Unblock" : "Block"}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sel && (
        <Drawer title={sel.name} onClose={() => setOpen(null)}>
          <div style={{ ...card, padding: 14 }}>
            {kv("Customer ID", sel.id)}{kv("Phone", sel.phone)}{kv("Email", sel.email)}{kv("Joined", sel.joined)}
            {kv("Total rides", sel.rides)}{kv("Total spent", inr(sel.spent))}{kv("Rating", `★ ${sel.rating}`)}{kv("Complaints", sel.complaints)}
            {kv("Account", <StatusBadge status={sel.blocked ? "Blocked" : "Active"} />)}
          </div>
          <Panel title="Ride history">
            {RIDES.filter((r) => r.customer === sel.name).map((r) => <div key={r.id}>{kv(`#${r.id} · ${r.date}`, <>{inr(r.fare)} <StatusBadge status={r.status} /></>)}</div>)}
          </Panel>
          <PrimaryButton tone={sel.blocked ? "blue" : "red"} onClick={() => onToggle(sel.id)}>{sel.blocked ? "Unblock account" : "Block account"}</PrimaryButton>
        </Drawer>
      )}
    </Panel>
  );
}

/* ───────────────────────── Drivers ───────────────────────── */

function DriversSection({ rows, onUpdate }: { rows: Driver[]; onUpdate: (id: string, p: Partial<Driver>, msg: string) => void }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("All");
  const [open, setOpen] = useState<string | null>(null);
  const list = rows.filter((d) =>
    (filter === "All" || (filter === "Pending KYC" ? d.kyc === "Pending" : filter === "Online" ? d.online && !d.suspended : filter === "Suspended" ? d.suspended : true)) &&
    `${d.name} ${d.phone} ${d.plate} ${d.id}`.toLowerCase().includes(q.toLowerCase()));
  const sel = rows.find((d) => d.id === open);
  const state = (d: Driver) => (d.suspended ? "Suspended" : d.kyc !== "Approved" ? d.kyc : d.online ? "Online" : "Offline");
  return (
    <Panel>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", marginBottom: 14 }}>
        <SearchBox value={q} onChange={setQ} placeholder="Search name, phone, vehicle no…" />
        <Chips value={filter} options={["All", "Pending KYC", "Online", "Suspended"]} onChange={setFilter} />
      </div>
      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead><tr><th>Driver</th><th>Vehicle</th><th>Number</th><th>City</th><th>Trips</th><th>Rating</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {list.map((d) => (
              <tr key={d.id} onClick={() => setOpen(d.id)}>
                <td><span style={{ display: "flex", alignItems: "center", gap: 10 }}><Avatar initials={d.initials} size={30} />{d.name}</span></td>
                <td>{vehicleById(d.vehicle).name}</td><td style={{ fontWeight: 600 }}>{d.plate}</td><td>{d.city}</td><td>{d.trips.toLocaleString("en-IN")}</td>
                <td>{d.rating ? `★ ${d.rating}` : "—"}</td><td><StatusBadge status={state(d)} /></td>
                <td onClick={(e) => e.stopPropagation()}>
                  {d.kyc === "Pending" ? (
                    <span style={{ display: "flex", gap: 6 }}>
                      <button style={smallBtn("green")} onClick={() => onUpdate(d.id, { kyc: "Approved" }, `${d.name} approved`)}>Approve</button>
                      <button style={smallBtn("red")} onClick={() => onUpdate(d.id, { kyc: "Rejected" }, `${d.name} rejected`)}>Reject</button>
                    </span>
                  ) : d.kyc === "Approved" ? (
                    <button style={smallBtn(d.suspended ? "ghost" : "red")} onClick={() => onUpdate(d.id, { suspended: !d.suspended, online: false }, `${d.name} ${d.suspended ? "reactivated" : "suspended"}`)}>{d.suspended ? "Reactivate" : "Suspend"}</button>
                  ) : <button style={smallBtn("ghost")} onClick={() => onUpdate(d.id, { kyc: "Pending" }, `${d.name} moved back to review`)}>Re-review</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sel && (
        <Drawer title={sel.name} onClose={() => setOpen(null)}>
          <div style={{ ...card, padding: 14, display: "flex", alignItems: "center", gap: 12 }}>
            <Avatar initials={sel.initials} size={52} />
            <div style={{ flex: 1 }}><p style={{ margin: 0, fontWeight: 700 }}>{sel.name}</p><p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-soft)" }}>{sel.id} · {sel.phone}</p></div>
            <StatusBadge status={state(sel)} />
          </div>
          <div style={{ ...card, padding: 14, display: "flex", alignItems: "center", gap: 12 }}>
            <VehicleArt kind={sel.vehicle} size={64} />
            <div><p style={{ margin: 0, fontWeight: 700 }}>{sel.model}</p><p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-soft)" }}>{vehicleById(sel.vehicle).name} · {sel.plate}</p></div>
          </div>
          <Panel title="KYC documents">
            {["Profile photo", "Driving licence", "Vehicle RC", "Insurance", "Aadhaar"].map((doc) => (
              <div key={doc} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
                <DocIcon s={18} c="var(--ink-soft)" /><span style={{ flex: 1, fontSize: 13.5 }}>{doc}</span>
                <StatusBadge status={sel.kyc === "Approved" ? "Approved" : sel.kyc === "Rejected" ? "Rejected" : "Pending"} />
              </div>
            ))}
          </Panel>
          <div style={{ ...card, padding: 14 }}>
            {kv("City", sel.city)}{kv("Joined", sel.joined)}{kv("Trips", sel.trips.toLocaleString("en-IN"))}{kv("Lifetime earnings", inr(sel.earnings))}{kv("Pending settlement", inr(sel.trips ? 6420 : 0))}
          </div>
          {sel.kyc === "Pending" && (
            <div style={{ display: "flex", gap: 10 }}>
              <PrimaryButton tone="red" onClick={() => onUpdate(sel.id, { kyc: "Rejected" }, `${sel.name} rejected`)}>Reject</PrimaryButton>
              <PrimaryButton onClick={() => onUpdate(sel.id, { kyc: "Approved" }, `${sel.name} approved`)}><CheckIcon s={16} c="white" /> Approve</PrimaryButton>
            </div>
          )}
        </Drawer>
      )}
    </Panel>
  );
}

/* ───────────────────────── Pricing ───────────────────────── */

function PricingSection({ vehicles, setVehicles, commission, setCommission, surge, setSurge, onSave }: {
  vehicles: Vehicle[]; setVehicles: (v: Vehicle[]) => void; commission: number; setCommission: (n: number) => void;
  surge: { on: boolean; mult: number }; setSurge: (s: { on: boolean; mult: number }) => void; onSave: () => void;
}) {
  const upd = (id: string, k: keyof Vehicle, v: number | boolean) => setVehicles(vehicles.map((x) => (x.id === id ? { ...x, [k]: v } : x)));
  const num: React.CSSProperties = { ...field, width: 84, padding: "7px 10px", fontSize: 13 };
  const cols: [keyof Vehicle, string][] = [["base", "Base ₹"], ["perKm", "₹ / km"], ["perMin", "₹ / min"], ["minFare", "Min fare ₹"], ["cancelFee", "Cancel fee ₹"]];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Panel title="Vehicle categories & fares" right={<PrimaryButton onClick={onSave} style={{ width: "auto", padding: "10px 18px", fontSize: 13.5 }}>Save changes</PrimaryButton>}>
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr><th>Category</th>{cols.map(([, l]) => <th key={l}>{l}</th>)}<th>Sample 5 km / 15 min</th><th>Enabled</th></tr></thead>
            <tbody>
              {vehicles.map((v) => (
                <tr key={v.id} style={{ cursor: "default" }}>
                  <td><span style={{ display: "flex", alignItems: "center", gap: 8 }}><VehicleArt kind={v.id} size={40} /><b>{v.name}</b></span></td>
                  {cols.map(([k]) => (
                    <td key={k}><input type="number" min={0} step={k === "perMin" ? 0.5 : 1} value={v[k] as number} aria-label={`${v.name} ${k}`}
                      onChange={(e) => upd(v.id, k, Number(e.target.value))} style={num} /></td>
                  ))}
                  <td style={{ fontWeight: 700 }}>{inr(Math.max(v.minFare, v.base + v.perKm * 5 + v.perMin * 15))}</td>
                  <td><Toggle on={v.enabled} onChange={(on) => upd(v.id, "enabled", on)} label={`${v.name} enabled`} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <div className="adm-grid-2">
        <Panel title="Platform commission">
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <input type="range" min={5} max={35} value={commission} onChange={(e) => setCommission(Number(e.target.value))} style={{ flex: 1, accentColor: "var(--blue)" }} aria-label="Commission percent" />
            <span style={{ fontSize: 24, fontWeight: 800, width: 64, textAlign: "right" }}>{commission}%</span>
          </div>
          <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "var(--ink-soft)" }}>On a ₹200 ride the driver earns {inr(200 * (1 - commission / 100))}, DriveWay keeps {inr(200 * commission / 100)}.</p>
        </Panel>
        <Panel title="Surge / peak pricing" right={<Toggle on={surge.on} onChange={(on) => setSurge({ ...surge, on })} label="Surge pricing" />}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, opacity: surge.on ? 1 : 0.45 }}>
            <input type="range" min={1} max={2.5} step={0.1} disabled={!surge.on} value={surge.mult} onChange={(e) => setSurge({ ...surge, mult: Number(e.target.value) })} style={{ flex: 1, accentColor: "var(--gold)" }} aria-label="Surge multiplier" />
            <span style={{ fontSize: 24, fontWeight: 800, width: 64, textAlign: "right" }}>{surge.mult.toFixed(1)}×</span>
          </div>
          <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "var(--ink-soft)" }}>Applied 8–11 AM and 6–9 PM on weekdays when demand exceeds supply.</p>
        </Panel>
      </div>
      <Panel title="Service areas">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {[["Noida", true], ["Delhi", true], ["Gurugram", true], ["Lucknow", true], ["Ghaziabad", false], ["Faridabad", false]].map(([c, on]) => (
            <span key={c as string} style={{ display: "flex", alignItems: "center", gap: 8, border: "1.5px solid var(--line)", borderRadius: 12, padding: "8px 12px", fontSize: 13.5, fontWeight: 600 }}>
              {c as string} <StatusBadge status={on ? "Active" : "Inactive"} />
            </span>
          ))}
        </div>
      </Panel>
    </div>
  );
}

/* ───────────────────────── Coupons ───────────────────────── */

function CouponsSection({ rows, setRows, flash }: { rows: Coupon[]; setRows: (c: Coupon[]) => void; flash: (m: string) => void }) {
  const [code, setCode] = useState("");
  const [off, setOff] = useState(20);
  const [pct, setPct] = useState(true);
  const create = () => {
    if (!code.trim() || rows.some((c) => c.code === code)) return;
    setRows([{ code, title: pct ? `${off}% off` : `Flat ₹${off} off`, body: "New promotion", off, pct, max: pct ? 100 : undefined, expires: "31 Dec 2026", uses: 0, active: true }, ...rows]);
    setCode(""); flash(`Coupon ${code} created`);
  };
  return (
    <div className="adm-grid-2">
      <Panel title="Coupons & offers">
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr><th>Code</th><th>Offer</th><th>Expires</th><th>Uses</th><th>Active</th></tr></thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.code} style={{ cursor: "default" }}>
                  <td><span style={{ fontWeight: 700, color: "var(--gold-dark)", border: "1.5px dashed var(--gold)", borderRadius: 8, padding: "2px 8px" }}>{c.code}</span></td>
                  <td>{c.title}</td><td>{c.expires}</td><td>{(c.uses ?? 0).toLocaleString("en-IN")}</td>
                  <td><Toggle on={!!c.active} onChange={(on) => setRows(rows.map((x) => (x.code === c.code ? { ...x, active: on } : x)))} label={`${c.code} active`} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel title="Create coupon">
        <label style={label} htmlFor="cc">Code</label>
        <input id="cc" value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s/g, ""))} placeholder="DIWALI30" style={{ ...field, marginBottom: 14 }} />
        <label style={label}>Discount type</label>
        <div style={{ marginBottom: 14 }}><Chips value={pct ? "Percent" : "Flat ₹"} options={["Percent", "Flat ₹"]} onChange={(v) => setPct(v === "Percent")} /></div>
        <label style={label} htmlFor="co">Value</label>
        <input id="co" type="number" min={1} value={off} onChange={(e) => setOff(Number(e.target.value))} style={{ ...field, marginBottom: 18 }} />
        <PrimaryButton onClick={create} disabled={!code.trim()}>Create Coupon</PrimaryButton>
      </Panel>
    </div>
  );
}

/* ───────────────────────── Payments ───────────────────────── */

function PaymentsSection() {
  const [kind, setKind] = useState("All");
  const rows = TXNS.filter((t) => kind === "All" || t.kind === kind);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="adm-grid-4">
        <Stat label="Collected today" value={inr(248000)} tone="blue" />
        <Stat label="Commission earned" value={inr(49600)} delta="20% avg" />
        <Stat label="Pending driver payouts" value={inr(186400)} tone="gold" />
        <Stat label="Refunds (7 days)" value={inr(3240)} tone="red" />
      </div>
      <Panel title="Transactions" right={<Chips value={kind} options={["All", "Ride Fare", "Commission", "Driver Payout", "Refund"]} onChange={setKind} />}>
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr><th>Txn</th><th>Type</th><th>Party</th><th>Ride</th><th>Method</th><th>Date</th><th style={{ textAlign: "right" }}>Amount</th></tr></thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id} style={{ cursor: "default" }}>
                  <td style={{ fontWeight: 700 }}>{t.id}</td><td>{t.kind}</td><td>{t.who}</td><td>{t.ride ? `#${t.ride}` : "—"}</td><td>{t.method}</td><td>{t.at}</td>
                  <td style={{ textAlign: "right", fontWeight: 700, color: t.amount < 0 ? "var(--red)" : "var(--success-text)" }}>{t.amount < 0 ? "− " : "+ "}{inr(Math.abs(t.amount))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

/* ───────────────────────── Reports ───────────────────────── */

function ReportsSection({ flash }: { flash: (m: string) => void }) {
  const [range, setRange] = useState("Last 7 days");
  const exportCsv = () => {
    const head = "Ride,Date,Customer,Driver,Vehicle,Km,Fare,Discount,Commission,Payment,Status";
    const lines = RIDES.map((r) => [r.id, r.date, r.customer, r.driver, r.vehicle, r.km, r.fare, r.discount, Math.round((r.fare - r.discount) * 0.2), r.pay, r.status].join(","));
    const url = URL.createObjectURL(new Blob([[head, ...lines].join("\n")], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = "driveway-rides-report.csv"; a.click(); URL.revokeObjectURL(url);
    flash("Report exported");
  };
  const totals = useMemo(() => ({ rev: WEEK.reduce((s, w) => s + w.revenue, 0), rides: WEEK.reduce((s, w) => s + w.rides, 0) }), []);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <Chips value={range} options={["Today", "Last 7 days", "This month"]} onChange={setRange} />
        <button onClick={exportCsv} style={{ ...smallBtn("blue"), display: "flex", alignItems: "center", gap: 6, padding: "9px 14px" }}><DownloadIcon s={16} c="white" /> Export CSV</button>
      </div>
      <div className="adm-grid-4">
        <Stat label="Ride revenue" value={compact(totals.rev)} tone="blue" delta="↑ 13%" />
        <Stat label="Total rides" value={totals.rides.toLocaleString("en-IN")} delta="↑ 9%" />
        <Stat label="Driver earnings" value={compact(totals.rev * 0.8)} />
        <Stat label="Cancellation rate" value="6.7%" tone="red" />
      </div>
      <div className="adm-grid-2">
        <Panel title="Rides per day"><BarChart data={WEEK.map((w) => ({ d: w.d, v: w.rides }))} format={(n) => n.toLocaleString("en-IN")} color="var(--teal)" /></Panel>
        <Panel title="Cash vs online">
          {[["UPI", 46, "var(--blue)"], ["Cash", 31, "var(--gold)"], ["Card", 15, "var(--purple)"], ["Wallet", 8, "var(--green)"]].map(([l, p, c]) => (
            <div key={l as string} style={{ padding: "8px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600, marginBottom: 5 }}><span>{l as string}</span><span>{p as number}%</span></div>
              <div style={{ height: 8, borderRadius: 4, background: "var(--line)" }}><div style={{ width: `${p}%`, height: "100%", borderRadius: 4, background: c as string }} /></div>
            </div>
          ))}
        </Panel>
      </div>
    </div>
  );
}

/* ───────────────────────── Support ───────────────────────── */

function SupportSection({ rows, setRows, flash }: { rows: Ticket[]; setRows: (t: Ticket[]) => void; flash: (m: string) => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const sel = rows.find((t) => t.id === open);
  const upd = (id: string, p: Partial<Ticket>) => setRows(rows.map((t) => (t.id === id ? { ...t, ...p } : t)));
  return (
    <Panel title="Support tickets">
      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead><tr><th>Ticket</th><th>From</th><th>Role</th><th>Subject</th><th>Ride</th><th>Raised</th><th>Status</th></tr></thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id} onClick={() => setOpen(t.id)}>
                <td style={{ fontWeight: 700 }}>{t.id}</td><td>{t.from}</td><td>{t.role}</td><td style={{ maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis" }}>{t.subject}</td>
                <td>{t.ride ? `#${t.ride}` : "—"}</td><td>{t.at}</td><td><StatusBadge status={t.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sel && (
        <Drawer title={`${sel.id} · ${sel.from}`} onClose={() => setOpen(null)}>
          <div style={{ ...card, padding: 14 }}>
            <p style={{ margin: 0, fontWeight: 700 }}>{sel.subject}</p>
            <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "var(--ink-soft)" }}>{sel.role} · {sel.at}{sel.ride && ` · Ride #${sel.ride}`}</p>
          </div>
          <div>
            <span style={label}>Status</span>
            <Chips value={sel.status} options={["Open", "In Progress", "Resolved"] as Ticket["status"][]} onChange={(s) => { upd(sel.id, { status: s }); flash(`${sel.id} marked ${s}`); }} />
          </div>
          <Panel title="Notes & replies">
            {sel.notes.length === 0 && <p style={{ margin: 0, fontSize: 13, color: "var(--ink-mute)" }}>No notes yet.</p>}
            {sel.notes.map((n, i) => <p key={i} style={{ margin: "0 0 8px", fontSize: 13.5, background: "var(--bg-secondary)", borderRadius: 10, padding: "8px 10px" }}>{n}</p>)}
            <form onSubmit={(e) => { e.preventDefault(); if (!note.trim()) return; upd(sel.id, { notes: [...sel.notes, note.trim()], status: sel.status === "Open" ? "In Progress" : sel.status }); setNote(""); }} style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a reply or internal note…" aria-label="Note" style={{ ...field, flex: 1, padding: "9px 12px" }} />
              <button type="submit" style={smallBtn("blue")}>Add</button>
            </form>
          </Panel>
        </Drawer>
      )}
    </Panel>
  );
}

/* ───────────────────────── Notifications ───────────────────────── */

function NotifySection({ flash }: { flash: (m: string) => void }) {
  const [aud, setAud] = useState("All customers");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sent, setSent] = useState([
    { t: "Weekend offer 🎉", a: "All customers", at: "27 Sep, 10:00 AM" },
    { t: "Complete 5 rides, get ₹500", a: "All drivers", at: "28 Sep, 07:00 AM" },
  ]);
  return (
    <div className="adm-grid-2">
      <Panel title="Broadcast announcement">
        <span style={label}>Audience</span>
        <div style={{ marginBottom: 14 }}><Chips value={aud} options={["All customers", "All drivers", "Noida only", "Inactive riders"]} onChange={setAud} /></div>
        <label style={label} htmlFor="nt">Title</label>
        <input id="nt" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Diwali rides at 30% off" style={{ ...field, marginBottom: 14 }} />
        <label style={label} htmlFor="nb">Message</label>
        <textarea id="nb" value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="Use code DIWALI30 on your next 3 rides…" style={{ ...field, resize: "none", marginBottom: 18 }} />
        <PrimaryButton disabled={!title.trim() || !body.trim()} onClick={() => { setSent([{ t: title, a: aud, at: "Just now" }, ...sent]); setTitle(""); setBody(""); flash(`Push notification queued for ${aud.toLowerCase()}`); }}>
          <MegaphoneIcon s={17} c="white" /> Send Notification
        </PrimaryButton>
      </Panel>
      <Panel title="Recently sent">
        {sent.map((s, i) => (
          <div key={i} style={{ padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{s.t}</p>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--ink-soft)" }}>{s.a} · {s.at}</p>
          </div>
        ))}
      </Panel>
    </div>
  );
}

/* ───────────────────────── Settings ───────────────────────── */

function SettingsSection({ flash }: { flash: (m: string) => void }) {
  const [s, setS] = useState({ cash: true, online: true, scheduled: false, sos: true, autoAssign: true, maintenance: false });
  const rows: [keyof typeof s, string, string][] = [
    ["cash", "Cash payments", "Let riders pay the driver in cash"],
    ["online", "Online payments", "UPI, cards and wallet through the payment gateway"],
    ["autoAssign", "Auto-assign nearest driver", "Dispatch requests to the closest eligible driver first"],
    ["sos", "SOS & trip sharing", "Show the SOS button during live rides"],
    ["scheduled", "Scheduled rides (beta)", "Future phase — book up to 7 days ahead"],
    ["maintenance", "Maintenance mode", "Temporarily stop new bookings"],
  ];
  return (
    <div className="adm-grid-2">
      <Panel title="App settings">
        {rows.map(([k, t, b]) => (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 0", borderBottom: "1px solid var(--line)" }}>
            <div style={{ flex: 1 }}><p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{t}</p><p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-soft)" }}>{b}</p></div>
            <Toggle on={s[k]} onChange={(v) => { setS({ ...s, [k]: v }); flash(`${t} ${v ? "enabled" : "disabled"}`); }} label={t} />
          </div>
        ))}
      </Panel>
      <Panel title="Admin team">
        {[["Alok Kumar", "Super admin", "AK"], ["Ritu Jain", "Operations", "RJ"], ["Sanjay Rao", "Finance", "SR"], ["Meera Nair", "Support", "MN"]].map(([n, r, i]) => (
          <div key={n} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
            <Avatar initials={i} size={36} /><div style={{ flex: 1 }}><p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{n}</p><p style={{ margin: 0, fontSize: 12, color: "var(--ink-soft)" }}>{r}</p></div>
          </div>
        ))}
        <p style={{ margin: "12px 0 0", fontSize: 12, color: "var(--ink-mute)" }}>Role-based permissions and audit logs for admin actions (PRD §11).</p>
      </Panel>
    </div>
  );
}
