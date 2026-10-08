"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BrandMark, Wordmark } from "../components/Brand";
import MapView from "../components/MapView";
import VehicleArt from "../components/VehicleArt";
import {
  BellIcon, CarIcon, ChartIcon, CheckIcon, DocIcon, DownloadIcon, GearIcon, GridIcon, HelpIcon, LockIcon, LogoutIcon,
  MapIcon, MegaphoneIcon, RupeeIcon, SearchIcon, SteeringIcon, TagIcon, UsersIcon, XIcon,
} from "../components/icons";
import { Avatar, ErrorText, LoadState, PrimaryButton, StatusBadge, Toggle, card, field, label } from "../components/ui";
import { inr, vehicleById, type VehicleKind } from "../lib/data";
import { adminSignIn, friendly, getSession, myProfile, newKey, onAuthChange, rpc, signOut } from "../lib/api";
import { supabase } from "../lib/supabase/client";

/* ───────────────────────── Data shapes (rows the admin's RLS lets it read) ───────────────────────── */

interface Prof { id: string; name: string; phone: string | null; email: string | null; blocked: boolean; rating: number | null; is_admin: boolean; created_at: string }
interface Drv {
  id: string; name: string; vehicle: VehicleKind; model: string; plate: string; ac: boolean; city: string; kyc: "Pending" | "Approved" | "Rejected";
  kyc_note: string | null; docs: Record<string, string>; upi: string | null; suspended: boolean; online: boolean; last_seen: string | null;
  rating: number | null; trips: number; created_at: string; profiles: { phone: string | null; blocked: boolean } | null;
}
interface RideRow {
  id: string; code: string; customer_id: string; driver_id: string | null; service: string; vehicle: VehicleKind | null; requested_vehicles: VehicleKind[];
  ac: boolean; from_place: string; to_place: string; km: number; mins: number; fare: number; discount: number; coupon_code: string | null; wait_fee: number;
  cancel_fee: number; total: number; pay_method: string; payment_status: string; refunded: number; status: string; cancel_reason: string | null;
  cancelled_by: string | null; rating: number | null; created_at: string; completed_at: string | null; scheduled_for: string | null;
}
interface Vehicle { id: VehicleKind; name: string; base: number; per_km: number; per_min: number; min_fare: number; cancel_fee: number; ac: boolean; enabled: boolean; sort: number }
interface Settings { commission_pct: number; surge_on: boolean; surge_mult: number; non_ac_factor: number }
interface Coupon { code: string; title: string; body: string; off: number; pct: boolean; max_off: number | null; min_fare: number; expires_at: string; active: boolean; uses: number; total_limit: number | null; per_user_limit: number }
interface Ledger { id: number; ride_id: string | null; user_id: string | null; party: string; kind: string; amount: number; method: string | null; note: string | null; created_at: string }
interface Ticket { id: string; code: string; user_id: string; role: string; subject: string; ride_id: string | null; status: "Open" | "In Progress" | "Resolved"; notes: { from: string; body: string; at: string }[]; created_at: string }
interface Audit { id: number; actor: string | null; action: string; target: string | null; details: unknown; at: string }
interface Place { id: string; name: string }

interface Data {
  profiles: Prof[]; drivers: Drv[]; rides: RideRow[]; vehicles: Vehicle[]; settings: Settings; coupons: Coupon[];
  ledger: Ledger[]; tickets: Ticket[]; audit: Audit[]; places: Place[];
}

async function loadAll(): Promise<Data> {
  const sb = supabase();
  const q = async <T,>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>) => { const { data, error } = await p; if (error) throw new Error(friendly(error)); return data as T; };
  const [profiles, drivers, rides, vehicles, settings, coupons, ledger, tickets, audit, places] = await Promise.all([
    q<Prof[]>(sb.from("profiles").select("id,name,phone,email,blocked,rating,is_admin,created_at").order("created_at", { ascending: false }).limit(1000)),
    q<Drv[]>(sb.from("drivers").select("*, profiles(phone,blocked)").order("created_at", { ascending: false }).limit(1000)),
    q<RideRow[]>(sb.from("rides").select("*").order("created_at", { ascending: false }).limit(1000)),
    q<Vehicle[]>(sb.from("vehicles").select("*").order("sort")),
    q<Settings>(sb.from("settings").select("*").single()),
    q<Coupon[]>(sb.from("coupons").select("*").order("created_at", { ascending: false })),
    q<Ledger[]>(sb.from("ledger").select("*").order("created_at", { ascending: false }).limit(1000)),
    q<Ticket[]>(sb.from("tickets").select("*").order("updated_at", { ascending: false }).limit(500)),
    q<Audit[]>(sb.from("audit_log").select("*").order("at", { ascending: false }).limit(100)),
    q<Place[]>(sb.from("places").select("id,name")),
  ]);
  return { profiles, drivers, rides, vehicles, settings, coupons, ledger, tickets, audit, places };
}

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
  { id: "settings", label: "Settings & Audit", Icon: GearIcon },
];

const LIVE = ["Searching", "Arriving", "Arrived", "Started"];
const istDay = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }) : "—");
const initials = (n: string) => n.split(/\s+/).filter(Boolean).map((s) => s[0]).join("").slice(0, 2).toUpperCase() || "?";
const paidOf = (r: RideRow) => (r.payment_status === "paid" || r.payment_status.includes("refunded") ? r.total : 0);

export default function AdminApp() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [section, setSection] = useState<Section>("dashboard");
  const [data, setData] = useState<Data | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2600); };

  // Only a signed-in user whose profile has is_admin = true gets in (checked again by every server function).
  useEffect(() => {
    void (async () => {
      if (!(await getSession())) { setAuthed(false); return; }
      try { setAuthed(!!(await myProfile())?.is_admin); } catch { setAuthed(false); }
    })();
    return onAuthChange((s) => { if (!s) setAuthed(false); });
  }, []);

  const reload = useCallback(async () => {
    setLoadErr(null);
    try { setData(await loadAll()); } catch (e) { setLoadErr((e as Error).message); }
  }, []);
  useEffect(() => {
    if (!authed) return;
    void reload();
    const t = setInterval(() => void reload(), 15000);
    return () => clearInterval(t);
  }, [authed, reload]);

  /** Run an audited admin function, then refresh everything from the database. */
  const act = async (fn: string, args: Record<string, unknown>, ok: string) => {
    try { await rpc(fn, args); flash(ok); await reload(); return true; } catch (e) { flash((e as Error).message); return false; }
  };

  if (authed === null) return <LoadState />;
  if (!authed) return <AdminLogin onLogin={() => setAuthed(true)} />;
  if (!data) return <LoadState error={loadErr} onRetry={() => void reload()} />;

  const pending = data.drivers.filter((d) => d.kyc === "Pending").length;
  const open = data.tickets.filter((t) => t.status !== "Resolved").length;

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
        <div className="adm-side-foot" style={{ marginTop: "auto", paddingTop: 20 }}>
          <button onClick={() => void signOut()} style={{ display: "flex", alignItems: "center", gap: 10, border: "none", background: "rgba(255,255,255,0.08)", color: "white", borderRadius: 12, padding: "10px 12px", cursor: "pointer", fontSize: 13.5, fontWeight: 500, width: "100%" }}>
            <LogoutIcon s={18} c="white" /> Log out
          </button>
        </div>
      </aside>

      <main className="adm-main">
        <TopBar title={NAV.find((n) => n.id === section)!.label} alerts={pending + open} loadErr={loadErr} onRefresh={() => void reload()} />
        {section === "dashboard" && <Dashboard d={data} go={setSection} />}
        {section === "live" && <LiveRides d={data} act={act} />}
        {section === "rides" && <RidesSection d={data} act={act} />}
        {section === "customers" && <CustomersSection d={data} act={act} />}
        {section === "drivers" && <DriversSection d={data} act={act} />}
        {section === "pricing" && <PricingSection d={data} done={async (m) => { flash(m); await reload(); }} />}
        {section === "coupons" && <CouponsSection d={data} act={act} />}
        {section === "payments" && <PaymentsSection d={data} />}
        {section === "reports" && <ReportsSection d={data} flash={flash} />}
        {section === "support" && <SupportSection d={data} act={act} />}
        {section === "notify" && <NotifySection />}
        {section === "settings" && <SettingsSection d={data} />}
      </main>

      {toast && (
        <div className="fade-up" role="status" style={{ position: "fixed", left: "50%", bottom: 28, transform: "translateX(-50%)", zIndex: 300, background: "var(--ink)", color: "white", borderRadius: 14, padding: "12px 18px", fontSize: 13.5, fontWeight: 500, boxShadow: "var(--shadow-xl)" }}>{toast}</div>
      )}
    </div>
  );
}

type Act = (fn: string, args: Record<string, unknown>, ok: string) => Promise<boolean>;

/* ───────────────────────── Shared bits ───────────────────────── */

function TopBar({ title, alerts, loadErr, onRefresh }: { title: string; alerts: number; loadErr: string | null; onRefresh: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-soft)" }}>{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" })}</p>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>{title}</h1>
        {loadErr && <ErrorText msg={`Couldn't refresh: ${loadErr}`} />}
      </div>
      <button onClick={onRefresh} style={{ ...smallBtn("ghost") }}>Refresh</button>
      <span style={{ position: "relative", width: 42, height: 42, borderRadius: 12, background: "var(--surface)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "var(--shadow-card)" }}>
        <BellIcon s={20} c="var(--ink-soft)" />
        {alerts > 0 && <span style={{ position: "absolute", top: 8, right: 9, width: 8, height: 8, borderRadius: "50%", background: "var(--red)" }} />}
      </span>
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

function Stat({ label: l, value, sub, tone = "plain", onClick }: { label: string; value: string; sub?: string; tone?: "plain" | "blue" | "gold" | "red"; onClick?: () => void }) {
  const blue = tone === "blue";
  return (
    <button onClick={onClick} className="press" style={{
      ...card, border: "none", textAlign: "left", cursor: onClick ? "pointer" : "default", padding: "16px 16px",
      background: blue ? "linear-gradient(150deg,var(--blue-dark),var(--blue))" : "var(--surface)", color: blue ? "white" : "var(--ink)",
      boxShadow: blue ? "0 10px 24px rgba(11,92,255,0.25)" : "var(--shadow-card)",
    }}>
      <p style={{ margin: 0, fontSize: 12.5, color: blue ? "rgba(255,255,255,0.75)" : "var(--ink-soft)", fontWeight: 500 }}>{l}</p>
      <p style={{ margin: "6px 0 0", fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", color: tone === "gold" ? "var(--gold-dark)" : tone === "red" ? "var(--red)" : undefined }}>{value}</p>
      {sub && <p style={{ margin: "2px 0 0", fontSize: 11.5, fontWeight: 600, color: blue ? "var(--gold)" : "var(--ink-soft)" }}>{sub}</p>}
    </button>
  );
}

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--bg-secondary)", borderRadius: 12, padding: "8px 12px", minWidth: 220 }}>
      <SearchIcon s={17} c="var(--ink-mute)" />
      <input value={value} onChange={(e) => onChange(e.target.value.slice(0, 80))} placeholder={placeholder} aria-label={placeholder} style={{ border: "none", outline: "none", background: "transparent", fontSize: 13.5, flex: 1, color: "var(--ink)" }} />
    </label>
  );
}

function Chips<T extends string>({ value, options, onChange }: { value: T; options: T[]; onChange: (v: T) => void }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {options.map((o) => {
        const on = o === value;
        return <button key={o} onClick={() => onChange(o)} aria-pressed={on} style={{ border: on ? "1.5px solid var(--blue)" : "1.5px solid var(--line)", background: on ? "var(--blue-tint)" : "var(--surface)", color: on ? "var(--blue)" : "var(--text-secondary)", borderRadius: 10, padding: "6px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>{o}</button>;
      })}
    </div>
  );
}

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
  const max = Math.max(1, ...data.map((x) => x.v));
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 190, paddingTop: 20 }}>
      {data.map((b, i) => (
        <div key={b.d} style={{ flex: 1, height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", gap: 6 }} title={`${b.d}: ${format(b.v)}`}>
          <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--ink-soft)" }}>{format(b.v)}</span>
          <div style={{ width: "100%", maxWidth: 40, height: `${Math.max(2, (b.v / max) * 78)}%`, borderRadius: "8px 8px 4px 4px", background: i === data.length - 1 ? "var(--gold)" : color }} />
          <span style={{ fontSize: 11.5, color: "var(--ink-mute)" }}>{b.d}</span>
        </div>
      ))}
    </div>
  );
}

const compact = (n: number) => (n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : n >= 1000 ? `₹${(n / 1000).toFixed(1)}k` : inr(n));

/** Last 7 IST days, oldest first. */
const last7 = () => Array.from({ length: 7 }, (_, i) => {
  const d = new Date(Date.now() - (6 - i) * 864e5);
  return { key: d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }), label: d.toLocaleDateString("en-IN", { weekday: "short", timeZone: "Asia/Kolkata" }) };
});

/* ───────────────────────── Login (Supabase email + password, admin role required) ───────────────────────── */

function AdminLogin({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async () => {
    setBusy(true); setErr(null);
    try { await adminSignIn(email.trim(), pw); onLogin(); } catch (e) { setErr((e as Error).message); setPw(""); } finally { setBusy(false); }
  };
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "linear-gradient(165deg,#04246b 0%,#020b24 100%)" }}>
      <form onSubmit={(e) => { e.preventDefault(); void submit(); }} className="fade-up" style={{ ...card, width: "min(400px,100%)", padding: 28, background: "var(--app-bg)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center" }}><BrandMark size={40} /><Wordmark sub="ADMIN PANEL" size={22} /></div>
        <h1 style={{ margin: "22px 0 4px", fontSize: 22, fontWeight: 800, textAlign: "center" }}>Admin Portal</h1>
        <p style={{ margin: "0 0 20px", fontSize: 13.5, color: "var(--ink-soft)", textAlign: "center" }}>Sign in with your DriveWay admin account</p>
        <label style={label} htmlFor="ae">Email</label>
        <input id="ae" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} style={{ ...field, marginBottom: 14 }} autoComplete="username" />
        <label style={label} htmlFor="ap">Password</label>
        <input id="ap" type="password" required value={pw} onChange={(e) => setPw(e.target.value)} style={{ ...field, marginBottom: 12 }} autoComplete="current-password" />
        <ErrorText msg={err} />
        <div style={{ marginTop: 12 }}><PrimaryButton type="submit" disabled={!email || !pw || busy}><LockIcon s={17} c={email && pw ? "white" : "var(--ink-mute)"} /> {busy ? "Signing in…" : "Login"}</PrimaryButton></div>
      </form>
    </div>
  );
}

/* ───────────────────────── Dashboard (all figures computed from records) ───────────────────────── */

function Dashboard({ d, go }: { d: Data; go: (s: Section) => void }) {
  const today = istDay(new Date().toISOString());
  const todays = d.rides.filter((r) => istDay(r.created_at) === today);
  const revenueToday = d.ledger.filter((l) => l.kind === "payment" && istDay(l.created_at) === today).reduce((s, l) => s + l.amount, 0);
  const driverIds = new Set(d.drivers.map((x) => x.id));
  const days = last7();
  const revenue = days.map(({ key, label: l }) => ({ d: l, v: d.ledger.filter((x) => x.kind === "payment" && istDay(x.created_at) === key).reduce((s, x) => s + x.amount, 0) }));
  const done = d.rides.filter((r) => r.status === "Completed");
  const byVehicle = (["bike", "auto", "erick", "mini", "sedan", "taxi", "suv"] as VehicleKind[]).map((k) => [k, done.filter((r) => r.vehicle === k).length] as const).filter(([, n]) => n > 0);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="adm-grid-4">
        <Stat label="Collected today" value={inr(revenueToday)} sub="Payments recorded today (IST)" tone="blue" onClick={() => go("payments")} />
        <Stat label="Rides today" value={String(todays.length)} sub={`${todays.filter((r) => r.status === "Completed").length} completed · ${todays.filter((r) => r.status === "Cancelled").length} cancelled`} onClick={() => go("rides")} />
        <Stat label="Live right now" value={String(d.rides.filter((r) => LIVE.includes(r.status)).length)} sub={`${d.drivers.filter((x) => x.online && !x.suspended).length} drivers online`} onClick={() => go("live")} />
        <Stat label="Customers" value={String(d.profiles.filter((p) => !driverIds.has(p.id) && !p.is_admin).length)} onClick={() => go("customers")} />
        <Stat label="Approved drivers" value={String(d.drivers.filter((x) => x.kyc === "Approved").length)} onClick={() => go("drivers")} />
        <Stat label="Pending approvals" value={String(d.drivers.filter((x) => x.kyc === "Pending").length)} tone="gold" onClick={() => go("drivers")} />
        <Stat label="Open tickets" value={String(d.tickets.filter((t) => t.status !== "Resolved").length)} tone="red" onClick={() => go("support")} />
        <Stat label="Payments due" value={inr(d.rides.filter((r) => r.payment_status === "pending").reduce((s, r) => s + r.total, 0))} sub={`${d.rides.filter((r) => r.payment_status === "pending").length} rides`} />
      </div>
      <div className="adm-grid-2">
        <Panel title="Collected · last 7 days" right={<span style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>Total {inr(revenue.reduce((s, x) => s + x.v, 0))}</span>}>
          <BarChart data={revenue} format={compact} />
        </Panel>
        <Panel title="Completed rides by vehicle">
          {byVehicle.length === 0 && <p style={{ margin: 0, color: "var(--ink-soft)", fontSize: 13 }}>No completed rides yet.</p>}
          {byVehicle.map(([k, n]) => (
            <div key={k} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0" }}>
              <VehicleArt kind={k} size={40} />
              <span style={{ width: 80, fontSize: 13, fontWeight: 600 }}>{vehicleById(k).name}</span>
              <div style={{ flex: 1, height: 8, borderRadius: 4, background: "var(--line)" }}><div style={{ width: `${(n / done.length) * 100}%`, height: "100%", borderRadius: 4, background: "var(--blue)" }} /></div>
              <span style={{ width: 36, textAlign: "right", fontSize: 12.5, fontWeight: 700 }}>{n}</span>
            </div>
          ))}
        </Panel>
      </div>
      <Panel title="Recent rides" right={<button onClick={() => go("rides")} style={{ background: "none", border: "none", color: "var(--blue)", fontWeight: 600, cursor: "pointer" }}>View all →</button>}>
        <RidesTable d={d} rows={d.rides.slice(0, 6)} onOpen={() => go("rides")} />
      </Panel>
    </div>
  );
}

/* ───────────────────────── Rides ───────────────────────── */

const nameOf = (d: Data, id: string | null) => (id ? d.profiles.find((p) => p.id === id)?.name || d.drivers.find((x) => x.id === id)?.name || "—" : "—");
const placeName = (d: Data, id: string) => d.places.find((p) => p.id === id)?.name ?? id;

function RidesTable({ d, rows, onOpen }: { d: Data; rows: RideRow[]; onOpen: (r: RideRow) => void }) {
  return (
    <div className="adm-table-wrap">
      <table className="adm-table">
        <thead><tr><th>ID</th><th>Created</th><th>Customer</th><th>Driver</th><th>Vehicle</th><th>Route</th><th>Status</th><th>Payment</th><th style={{ textAlign: "right" }}>Owed</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} onClick={() => onOpen(r)}>
              <td style={{ fontWeight: 700 }}>#{r.code}</td><td>{when(r.created_at)}</td><td>{nameOf(d, r.customer_id)}</td><td>{nameOf(d, r.driver_id)}</td>
              <td>{r.vehicle ? vehicleById(r.vehicle).name : r.service === "any" ? "Book Any" : "—"}</td>
              <td style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", color: "var(--ink-soft)" }}>{placeName(d, r.from_place)} → {placeName(d, r.to_place)}</td>
              <td><StatusBadge status={r.status} /></td>
              <td>{r.pay_method} · <span style={{ fontWeight: 600 }}>{r.payment_status}</span></td>
              <td style={{ textAlign: "right", fontWeight: 700 }}>{inr(r.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <p style={{ textAlign: "center", color: "var(--ink-soft)", padding: 24 }}>No rides match.</p>}
    </div>
  );
}

function RideDrawer({ d, r, act, onClose }: { d: Data; r: RideRow; act: Act; onClose: () => void }) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [key] = useState(newKey);   // one refund key per drawer → a double-click refunds once
  const events = d.ledger.filter((l) => l.ride_id === r.id);
  const refundable = r.total - r.refunded;
  const amt = Number(amount);
  return (
    <Drawer title={`Ride #${r.code}`} onClose={onClose}>
      <div style={{ ...card, padding: 14 }}>
        {kv("Status", <StatusBadge status={r.status} />)}
        {kv("Created", when(r.created_at))}
        {r.scheduled_for && kv("Scheduled for", when(r.scheduled_for))}
        {kv("Customer", nameOf(d, r.customer_id))}
        {kv("Driver", nameOf(d, r.driver_id))}
        {kv("Vehicle", `${r.vehicle ? vehicleById(r.vehicle).name : "Book Any"} · ${r.ac ? "AC" : "Non-AC"} · ${r.km} km · ${r.mins} min`)}
        {kv("Route", `${placeName(d, r.from_place)} → ${placeName(d, r.to_place)}`)}
        {r.cancel_reason && kv("Cancelled", `${r.cancel_reason} (${r.cancelled_by})`)}
        {r.rating && kv("Rating", "★".repeat(r.rating))}
      </div>
      <div style={{ ...card, padding: 14 }}>
        <p style={{ margin: "0 0 6px", fontWeight: 700 }}>Money</p>
        {kv("Quoted fare", inr(r.fare))}
        {r.wait_fee > 0 && kv("Waiting charge", inr(r.wait_fee))}
        {r.discount > 0 && kv(`Coupon ${r.coupon_code}`, "− " + inr(r.discount))}
        {r.cancel_fee > 0 && kv("Cancellation fee", inr(r.cancel_fee))}
        {kv("Customer owes", inr(r.total))}
        {kv("Payment", `${r.pay_method} · ${r.payment_status}`)}
        {r.refunded > 0 && kv("Refunded", inr(r.refunded))}
      </div>
      {events.length > 0 && (
        <Panel title="Ledger entries">
          {events.map((e) => kv(`${e.kind} · ${e.party}`, `${e.amount < 0 ? "− " : ""}${inr(Math.abs(e.amount))}`))}
        </Panel>
      )}
      {LIVE.concat("Scheduled").includes(r.status) && (
        <PrimaryButton tone="red" onClick={() => void act("admin_cancel_ride", { p_ride: r.id, p_reason: "Cancelled by DriveWay support" }, `Ride ${r.code} cancelled`).then((ok) => ok && onClose())}>Cancel this ride</PrimaryButton>
      )}
      {(r.payment_status === "paid" || r.payment_status === "partially_refunded") && refundable > 0 && (
        <Panel title="Refund to customer's wallet">
          <label style={label} htmlFor="ra">Amount (max {inr(refundable)})</label>
          <input id="ra" type="number" min={1} max={refundable} value={amount} onChange={(e) => setAmount(e.target.value)} style={{ ...field, marginBottom: 10 }} />
          <label style={label} htmlFor="rr">Reason</label>
          <input id="rr" value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} style={{ ...field, marginBottom: 12 }} />
          <PrimaryButton disabled={!(amt >= 1 && amt <= refundable && Number.isInteger(amt)) || !reason.trim()}
            onClick={() => void act("admin_refund", { p_ride: r.id, p_amount: amt, p_reason: reason.trim(), p_idem: key }, `Refunded ${inr(amt)}`).then((ok) => ok && onClose())}>Refund {amt ? inr(amt) : ""}</PrimaryButton>
        </Panel>
      )}
    </Drawer>
  );
}

function RidesSection({ d, act }: { d: Data; act: Act }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("All");
  const [open, setOpen] = useState<string | null>(null);
  const rows = d.rides.filter((r) =>
    (status === "All" || (status === "Live" ? LIVE.includes(r.status) : status === "Payment due" ? r.payment_status === "pending" : r.status === status)) &&
    `${r.code} ${nameOf(d, r.customer_id)} ${nameOf(d, r.driver_id)} ${placeName(d, r.from_place)} ${placeName(d, r.to_place)}`.toLowerCase().includes(q.toLowerCase()));
  const sel = d.rides.find((r) => r.id === open);
  return (
    <Panel>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", marginBottom: 14 }}>
        <SearchBox value={q} onChange={setQ} placeholder="Search ride, customer, driver, place…" />
        <Chips value={status} options={["All", "Live", "Scheduled", "Completed", "Cancelled", "NoDrivers", "Payment due"]} onChange={setStatus} />
      </div>
      <RidesTable d={d} rows={rows} onOpen={(r) => setOpen(r.id)} />
      {sel && <RideDrawer d={d} r={sel} act={act} onClose={() => setOpen(null)} />}
    </Panel>
  );
}

function LiveRides({ d, act }: { d: Data; act: Act }) {
  const live = d.rides.filter((r) => LIVE.includes(r.status));
  const [open, setOpen] = useState<string | null>(null);
  const sel = d.rides.find((r) => r.id === open);
  return (
    <div className="adm-grid-2">
      <Panel title="Map" right={<span style={{ fontSize: 12.5, color: "var(--success-text)", fontWeight: 600 }}>● {live.length} live</span>}>
        <MapView mode="trip" progress={0.45} height={420} radius={14} nearby />
        <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--ink-mute)" }}>Illustrative map — live GPS positions arrive with the maps integration.</p>
      </Panel>
      <Panel title="Live rides">
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {live.length === 0 && <p style={{ margin: 0, color: "var(--ink-soft)", fontSize: 13 }}>No rides in progress.</p>}
          {live.map((r) => (
            <button key={r.id} onClick={() => setOpen(r.id)} className="press" style={{ display: "flex", alignItems: "center", gap: 12, border: "1px solid var(--line)", background: "var(--surface)", borderRadius: 14, padding: 10, cursor: "pointer", textAlign: "left" }}>
              <VehicleArt kind={r.vehicle ?? r.requested_vehicles[0]} size={48} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700 }}>#{r.code} · {nameOf(d, r.driver_id)}</p>
                <p style={{ margin: 0, fontSize: 12, color: "var(--ink-soft)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{placeName(d, r.from_place)} → {placeName(d, r.to_place)}</p>
              </div>
              <StatusBadge status={r.status} />
            </button>
          ))}
        </div>
      </Panel>
      {sel && <RideDrawer d={d} r={sel} act={act} onClose={() => setOpen(null)} />}
    </div>
  );
}

/* ───────────────────────── Customers ───────────────────────── */

function CustomersSection({ d, act }: { d: Data; act: Act }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const driverIds = new Set(d.drivers.map((x) => x.id));
  const rows = d.profiles.filter((p) => !driverIds.has(p.id) && !p.is_admin);
  const stats = (id: string) => { const rs = d.rides.filter((r) => r.customer_id === id); return { rides: rs.filter((r) => r.status === "Completed").length, spent: rs.reduce((s, r) => s + paidOf(r) - r.refunded, 0), list: rs }; };
  const list = rows.filter((c) => `${c.name} ${c.phone} ${c.email}`.toLowerCase().includes(q.toLowerCase()));
  const sel = rows.find((c) => c.id === open);
  const toggle = (c: Prof) => void act("admin_set_blocked", { p_user: c.id, p_blocked: !c.blocked }, `${c.name || "Customer"} ${c.blocked ? "unblocked" : "blocked"}`);
  return (
    <Panel title={`${rows.length} customers`} right={<SearchBox value={q} onChange={setQ} placeholder="Search name, phone, email…" />}>
      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead><tr><th>Name</th><th>Phone</th><th>Email</th><th>Rides</th><th>Paid</th><th>Joined</th><th>Status</th><th /></tr></thead>
          <tbody>
            {list.map((c) => { const s = stats(c.id); return (
              <tr key={c.id} onClick={() => setOpen(c.id)}>
                <td><span style={{ display: "flex", alignItems: "center", gap: 10 }}><Avatar initials={initials(c.name || "?")} size={30} />{c.name || "(no name yet)"}</span></td>
                <td>{c.phone ? `+${c.phone}` : "—"}</td><td style={{ color: "var(--ink-soft)" }}>{c.email ?? "—"}</td><td>{s.rides}</td><td>{inr(s.spent)}</td><td>{when(c.created_at)}</td>
                <td><StatusBadge status={c.blocked ? "Blocked" : "Active"} /></td>
                <td><button onClick={(e) => { e.stopPropagation(); toggle(c); }} style={smallBtn(c.blocked ? "ghost" : "red")}>{c.blocked ? "Unblock" : "Block"}</button></td>
              </tr>); })}
          </tbody>
        </table>
        {list.length === 0 && <p style={{ textAlign: "center", color: "var(--ink-soft)", padding: 24 }}>No customers yet.</p>}
      </div>
      {sel && (() => { const s = stats(sel.id); return (
        <Drawer title={sel.name || "Customer"} onClose={() => setOpen(null)}>
          <div style={{ ...card, padding: 14 }}>
            {kv("Phone", sel.phone ? `+${sel.phone}` : "—")}{kv("Email", sel.email ?? "—")}{kv("Joined", when(sel.created_at))}
            {kv("Completed rides", s.rides)}{kv("Total paid (net of refunds)", inr(s.spent))}{kv("Rating from drivers", sel.rating ? `★ ${sel.rating}` : "—")}
            {kv("Account", <StatusBadge status={sel.blocked ? "Blocked" : "Active"} />)}
          </div>
          <Panel title="Rides">
            {s.list.length === 0 && <p style={{ margin: 0, fontSize: 13, color: "var(--ink-soft)" }}>No rides.</p>}
            {s.list.map((r) => <div key={r.id}>{kv(`#${r.code} · ${when(r.created_at)}`, <>{inr(r.total)} <StatusBadge status={r.status} /></>)}</div>)}
          </Panel>
          <PrimaryButton tone={sel.blocked ? "blue" : "red"} onClick={() => toggle(sel)}>{sel.blocked ? "Unblock account" : "Block account"}</PrimaryButton>
        </Drawer>); })()}
    </Panel>
  );
}

/* ───────────────────────── Drivers ───────────────────────── */

const DOC_LABELS: Record<string, string> = { photo: "Profile photo", licence: "Driving licence", rc: "Vehicle RC", insurance: "Insurance", aadhaar: "Aadhaar / ID" };

function DriversSection({ d, act }: { d: Data; act: Act }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("All");
  const [open, setOpen] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const state = (x: Drv) => (x.suspended ? "Suspended" : x.kyc !== "Approved" ? x.kyc : x.online ? "Online" : "Offline");
  const list = d.drivers.filter((x) =>
    (filter === "All" || (filter === "Pending KYC" ? x.kyc === "Pending" : filter === "Online" ? x.online && !x.suspended : filter === "Suspended" ? x.suspended : true)) &&
    `${x.name} ${x.profiles?.phone ?? ""} ${x.plate}`.toLowerCase().includes(q.toLowerCase()));
  const sel = d.drivers.find((x) => x.id === open);
  const viewDoc = async (path: string) => {
    const { data, error } = await supabase().storage.from("driver-docs").createSignedUrl(path, 60);
    if (error || !data) { alert(friendly(error ?? "Couldn't open the file")); return; }
    window.open(data.signedUrl, "_blank", "noopener");
  };
  const setKyc = (x: Drv, kyc: string, n: string | null) => void act("admin_set_kyc", { p_driver: x.id, p_kyc: kyc, p_note: n }, `${x.name} ${kyc === "Approved" ? "approved" : kyc === "Rejected" ? "rejected" : "moved back to review"}`);
  const suspend = (x: Drv) => void act("admin_set_suspended", { p_driver: x.id, p_suspended: !x.suspended }, `${x.name} ${x.suspended ? "reactivated" : "suspended"}`);
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
            {list.map((x) => (
              <tr key={x.id} onClick={() => { setOpen(x.id); setNote(x.kyc_note ?? ""); }}>
                <td><span style={{ display: "flex", alignItems: "center", gap: 10 }}><Avatar initials={initials(x.name)} size={30} />{x.name}</span></td>
                <td>{vehicleById(x.vehicle).name}{x.ac ? " · AC" : ""}</td><td style={{ fontWeight: 600 }}>{x.plate}</td><td>{x.city}</td><td>{x.trips}</td>
                <td>{x.rating ? `★ ${x.rating}` : "—"}</td><td><StatusBadge status={state(x)} /></td>
                <td onClick={(e) => e.stopPropagation()}>
                  {x.kyc === "Pending" ? <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>Review documents →</span>
                    : x.kyc === "Approved" ? <button style={smallBtn(x.suspended ? "ghost" : "red")} onClick={() => suspend(x)}>{x.suspended ? "Reactivate" : "Suspend"}</button>
                    : <button style={smallBtn("ghost")} onClick={() => setKyc(x, "Pending", null)}>Re-review</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && <p style={{ textAlign: "center", color: "var(--ink-soft)", padding: 24 }}>No drivers match.</p>}
      </div>
      {sel && (
        <Drawer title={sel.name} onClose={() => setOpen(null)}>
          <div style={{ ...card, padding: 14, display: "flex", alignItems: "center", gap: 12 }}>
            <Avatar initials={initials(sel.name)} size={52} />
            <div style={{ flex: 1 }}><p style={{ margin: 0, fontWeight: 700 }}>{sel.name}</p><p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-soft)" }}>{sel.profiles?.phone ? `+${sel.profiles.phone}` : ""} · {sel.city}</p></div>
            <StatusBadge status={state(sel)} />
          </div>
          <div style={{ ...card, padding: 14, display: "flex", alignItems: "center", gap: 12 }}>
            <VehicleArt kind={sel.vehicle} size={64} />
            <div><p style={{ margin: 0, fontWeight: 700 }}>{sel.model}</p><p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-soft)" }}>{vehicleById(sel.vehicle).name} · {sel.ac ? "AC" : "Non-AC"} · {sel.plate}</p></div>
          </div>
          <Panel title="KYC documents">
            {Object.keys(DOC_LABELS).map((k) => (
              <div key={k} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
                <DocIcon s={18} c="var(--ink-soft)" /><span style={{ flex: 1, fontSize: 13.5 }}>{DOC_LABELS[k]}</span>
                {sel.docs?.[k] ? <button style={smallBtn("ghost")} onClick={() => void viewDoc(sel.docs[k])}>View</button> : <span style={{ fontSize: 12, color: "var(--error-text)" }}>Missing</span>}
              </div>
            ))}
          </Panel>
          <div style={{ ...card, padding: 14 }}>
            {kv("Applied", when(sel.created_at))}{kv("Trips", sel.trips)}{kv("UPI", sel.upi ?? "—")}{kv("Last seen", when(sel.last_seen))}
            {kv("Wallet balance", inr(d.ledger.filter((l) => l.user_id === sel.id && l.party === "driver").reduce((s, l) => s + l.amount, 0)))}
          </div>
          {sel.kyc === "Pending" && (
            <>
              <label style={label} htmlFor="kn">Note to the driver (required to reject)</label>
              <input id="kn" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Licence photo is blurry" style={field} />
              <div style={{ display: "flex", gap: 10 }}>
                <PrimaryButton tone="red" disabled={!note.trim()} onClick={() => setKyc(sel, "Rejected", note.trim())}>Reject</PrimaryButton>
                <PrimaryButton disabled={!Object.keys(DOC_LABELS).every((k) => sel.docs?.[k])} onClick={() => setKyc(sel, "Approved", null)}><CheckIcon s={16} c="white" /> Approve</PrimaryButton>
              </div>
            </>
          )}
          {sel.kyc === "Approved" && <PrimaryButton tone={sel.suspended ? "blue" : "red"} onClick={() => suspend(sel)}>{sel.suspended ? "Reactivate driver" : "Suspend driver"}</PrimaryButton>}
        </Drawer>
      )}
    </Panel>
  );
}

/* ───────────────────────── Pricing (saved to the database; applies to the next quote) ───────────────────────── */

function PricingSection({ d, done }: { d: Data; done: (msg: string) => Promise<void> }) {
  const [rows, setRows] = useState<Vehicle[]>(d.vehicles);
  const [s, setS] = useState<Settings>(d.settings);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setRows(d.vehicles); setS(d.settings); }, [d.vehicles, d.settings]);
  type NumKey = "base" | "per_km" | "per_min" | "min_fare" | "cancel_fee";
  const cols: [NumKey, string][] = [["base", "Base ₹"], ["per_km", "₹ / km"], ["per_min", "₹ / min"], ["min_fare", "Min fare ₹"], ["cancel_fee", "Cancel fee ₹"]];
  const upd = (id: string, p: Partial<Vehicle>) => setRows((r) => r.map((x) => (x.id === id ? { ...x, ...p } : x)));
  const invalid = rows.some((v) => cols.some(([k]) => !(Number.isFinite(Number(v[k])) && Number(v[k]) >= 0)));
  const save = async () => {
    setBusy(true);
    try {
      for (const v of rows) {
        const orig = d.vehicles.find((x) => x.id === v.id)!;
        const changed = Object.fromEntries((["base", "per_km", "per_min", "min_fare", "cancel_fee", "ac", "enabled"] as const).filter((k) => String(v[k]) !== String(orig[k])).map((k) => [k, v[k]]));
        if (Object.keys(changed).length) await rpc("admin_update_vehicle", { p_id: v.id, p: changed });
      }
      if (s.commission_pct !== d.settings.commission_pct || s.surge_on !== d.settings.surge_on || s.surge_mult !== d.settings.surge_mult) {
        await rpc("admin_update_settings", { p: { commission_pct: s.commission_pct, surge_on: s.surge_on, surge_mult: s.surge_mult } });
      }
      await done("Pricing saved — applies to the next quote; booked rides keep their price");
    } catch (e) { await done((e as Error).message); } finally { setBusy(false); }
  };
  const num: React.CSSProperties = { ...field, width: 84, padding: "7px 10px", fontSize: 13 };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Panel title={`Vehicle categories & fares · Non-AC is ${Math.round((1 - d.settings.non_ac_factor) * 100)}% cheaper`} right={<PrimaryButton onClick={() => void save()} disabled={busy || invalid} style={{ width: "auto", padding: "10px 18px", fontSize: 13.5 }}>{busy ? "Saving…" : "Save changes"}</PrimaryButton>}>
        {invalid && <ErrorText msg="Fares can't be negative or empty." />}
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr><th>Category</th>{cols.map(([, l]) => <th key={l}>{l}</th>)}<th>AC option</th><th>Enabled</th></tr></thead>
            <tbody>
              {rows.map((v) => (
                <tr key={v.id} style={{ cursor: "default" }}>
                  <td><span style={{ display: "flex", alignItems: "center", gap: 8 }}><VehicleArt kind={v.id} size={40} /><b>{v.name}</b></span></td>
                  {cols.map(([k]) => (
                    <td key={k}><input type="number" min={0} step={k === "per_min" || k === "per_km" ? 0.5 : 1} value={v[k]} aria-label={`${v.name} ${k}`}
                      onChange={(e) => upd(v.id, { [k]: e.target.value === "" ? NaN : Number(e.target.value) } as Partial<Vehicle>)} style={{ ...num, borderColor: Number(v[k]) >= 0 ? undefined : "var(--red)" }} /></td>
                  ))}
                  <td><Toggle on={v.ac} onChange={(on) => upd(v.id, { ac: on })} label={`${v.name} offers AC`} /></td>
                  <td><Toggle on={v.enabled} onChange={(on) => upd(v.id, { enabled: on })} label={`${v.name} enabled`} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <div className="adm-grid-2">
        <Panel title="Platform commission">
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <input type="range" min={0} max={50} value={s.commission_pct} onChange={(e) => setS({ ...s, commission_pct: Number(e.target.value) })} style={{ flex: 1, accentColor: "var(--blue)" }} aria-label="Commission percent" />
            <span style={{ fontSize: 24, fontWeight: 800, width: 64, textAlign: "right" }}>{s.commission_pct}%</span>
          </div>
          <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "var(--ink-soft)" }}>On a ₹200 fare the driver earns {inr(200 * (1 - s.commission_pct / 100))}. Coupon discounts are paid by DriveWay, not the driver.</p>
        </Panel>
        <Panel title="Surge pricing" right={<Toggle on={s.surge_on} onChange={(on) => setS({ ...s, surge_on: on })} label="Surge pricing" />}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, opacity: s.surge_on ? 1 : 0.45 }}>
            <input type="range" min={1} max={3} step={0.1} disabled={!s.surge_on} value={s.surge_mult} onChange={(e) => setS({ ...s, surge_mult: Number(e.target.value) })} style={{ flex: 1, accentColor: "var(--blue)" }} aria-label="Surge multiplier" />
            <span style={{ fontSize: 24, fontWeight: 800, width: 64, textAlign: "right" }}>{Number(s.surge_mult).toFixed(1)}×</span>
          </div>
          <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "var(--ink-soft)" }}>When on, every new quote is multiplied and shows a &quot;High demand&quot; line to the customer.</p>
        </Panel>
      </div>
    </div>
  );
}

/* ───────────────────────── Coupons ───────────────────────── */

function CouponsSection({ d, act }: { d: Data; act: Act }) {
  const [code, setCode] = useState("");
  const [off, setOff] = useState("20");
  const [pct, setPct] = useState(true);
  const [maxOff, setMaxOff] = useState("100");
  const [minFare, setMinFare] = useState("0");
  const [days, setDays] = useState("30");
  const [perUser, setPerUser] = useState("1");
  const [total, setTotal] = useState("");
  const n = (s: string) => Number(s);
  const errors = [
    !/^[A-Z0-9]{3,20}$/.test(code) && "Code: 3–20 letters or digits",
    !(Number.isInteger(n(off)) && n(off) >= 1 && (pct ? n(off) <= 100 : n(off) <= 1000)) && (pct ? "Percent must be 1–100" : "Flat amount must be ₹1–₹1000"),
    pct && !(Number.isInteger(n(maxOff)) && n(maxOff) >= 1) && "Max discount must be at least ₹1",
    !(Number.isInteger(n(minFare)) && n(minFare) >= 0) && "Minimum fare can't be negative",
    !(Number.isInteger(n(days)) && n(days) >= 1 && n(days) <= 365) && "Valid for 1–365 days",
    !(Number.isInteger(n(perUser)) && n(perUser) >= 1) && "Uses per customer must be at least 1",
    total !== "" && !(Number.isInteger(n(total)) && n(total) >= 1) && "Total uses must be at least 1",
  ].filter(Boolean) as string[];
  const create = () => void act("admin_upsert_coupon", { p: {
    code, title: pct ? `${off}% off` : `Flat ₹${off} off`, body: pct ? `Up to ₹${maxOff} off${n(minFare) ? ` on fares of ₹${minFare}+` : ""}` : n(minFare) ? `On fares of ₹${minFare}+` : "On any ride",
    off: n(off), pct, max_off: pct ? n(maxOff) : "", min_fare: n(minFare), expires_at: new Date(Date.now() + n(days) * 864e5).toISOString(), per_user_limit: n(perUser), total_limit: total,
  } }, `Coupon ${code} created`).then((ok) => ok && setCode(""));
  const input = (id: string, l: string, v: string, set: (v: string) => void, type = "number") => (
    <div style={{ marginBottom: 12 }}><label style={label} htmlFor={id}>{l}</label><input id={id} type={type} value={v} onChange={(e) => set(e.target.value)} style={field} /></div>
  );
  return (
    <div className="adm-grid-2">
      <Panel title="Coupons & offers">
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr><th>Code</th><th>Offer</th><th>Expires</th><th>Uses</th><th>Active</th></tr></thead>
            <tbody>
              {d.coupons.map((c) => (
                <tr key={c.code} style={{ cursor: "default" }}>
                  <td><span style={{ fontWeight: 700, color: "var(--gold-dark)", border: "1.5px dashed var(--gold)", borderRadius: 8, padding: "2px 8px" }}>{c.code}</span></td>
                  <td>{c.title}<br /><span style={{ fontSize: 11.5, color: "var(--ink-soft)" }}>{c.body}</span></td><td>{when(c.expires_at)}</td>
                  <td>{c.uses}{c.total_limit ? ` / ${c.total_limit}` : ""}</td>
                  <td><Toggle on={c.active} onChange={(on) => void act("admin_set_coupon_active", { p_code: c.code, p_active: on }, `${c.code} ${on ? "activated" : "paused"}`)} label={`${c.code} active`} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel title="Create coupon">
        {input("cc", "Code", code, (v) => setCode(v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20)), "text")}
        <label style={label}>Discount type</label>
        <div style={{ marginBottom: 12 }}><Chips value={pct ? "Percent" : "Flat ₹"} options={["Percent", "Flat ₹"]} onChange={(v) => setPct(v === "Percent")} /></div>
        {input("co", pct ? "Percent off" : "Rupees off", off, setOff)}
        {pct && input("cm", "Max discount ₹", maxOff, setMaxOff)}
        {input("cf", "Minimum fare ₹", minFare, setMinFare)}
        {input("cd", "Valid for (days)", days, setDays)}
        {input("cu", "Uses per customer", perUser, setPerUser)}
        {input("ct", "Total uses (blank = unlimited)", total, setTotal)}
        {errors.length > 0 && code && <ErrorText msg={errors.join(" · ")} />}
        <div style={{ marginTop: 10 }}><PrimaryButton onClick={create} disabled={errors.length > 0}>Create Coupon</PrimaryButton></div>
      </Panel>
    </div>
  );
}

/* ───────────────────────── Payments (the ledger) ───────────────────────── */

function PaymentsSection({ d }: { d: Data }) {
  const [kind, setKind] = useState("All");
  const KINDS = ["All", "payment", "driver_earning", "commission", "discount", "cash_collected", "payout", "refund", "wallet_credit", "incentive", "cancel_fee"];
  const rows = d.ledger.filter((t) => kind === "All" || t.kind === kind);
  const sum = (k: string) => d.ledger.filter((l) => l.kind === k).reduce((s, l) => s + l.amount, 0);
  const driverBal = d.ledger.filter((l) => l.party === "driver").reduce((s, l) => s + l.amount, 0);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="adm-grid-4">
        <Stat label="Payments collected" value={inr(sum("payment"))} sub="All time, from the ledger" tone="blue" />
        <Stat label="Commission earned" value={inr(sum("commission"))} sub={`Discounts funded: ${inr(-sum("discount"))}`} />
        <Stat label="Owed to drivers (net)" value={inr(driverBal)} sub="Positive = payable, negative = dues" tone="gold" />
        <Stat label="Refunds issued" value={inr(sum("wallet_credit"))} tone="red" />
      </div>
      <Panel title="Ledger" right={<select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Filter by type" style={{ ...field, width: "auto", padding: "7px 10px", fontSize: 13 }}>{KINDS.map((k) => <option key={k}>{k}</option>)}</select>}>
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr><th>#</th><th>Type</th><th>Party</th><th>Who</th><th>Ride</th><th>Method</th><th>When</th><th style={{ textAlign: "right" }}>Amount</th></tr></thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id} style={{ cursor: "default" }}>
                  <td style={{ fontWeight: 700 }}>{t.id}</td><td>{t.kind}</td><td>{t.party}</td><td>{t.user_id ? nameOf(d, t.user_id) : "DriveWay"}</td>
                  <td>{t.ride_id ? `#${d.rides.find((r) => r.id === t.ride_id)?.code ?? "…"}` : "—"}</td><td>{t.method ?? "—"}</td><td>{when(t.created_at)}</td>
                  <td style={{ textAlign: "right", fontWeight: 700, color: t.amount < 0 ? "var(--red)" : "var(--success-text)" }}>{t.amount < 0 ? "− " : "+ "}{inr(Math.abs(t.amount))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <p style={{ textAlign: "center", color: "var(--ink-soft)", padding: 24 }}>No entries.</p>}
        </div>
      </Panel>
    </div>
  );
}

/* ───────────────────────── Reports + CSV export ───────────────────────── */

/** Quote a CSV cell and neutralise spreadsheet formulas (=, +, -, @ at the start). */
const csvCell = (v: unknown) => {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
};

function ReportsSection({ d, flash }: { d: Data; flash: (m: string) => void }) {
  const days = last7();
  const inRange = d.rides.filter((r) => days.some((x) => x.key === istDay(r.created_at)));
  const exportCsv = () => {
    const head = ["Ride", "Created (IST)", "Customer", "Driver", "Vehicle", "From", "To", "Km", "Fare", "Discount", "Wait fee", "Cancel fee", "Owed", "Payment", "Payment status", "Refunded", "Status"];
    const lines = inRange.map((r) => [r.code, when(r.created_at), nameOf(d, r.customer_id), nameOf(d, r.driver_id), r.vehicle ?? r.service, placeName(d, r.from_place), placeName(d, r.to_place),
      r.km, r.fare, r.discount, r.wait_fee, r.cancel_fee, r.total, r.pay_method, r.payment_status, r.refunded, r.status].map(csvCell).join(","));
    const url = URL.createObjectURL(new Blob(["﻿" + [head.map(csvCell).join(","), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `driveway-rides-${days[0].key}-to-${days[6].key}.csv`; a.click(); URL.revokeObjectURL(url);
    flash(`Exported ${inRange.length} rides`);
  };
  const completed = inRange.filter((r) => r.status === "Completed");
  const cancelled = inRange.filter((r) => r.status === "Cancelled");
  const methods = ["UPI", "Cash", "Card", "Wallet"].map((m) => [m, completed.filter((r) => r.pay_method === m).length] as const);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
        <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink-soft)" }}>Last 7 days (IST)</span>
        <button onClick={exportCsv} style={{ ...smallBtn("blue"), display: "flex", alignItems: "center", gap: 6, padding: "9px 14px" }}><DownloadIcon s={16} c="white" /> Export CSV</button>
      </div>
      <div className="adm-grid-4">
        <Stat label="Rides booked" value={String(inRange.length)} tone="blue" />
        <Stat label="Completed" value={String(completed.length)} />
        <Stat label="Fares on completed rides" value={inr(completed.reduce((s, r) => s + r.total, 0))} />
        <Stat label="Cancellation rate" value={inRange.length ? `${Math.round((cancelled.length / inRange.length) * 100)}%` : "—"} tone="red" />
      </div>
      <div className="adm-grid-2">
        <Panel title="Rides per day"><BarChart data={days.map(({ key, label: l }) => ({ d: l, v: d.rides.filter((r) => istDay(r.created_at) === key).length }))} format={(n) => String(n)} color="var(--teal)" /></Panel>
        <Panel title="Payment methods (completed rides)">
          {methods.map(([l, n]) => (
            <div key={l} style={{ padding: "8px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600, marginBottom: 5 }}><span>{l}</span><span>{n}</span></div>
              <div style={{ height: 8, borderRadius: 4, background: "var(--line)" }}><div style={{ width: `${completed.length ? (n / completed.length) * 100 : 0}%`, height: "100%", borderRadius: 4, background: "var(--blue)" }} /></div>
            </div>
          ))}
        </Panel>
      </div>
    </div>
  );
}

/* ───────────────────────── Support (two-way: replies appear in the customer/driver chat) ───────────────────────── */

function SupportSection({ d, act }: { d: Data; act: Act }) {
  const [open, setOpen] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const sel = d.tickets.find((t) => t.id === open);
  return (
    <Panel title="Support tickets">
      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead><tr><th>Ticket</th><th>From</th><th>Role</th><th>Subject</th><th>Ride</th><th>Raised</th><th>Status</th></tr></thead>
          <tbody>
            {d.tickets.map((t) => (
              <tr key={t.id} onClick={() => { setOpen(t.id); setNote(""); }}>
                <td style={{ fontWeight: 700 }}>{t.code}</td><td>{nameOf(d, t.user_id)}</td><td>{t.role}</td><td style={{ maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis" }}>{t.subject}</td>
                <td>{t.ride_id ? `#${d.rides.find((r) => r.id === t.ride_id)?.code ?? "…"}` : "—"}</td><td>{when(t.created_at)}</td><td><StatusBadge status={t.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {d.tickets.length === 0 && <p style={{ textAlign: "center", color: "var(--ink-soft)", padding: 24 }}>No tickets.</p>}
      </div>
      {sel && (
        <Drawer title={`${sel.code} · ${nameOf(d, sel.user_id)}`} onClose={() => setOpen(null)}>
          <div>
            <span style={label}>Status</span>
            <Chips value={sel.status} options={["Open", "In Progress", "Resolved"] as Ticket["status"][]} onChange={(s) => void act("admin_update_ticket", { p_ticket: sel.id, p_status: s, p_note: "" }, `${sel.code} marked ${s}`)} />
          </div>
          <Panel title="Conversation">
            {sel.notes.map((n, i) => (
              <p key={i} style={{ margin: "0 0 8px", fontSize: 13.5, background: n.from === "agent" ? "var(--blue-tint)" : "var(--bg-secondary)", borderRadius: 10, padding: "8px 10px" }}>
                <b style={{ fontSize: 11.5, color: "var(--ink-soft)" }}>{n.from === "agent" ? "Support" : sel.role} · {when(n.at)}</b><br />{n.body}
              </p>
            ))}
            <form onSubmit={(e) => { e.preventDefault(); if (!note.trim()) return; void act("admin_update_ticket", { p_ticket: sel.id, p_status: sel.status === "Open" ? "In Progress" : sel.status, p_note: note.trim() }, "Reply sent").then((ok) => ok && setNote("")); }} style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <input value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} placeholder="Reply to the customer/driver…" aria-label="Reply" style={{ ...field, flex: 1, padding: "9px 12px" }} />
              <button type="submit" style={smallBtn("blue")}>Send</button>
            </form>
          </Panel>
        </Drawer>
      )}
    </Panel>
  );
}

/* ───────────────────────── Notifications ───────────────────────── */

function NotifySection() {
  return (
    <Panel title="Broadcast announcements">
      <p style={{ margin: 0, fontSize: 13.5, color: "var(--ink-soft)", lineHeight: 1.6 }}>
        Push notifications aren&apos;t connected yet. Sending needs a push provider (e.g. Firebase Cloud Messaging) and device tokens stored per user.
        Until then, use coupons and in-app support replies to reach customers and drivers.
      </p>
    </Panel>
  );
}

/* ───────────────────────── Settings & audit log ───────────────────────── */

function SettingsSection({ d }: { d: Data }) {
  const admins = d.profiles.filter((p) => p.is_admin);
  const nameById = useMemo(() => new Map(d.profiles.map((p) => [p.id, p.name || p.email || p.phone || p.id.slice(0, 8)])), [d.profiles]);
  return (
    <div className="adm-grid-2">
      <Panel title="Audit log · last 100 admin actions">
        {d.audit.length === 0 && <p style={{ margin: 0, fontSize: 13, color: "var(--ink-soft)" }}>No admin actions yet.</p>}
        {d.audit.map((a) => (
          <div key={a.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--line)", fontSize: 13 }}>
            <b>{a.action}</b> · {a.target} <span style={{ color: "var(--ink-soft)" }}>by {a.actor ? nameById.get(a.actor) ?? "unknown" : "system"} · {when(a.at)}</span>
          </div>
        ))}
      </Panel>
      <Panel title="Admins">
        {admins.map((p) => (
          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
            <Avatar initials={initials(p.name || p.email || "A")} size={36} /><div style={{ flex: 1 }}><p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{p.name || p.email}</p><p style={{ margin: 0, fontSize: 12, color: "var(--ink-soft)" }}>{p.email}</p></div>
          </div>
        ))}
        <p style={{ margin: "12px 0 0", fontSize: 12, color: "var(--ink-mute)" }}>Admin access is granted from the Supabase SQL editor (see docs/SETUP.md). Every admin action is recorded in the audit log.</p>
      </Panel>
    </div>
  );
}
