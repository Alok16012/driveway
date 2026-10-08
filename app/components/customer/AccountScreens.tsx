"use client";

import { useEffect, useRef, useState } from "react";
import {
  BackIcon, BellIcon, CardIcon, ChevronRight, DocIcon, GearIcon, HelpIcon, HistoryIcon, InfoIcon, AlertIcon,
  PinIcon, SendIcon, WalletIcon, ArrowRight, CalendarIcon, GiftIcon,
} from "../icons";
import { BrandMark } from "../Brand";
import VehicleArt, { ParcelArt } from "../VehicleArt";
import { Avatar, LoadState, PageHeader, PrimaryButton, StatusBadge, Tabs, card, iconBtn } from "../ui";
import { inr, vehicleById } from "../../lib/data";
import { activeCoupons, fmtWhen, rideLabel, type CouponRow, type RideView } from "../../lib/api";

/* ───────────────────────── My rides ───────────────────────── */

const label = (r: RideView) => rideLabel(r, vehicleById(r.vehicle).name);
const owed = (r: RideView) => (r.status === "Cancelled" || r.status === "NoDrivers" ? r.cancel_fee : r.status === "Completed" ? r.total : r.fare - r.discount);

export function RidesScreen({ rides, error, onRetry, onBack, onOpen, onBook, initialTab = "past" }: {
  rides: RideView[] | null; error?: string | null; onRetry?: () => void; onBack?: () => void; onOpen: (r: RideView) => void; onBook: () => void; initialTab?: "past" | "upcoming";
}) {
  const [tab, setTab] = useState<"past" | "upcoming">(initialTab);
  const rows = (rides ?? []).filter((r) => (tab === "upcoming") === (r.status === "Scheduled"));
  return (
    <div>
      <PageHeader title="My Rides" onBack={onBack} />
      <div style={{ padding: "0 16px 24px" }}>
        <Tabs value={tab} onChange={setTab} tabs={[{ id: "past", label: "Past" }, { id: "upcoming", label: "Upcoming" }]} />
        {!rides ? <LoadState error={error} onRetry={onRetry} /> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 14 }}>
          {rows.map((r) => (
            <button key={r.id} onClick={() => onOpen(r)} className="press" style={{ ...card, border: "none", padding: 12, cursor: "pointer", textAlign: "left", display: "flex", gap: 12 }}>
              <div style={{ width: 70, height: 70, flexShrink: 0, borderRadius: 14, background: "var(--bg-secondary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {r.service === "parcel" ? <ParcelArt size={58} /> : <VehicleArt kind={r.vehicle} size={58} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)" }}>{fmtWhen(r.scheduled_for ?? r.created_at)}</span>
                  <StatusBadge status={r.payment_status === "pending" ? "Payment due" : r.status} />
                </div>
                <p style={{ margin: "3px 0 0", fontSize: 12.5, color: "var(--ink-soft)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}><b style={{ fontWeight: 600, color: "var(--ink)" }}>{label(r)} · </b>{r.from.name} → {r.to.name}</p>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>{owed(r) > 0 ? inr(owed(r)) : "—"}</span>
                  {r.rating ? <span style={{ fontSize: 12, color: "var(--gold-dark)", fontWeight: 600 }}>{"★".repeat(r.rating)}</span>
                    : <span style={{ fontSize: 12, fontWeight: 600, color: "var(--blue)", display: "flex", alignItems: "center", gap: 3 }}>Details <ArrowRight s={13} c="var(--blue)" w={2.2} /></span>}
                </div>
              </div>
            </button>
          ))}
          {rows.length === 0 && (
            <div style={{ ...card, padding: "32px 20px", textAlign: "center" }}>
              <CalendarIcon s={36} c="var(--ink-mute)" />
              <p style={{ margin: "10px 0 2px", fontSize: 15, fontWeight: 600 }}>{tab === "upcoming" ? "No upcoming rides" : "No rides yet"}</p>
              <p style={{ margin: "0 0 14px", fontSize: 12.5, color: "var(--ink-soft)" }}>{tab === "upcoming" ? "Scheduled rides will show up here." : "Your trips will show up here."}</p>
              <button onClick={onBook} style={{ border: "none", background: "var(--blue)", color: "white", borderRadius: 12, padding: "10px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Book a ride</button>
            </div>
          )}
        </div>)}
      </div>
    </div>
  );
}

/* ───────────────────────── Receipt ───────────────────────── */

export function RideDetailPage({ ride, onBack, onHelp, onPay, onCancel }: {
  ride: RideView; onBack: () => void; onHelp: () => void; onPay?: () => void; onCancel?: () => void;
}) {
  const v = vehicleById(ride.vehicle);
  const ended = ride.status === "Cancelled" || ride.status === "NoDrivers";
  const row = (l: string, r: string, strong = false, color?: string) => (
    <div key={l} style={{ display: "flex", justifyContent: "space-between", fontSize: strong ? 15 : 13.5, fontWeight: strong ? 700 : 500, color: color ?? (strong ? "var(--ink)" : "var(--ink-soft)"), padding: "4px 0" }}><span>{l}</span><span>{r}</span></div>
  );
  const payLabel = { unpaid: "Not charged", pending: "Payment due", paid: "Paid", refunded: "Refunded", partially_refunded: "Partly refunded" }[ride.payment_status];
  return (
    <div>
      <PageHeader title={`Ride #${ride.code}`} sub={fmtWhen(ride.scheduled_for ?? ride.created_at)} onBack={onBack} />
      <div style={{ padding: "0 16px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ ...card, padding: 14, display: "flex", gap: 12, alignItems: "center" }}>
          <Avatar initials={(ride.driver?.name ?? "DW").split(" ").map((s) => s[0]).join("").slice(0, 2)} size={46} />
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 14.5, fontWeight: 700 }}>{ride.driver?.name ?? (ride.status === "Scheduled" ? "Driver assigned before pickup" : "No driver")}</p>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--ink-soft)" }}>{label(ride)} · {ride.km} km · {ride.mins} min</p>
          </div>
          <StatusBadge status={ride.status} />
        </div>
        <div style={{ ...card, padding: 14 }}>
          {[["PICKUP", ride.from.name, "var(--green)"], ["DROP", ride.to.name, "var(--red)"]].map(([k, val, c]) => (
            <div key={k} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "4px 0" }}>
              <span style={{ width: 9, height: 9, marginTop: 6, borderRadius: k === "DROP" ? 2 : "50%", background: c }} />
              <div><p style={{ margin: 0, fontSize: 11, color: "var(--ink-mute)", fontWeight: 600 }}>{k}</p><p style={{ margin: 0, fontSize: 13.5, fontWeight: 600 }}>{val}</p></div>
            </div>
          ))}
        </div>
        <div style={{ ...card, padding: "12px 16px" }}>
          <p style={{ margin: "0 0 6px", fontSize: 13.5, fontWeight: 700 }}>Fare Breakdown</p>
          {ended ? (
            <>{row("Cancellation reason", ride.status === "NoDrivers" ? "No drivers available" : ride.cancel_reason ?? "—")}{row("Cancellation fee", inr(ride.cancel_fee))}</>
          ) : (
            <>
              {row(ride.status === "Completed" ? "Trip fare" : "Quoted fare", inr(ride.fare))}
              {ride.wait_fee > 0 && row("Waiting charge", inr(ride.wait_fee))}
              {ride.discount > 0 && row(`Coupon ${ride.coupon ?? ""}`, "− " + inr(ride.discount), false, "var(--success-text)")}
            </>
          )}
          <div style={{ borderTop: "1px dashed var(--line-strong)", margin: "6px 0" }} />
          {row(ride.payment_status === "paid" ? "Total paid" : "Total", inr(owed(ride)), true)}
          {ride.refunded > 0 && row("Refunded to wallet", "− " + inr(ride.refunded), false, "var(--success-text)")}
          {(ride.status === "Completed" || ride.cancel_fee > 0) && row("Payment", `${ride.pay} · ${payLabel}`)}
        </div>
        {onPay && ride.payment_status === "pending" && ride.pay !== "Cash" && <PrimaryButton onClick={onPay}>Pay {inr(ride.total)}</PrimaryButton>}
        {onCancel && ride.status === "Scheduled" && <PrimaryButton tone="ghost" onClick={onCancel}>Cancel scheduled ride</PrimaryButton>}
        <button onClick={onHelp} className="press" style={{ ...card, width: "100%", border: "none", padding: 14, display: "flex", alignItems: "center", gap: 12, cursor: "pointer", textAlign: "left" }}>
          <AlertIcon s={21} c="var(--blue)" />
          <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>Report an issue with this ride</span>
          <ChevronRight s={16} c="var(--ink-soft)" />
        </button>
      </div>
    </div>
  );
}

/* ───────────────────────── Offers ───────────────────────── */

export function OffersScreen({ onBack, onUse }: { onBack?: () => void; onUse: (code: string) => void }) {
  const [list, setList] = useState<CouponRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = () => { setErr(null); activeCoupons().then(setList, (e) => setErr((e as Error).message)); };
  useEffect(load, []);
  return (
    <div>
      <PageHeader title="Offers & Coupons" onBack={onBack} />
      <div style={{ padding: "0 16px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
        {!list ? <LoadState error={err} onRetry={load} /> : list.length === 0 ? <p style={{ textAlign: "center", color: "var(--ink-soft)", fontSize: 13.5 }}>No offers right now.</p> : list.map((c) => (
          <div key={c.code} style={{ ...card, display: "flex", overflow: "hidden" }}>
            <div style={{ width: 84, background: "linear-gradient(160deg,var(--gold),var(--gold-dark))", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--blue-dark)", position: "relative" }}>
              <span style={{ fontSize: 22, fontWeight: 800, lineHeight: 1 }}>{c.pct ? `${c.off}%` : `₹${c.off}`}</span>
              <span style={{ fontSize: 11, fontWeight: 700 }}>OFF</span>
              <span style={{ position: "absolute", right: -7, top: "50%", width: 14, height: 14, marginTop: -7, borderRadius: "50%", background: "var(--app-bg)" }} />
            </div>
            <div style={{ flex: 1, padding: "12px 14px" }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{c.title}</p>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--ink-soft)" }}>{c.body}</p>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--gold-dark)", border: "1.5px dashed var(--gold)", borderRadius: 8, padding: "3px 8px" }}>{c.code}</span>
                <button onClick={() => onUse(c.code)} style={{ background: "none", border: "none", color: "var(--blue)", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Use now →</button>
              </div>
              <p style={{ margin: "6px 0 0", fontSize: 10.5, color: "var(--ink-mute)" }}>Valid till {new Date(c.expires_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })}{c.max_off ? ` · up to ${inr(c.max_off)} off` : ""}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ───────────────────────── Support chat ───────────────────────── */

export interface ChatMessage { id: number; from: "me" | "agent"; body: string; at: string }

const QUICK = ["Payment issue", "Lost item", "Driver behaviour", "Fare too high"];

export function ChatScreen({ title, subtitle, messages, typing, onSend, onBack, quick = QUICK }: {
  title: string; subtitle?: string; messages: ChatMessage[]; typing: boolean; onSend: (body: string) => void; onBack?: () => void; quick?: string[];
}) {
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages.length, typing]);
  const send = (text = draft) => { const b = text.trim(); if (!b) return; onSend(b); setDraft(""); };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px 12px", background: "var(--app-bg)", borderBottom: "1px solid var(--line)" }}>
        {onBack && <button onClick={onBack} aria-label="Back" className="press" style={iconBtn}><BackIcon c="var(--ink)" /></button>}
        <div style={{ position: "relative" }}>
          <div style={{ width: 42, height: 42, borderRadius: "50%", background: "var(--surface)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "var(--shadow-card)" }}><BrandMark size={26} /></div>
          <span style={{ position: "absolute", right: 0, bottom: 1, width: 11, height: 11, borderRadius: "50%", background: "var(--green-500)", border: "2px solid var(--app-bg)" }} />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: 15.5, fontWeight: 600, color: "var(--ink)" }}>{title}</p>
          <p style={{ margin: 0, fontSize: 11.5, color: "var(--success-text)", fontWeight: 500 }}>{typing ? "typing…" : subtitle ?? "Online · replies in ~2 min"}</p>
        </div>
      </div>
      <div className="no-scroll" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "14px 16px 8px" }}>
        <p style={{ textAlign: "center", margin: "0 0 12px" }}><span style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-soft)", background: "var(--surface)", padding: "4px 12px", borderRadius: 999 }}>Today</span></p>
        {messages.map((m) => {
          const me = m.from === "me";
          return (
            <div key={m.id} className="fade-up" style={{ display: "flex", justifyContent: me ? "flex-end" : "flex-start", marginBottom: 10 }}>
              <div style={{ maxWidth: "78%" }}>
                <div style={{
                  padding: "10px 14px", fontSize: 13.5, lineHeight: 1.5,
                  borderRadius: me ? "18px 18px 6px 18px" : "18px 18px 18px 6px",
                  background: me ? "linear-gradient(135deg,var(--blue),var(--blue-dark))" : "var(--surface)",
                  color: me ? "white" : "var(--ink)", boxShadow: me ? "0 4px 12px rgba(11,92,255,0.22)" : "var(--shadow-card)",
                }}>{m.body}</div>
                <p style={{ margin: "3px 6px 0", fontSize: 10.5, color: "var(--ink-mute)", textAlign: me ? "right" : "left" }}>{m.at}{me && " · ✓✓"}</p>
              </div>
            </div>
          );
        })}
        {typing && (
          <div style={{ display: "inline-flex", gap: 4, background: "var(--surface)", padding: "12px 14px", borderRadius: "18px 18px 18px 6px", boxShadow: "var(--shadow-card)" }}>
            {[0, 1, 2].map((i) => <span key={i} className="animate-pulse-dot" style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--ink-mute)", animationDelay: `${i * 0.2}s` }} />)}
          </div>
        )}
        <div ref={endRef} />
      </div>
      <div style={{ padding: "6px 16px 0" }}>
        <div className="no-scroll" style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8 }}>
          {quick.map((q) => (
            <button key={q} onClick={() => send(q)} style={{ flexShrink: 0, border: "1.5px solid var(--blue-ghost)", background: "var(--surface)", color: "var(--blue)", borderRadius: 999, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{q}</button>
          ))}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); send(); }} style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: onBack ? "calc(12px + env(safe-area-inset-bottom))" : 10 }}>
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Type a message..." aria-label="Message"
            style={{ flex: 1, border: "none", outline: "none", background: "var(--surface)", borderRadius: 999, padding: "12px 16px", fontSize: 14, color: "var(--ink)", boxShadow: "var(--shadow-card)" }} />
          <button type="submit" aria-label="Send" className="press" disabled={!draft.trim()} style={{
            width: 46, height: 46, borderRadius: "50%", border: "none", cursor: "pointer", flexShrink: 0,
            background: draft.trim() ? "linear-gradient(135deg,var(--blue),var(--blue-dark))" : "var(--line-strong)",
            display: "flex", alignItems: "center", justifyContent: "center", boxShadow: draft.trim() ? "0 6px 14px rgba(11,92,255,0.3)" : "none",
          }}><SendIcon s={19} c="white" w={2} /></button>
        </form>
      </div>
    </div>
  );
}

/* ───────────────────────── Profile ───────────────────────── */

export type ProfileKey = "rides" | "places" | "payments" | "wallet" | "notifications" | "help" | "report" | "legal" | "about";

const MENU: { key: ProfileKey; label: string; Icon: (p: { s?: number; c?: string; w?: number }) => React.ReactElement }[] = [
  { key: "rides", label: "Ride History", Icon: HistoryIcon },
  { key: "places", label: "Saved Places", Icon: PinIcon },
  { key: "payments", label: "Payment Methods", Icon: CardIcon },
  { key: "wallet", label: "Wallet", Icon: WalletIcon },
  { key: "notifications", label: "Notifications", Icon: BellIcon },
  { key: "help", label: "Help & Support", Icon: HelpIcon },
  { key: "report", label: "Report an Issue", Icon: AlertIcon },
  { key: "legal", label: "Terms & Privacy Policy", Icon: DocIcon },
  { key: "about", label: "About DriveWay", Icon: InfoIcon },
];

export function ProfileScreen({ user, stats, onMenu, onLogout, onDelete }: {
  user: { name: string; initials: string; email: string; phone: string; rating: number | null };
  stats: { rides: number; saved: number; coupons: number }; onMenu: (k: ProfileKey) => void; onLogout: () => void; onDelete: () => void;
}) {
  return (
    <div style={{ paddingBottom: 12 }}>
      <PageHeader title="Your Profile" right={<span aria-hidden="true" style={{ display: "flex" }}><GearIcon s={22} c="var(--text-secondary)" /></span>} />
      <div style={{ padding: "0 16px" }}>
        <div style={{ ...card, padding: "18px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Avatar initials={user.initials} size={58} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 19, fontWeight: 700 }}>{user.name}</p>
              {user.email && <p style={{ margin: "1px 0 0", fontSize: 13, color: "var(--text-muted)" }}>{user.email}</p>}
              <p style={{ margin: "1px 0 0", fontSize: 12.5, color: "var(--text-muted)" }}>{user.phone}</p>
            </div>
          </div>
          {user.rating ? <span style={{ display: "inline-block", marginTop: 14, background: "var(--green)", color: "white", fontSize: 11, fontWeight: 600, padding: "5px 11px", borderRadius: 6, letterSpacing: "0.02em" }}>★ {user.rating} RIDER RATING</span> : <span style={{ display: "inline-block", marginTop: 14, fontSize: 11.5, color: "var(--ink-soft)" }}>New rider · rated by drivers after your first trip</span>}
        </div>
      </div>
      <div style={{ padding: "14px 16px 0" }}>
        <div style={{ ...card, padding: "14px 16px", display: "flex" }}>
          {[[String(stats.rides), "Rides"], [String(stats.saved), "Saved places"], [String(stats.coupons), "Coupons"]].map(([v, l], i) => (
            <div key={l} style={{ flex: 1, textAlign: "center", borderRight: i < 2 ? "1px solid var(--border)" : "none" }}>
              <p style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{v}</p>
              <p style={{ margin: "2px 0 0", fontSize: 11.5, color: "var(--text-muted)" }}>{l}</p>
            </div>
          ))}
        </div>
      </div>
      <div style={{ padding: "18px 16px 0" }}>
        {MENU.map(({ key, label, Icon }, i) => (
          <button key={key} onClick={() => onMenu(key)} className="press" style={{
            width: "100%", display: "flex", alignItems: "center", gap: 16, padding: "16px 2px",
            background: "none", border: "none", borderTop: i === 0 ? "none" : "1px solid var(--line)", cursor: "pointer", textAlign: "left",
          }}>
            <Icon s={22} c="var(--text-muted)" w={1.6} />
            <span style={{ flex: 1, fontSize: 15, fontWeight: 500, color: "var(--text-secondary)" }}>{label}</span>
            <ChevronRight s={16} c="var(--ink-mute)" />
          </button>
        ))}
      </div>
      <div style={{ padding: "22px 16px 12px" }}>
        <button onClick={onLogout} className="press" style={{ width: "100%", background: "var(--surface)", color: "var(--red)", border: "none", borderRadius: 16, padding: 15, fontSize: 15, fontWeight: 600, cursor: "pointer" }}>Log Out</button>
        <button onClick={onDelete} style={{ display: "block", margin: "12px auto 0", background: "none", border: "none", color: "var(--ink-mute)", fontSize: 12.5, cursor: "pointer", textDecoration: "underline" }}>Request account deletion</button>
        <p style={{ textAlign: "center", fontSize: 11.5, color: "var(--text-disabled)", marginTop: 10 }}>DriveWay v1.0.0</p>
      </div>
    </div>
  );
}

export function InfoPage({ title, onBack, children }: { title: string; onBack: () => void; children: React.ReactNode }) {
  return (
    <div>
      <PageHeader title={title} onBack={onBack} />
      <div style={{ padding: "0 16px 24px", display: "flex", flexDirection: "column", gap: 12 }}>{children}</div>
    </div>
  );
}

