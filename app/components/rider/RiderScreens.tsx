"use client";

import { useEffect, useState } from "react";
import {
  AlertIcon, BackIcon, BellIcon, CheckIcon, ChevronRight, ClockIcon, DocIcon, GearIcon, GiftIcon, HelpIcon,
  NavIcon, PhoneIcon, RupeeIcon, ShieldIcon, SteeringIcon, WalletIcon,
} from "../icons";
import { BrandMark, Wordmark } from "../Brand";
import MapView from "../MapView";
import VehicleArt from "../VehicleArt";
import { Avatar, ErrorText, OtpInput, PageHeader, PrimaryButton, Stars, StatusBadge, Tabs, Toggle, card, iconBtn } from "../ui";
import { inr, vehicleById } from "../../lib/data";
import { fmtWhen, rideLabel, type DriverMe, type RideView, type Txn } from "../../lib/api";

const dotStyle = (c: string, sq = false): React.CSSProperties => ({ width: 9, height: 9, borderRadius: sq ? 2 : "50%", background: c, flexShrink: 0 });
const initials = (n: string) => n.split(/\s+/).filter(Boolean).map((s) => s[0]).join("").slice(0, 2).toUpperCase() || "DW";

export function RouteLines({ from, to }: { from: string; to: string }) {
  return (
    <div style={{ display: "flex", gap: 12 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, paddingTop: 5 }}>
        <span style={dotStyle("var(--green)")} />
        <span style={{ width: 2, flex: 1, background: "repeating-linear-gradient(var(--line-strong) 0 4px, transparent 4px 7px)" }} />
        <span style={dotStyle("var(--red)", true)} />
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
        <div><p style={{ margin: 0, fontSize: 11, color: "var(--ink-mute)", fontWeight: 600 }}>PICKUP</p><p style={{ margin: 0, fontSize: 13.5, fontWeight: 600 }}>{from}</p></div>
        <div><p style={{ margin: 0, fontSize: 11, color: "var(--ink-mute)", fontWeight: 600 }}>DROP</p><p style={{ margin: 0, fontSize: 13.5, fontWeight: 600 }}>{to}</p></div>
      </div>
    </div>
  );
}

/* ───────────────────────── Home / online mode ───────────────────────── */

export type QuickKey = "wallet" | "incentives" | "performance";

const QUICK: { k: QuickKey; label: string; Icon: typeof WalletIcon; c: string; bg: string }[] = [
  { k: "wallet", label: "Wallet", Icon: WalletIcon, c: "var(--blue)", bg: "var(--blue-tint)" },
  { k: "incentives", label: "Incentives", Icon: GiftIcon, c: "var(--gold-dark)", bg: "var(--gold-tint)" },
  { k: "performance", label: "Ratings", Icon: ShieldIcon, c: "var(--purple)", bg: "var(--purple-tint)" },
];

export function RiderHome({ me, online, toggling, toggleErr, onToggle, onOpenEarnings, onAlerts, onQuick, unread }: {
  me: DriverMe; online: boolean; toggling: boolean; toggleErr: string | null; onToggle: (v: boolean) => void;
  onOpenEarnings: () => void; onAlerts: () => void; onQuick: (k: QuickKey) => void; unread: number;
}) {
  const daily = me.incentives.find((i) => i.kind === "today");
  return (
    <div style={{ paddingBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px 10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}><BrandMark size={34} /><Wordmark sub="RIDER · DRIVE · EARN" /></div>
        <button aria-label="Notifications" onClick={onAlerts} className="press" style={iconBtn}>
          <BellIcon s={25} c="var(--text-secondary)" w={1.7} />
          {unread > 0 && <span style={{ position: "absolute", top: 1, right: 2, width: 8, height: 8, borderRadius: "50%", background: "var(--red)", border: "1.5px solid var(--app-bg)" }} />}
        </button>
      </div>

      <div style={{ padding: "4px 16px 0" }}>
        <div style={{
          width: "100%", borderRadius: 20, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, textAlign: "left",
          background: online ? "linear-gradient(135deg,#34c38f,var(--green))" : "var(--surface)", color: online ? "white" : "var(--ink)",
          boxShadow: online ? "0 10px 24px rgba(47,158,118,0.32)" : "var(--shadow-card)", transition: "background 0.3s",
        }}>
          <span style={{ width: 46, height: 46, borderRadius: "50%", background: online ? "rgba(255,255,255,0.2)" : "var(--bg-secondary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ width: 14, height: 14, borderRadius: "50%", background: online ? "white" : "var(--ink-mute)", boxShadow: online ? "0 0 0 5px rgba(255,255,255,0.3)" : "none" }} className={online ? "animate-pulse-dot" : undefined} />
          </span>
          <span style={{ flex: 1 }}>
            <span style={{ display: "block", fontSize: 17, fontWeight: 700 }}>{toggling ? "Updating…" : online ? "You're Online" : "You're Offline"}</span>
            <span style={{ display: "block", fontSize: 12.5, opacity: 0.8 }}>{me.suspended ? "Account suspended — contact support" : online ? "Looking for ride requests nearby…" : "Go online to start receiving rides"}</span>
          </span>
          <Toggle on={online} onChange={(v) => { if (!toggling) onToggle(v); }} label="Go online" />
        </div>
        <ErrorText msg={toggleErr} />
      </div>

      <div style={{ padding: "14px 16px 0" }}>
        <MapView height={200} radius={22} nearby={false}>
          <div style={{ position: "absolute", top: 12, left: 12, display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.95)", borderRadius: 999, padding: "6px 12px 6px 8px", boxShadow: "var(--shadow-md)" }}>
            <NavIcon s={14} c="var(--blue)" />
            <span style={{ fontSize: 12, fontWeight: 600 }}>{me.city}</span>
          </div>
        </MapView>
      </div>

      <div style={{ padding: "14px 16px 0", display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
        {QUICK.map(({ k, label: l, Icon, c, bg }) => (
          <button key={k} onClick={() => onQuick(k)} className="press" style={{ ...card, border: "none", cursor: "pointer", padding: "12px 4px 10px", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <span style={{ width: 38, height: 38, borderRadius: 12, background: bg, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon s={20} c={c} /></span>
            <span style={{ fontSize: 11.5, fontWeight: 600, color: me.balance < 0 && k === "wallet" ? "var(--error-text)" : "var(--ink)" }}>{k === "wallet" ? inr(me.balance) : l}</span>
          </button>
        ))}
      </div>

      <div style={{ padding: "18px 16px 0", display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div>
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-soft)", fontWeight: 500 }}>Today</p>
          <p style={{ margin: 0, fontSize: 19, fontWeight: 700 }}>Your Summary</p>
        </div>
        <button onClick={onOpenEarnings} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--blue)", fontSize: 13.5, fontWeight: 600 }}>Earnings →</button>
      </div>
      <div style={{ padding: "12px 16px 0", display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 10 }}>
        <div style={{ borderRadius: 18, padding: "14px 12px", background: "linear-gradient(150deg,var(--blue-dark),var(--blue))", color: "white", boxShadow: "0 10px 24px rgba(11,92,255,0.25)" }}>
          <RupeeIcon s={20} c="var(--gold)" />
          <p style={{ margin: "8px 0 0", fontSize: 21, fontWeight: 800 }}>{inr(me.today.earnings)}</p>
          <p style={{ margin: 0, fontSize: 11.5, color: "rgba(255,255,255,0.75)" }}>Earnings</p>
        </div>
        <div style={{ ...card, padding: "14px 12px" }}>
          <CheckIcon s={20} c="var(--blue)" />
          <p style={{ margin: "8px 0 0", fontSize: 19, fontWeight: 800 }}>{me.today.trips}</p>
          <p style={{ margin: 0, fontSize: 11.5, color: "var(--ink-soft)" }}>Trips</p>
        </div>
      </div>

      {daily && (
        <div style={{ padding: "14px 16px 0" }}>
          <button onClick={() => onQuick("incentives")} className="press" style={{ ...card, width: "100%", cursor: "pointer", textAlign: "left", padding: 14, display: "flex", alignItems: "center", gap: 12, border: "1px solid var(--line)" }}>
            <span style={{ width: 48, height: 48, borderRadius: 14, flexShrink: 0, background: "linear-gradient(135deg,var(--gold),var(--gold-dark))", display: "flex", alignItems: "center", justifyContent: "center" }}><GiftIcon s={24} c="white" /></span>
            <span style={{ flex: 1 }}>
              <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: "var(--ink)" }}>
                {daily.progress >= daily.target ? `🎉 ${inr(daily.reward)} bonus unlocked!` : `Bonus: ${daily.target - daily.progress} more trips → ${inr(daily.reward)}`}
              </span>
              <span style={{ display: "block", height: 6, borderRadius: 3, background: "var(--line)", margin: "6px 0 0" }}>
                <span style={{ display: "block", width: `${Math.min(100, (daily.progress / daily.target) * 100)}%`, height: "100%", borderRadius: 3, background: "var(--gold)", transition: "width 0.4s" }} />
              </span>
            </span>
            <ChevronRight s={16} c="var(--ink-mute)" />
          </button>
        </div>
      )}

      <div style={{ padding: "14px 16px 0" }}>
        <div style={{ ...card, padding: 14, display: "flex", alignItems: "center", gap: 12 }}>
          <VehicleArt kind={me.vehicle} size={60} />
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{me.model}</p>
            <p style={{ margin: "1px 0 0", fontSize: 12, color: "var(--ink-soft)" }}>{vehicleById(me.vehicle).name} · {me.ac ? "❄ AC" : "Non-AC"} · {me.plate}</p>
          </div>
          <StatusBadge status={me.suspended ? "Suspended" : me.kyc} />
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Incoming request popup ───────────────────────── */

export const REQUEST_SECONDS = 15;

export function RequestPopup({ offer, autoAccept, busy, err, onAccept, onDecline }: {
  offer: RideView; autoAccept?: boolean; busy: boolean; err: string | null; onAccept: () => void; onDecline: (expired: boolean) => void;
}) {
  const [left, setLeft] = useState(REQUEST_SECONDS);
  useEffect(() => {
    if (busy) return;
    if (left <= 0) { onDecline(true); return; }
    if (autoAccept && left === REQUEST_SECONDS - 3) { onAccept(); return; }
    const t = setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => clearTimeout(t);
  }, [left, autoAccept, busy, onAccept, onDecline]);

  const parcel = offer.service === "parcel";
  const who = offer.customer?.name ?? "Customer";
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 150, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <div className="fade-up" style={{ position: "absolute", inset: 0, background: "rgba(15,23,41,0.5)" }} />
      <div className="slide-up" style={{ position: "relative", background: "var(--app-bg)", borderRadius: "24px 24px 0 0", padding: "16px 16px calc(18px + env(safe-area-inset-bottom))", maxHeight: "94%", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{parcel ? "New Delivery Request" : "New Ride Request"}</p>
            <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
              {!parcel && <span style={{ background: offer.ac ? "var(--info-bg)" : "var(--surface-dim)", color: offer.ac ? "var(--info-text)" : "var(--text-muted)", fontSize: 10.5, fontWeight: 700, padding: "3px 8px", borderRadius: 6 }}>{offer.ac ? "❄ AC RIDE" : "NON-AC"}</span>}
              {parcel && offer.parcel && <span style={{ background: "var(--gold-tint)", color: "var(--gold-dark)", fontSize: 10.5, fontWeight: 700, padding: "3px 8px", borderRadius: 6 }}>📦 {offer.parcel.type.toUpperCase()} · {offer.parcel.weight_label.toUpperCase()}</span>}
              {autoAccept && <span style={{ background: "var(--success)", color: "var(--success-text)", fontSize: 10.5, fontWeight: 700, padding: "3px 8px", borderRadius: 6 }}>AUTO-ACCEPTING…</span>}
            </div>
          </div>
          <span style={{ position: "relative", width: 44, height: 44 }}>
            <svg width="44" height="44" viewBox="0 0 44 44" style={{ transform: "rotate(-90deg)" }} aria-hidden="true">
              <circle cx="22" cy="22" r="19" stroke="var(--line)" strokeWidth="4" fill="none" />
              <circle cx="22" cy="22" r="19" stroke={left <= 5 ? "var(--red)" : "var(--blue)"} strokeWidth="4" fill="none" strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 19} strokeDashoffset={2 * Math.PI * 19 * (1 - left / REQUEST_SECONDS)} style={{ transition: "stroke-dashoffset 1s linear" }} />
            </svg>
            <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800 }}>{left}</span>
          </span>
        </div>
        <MapView mode="route" height={120} radius={16} nearby={false} style={{ margin: "12px 0" }} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 8, marginBottom: 12 }}>
          {[[inr(offer.fare), `${offer.pay} · you get ${inr(offer.earn ?? 0)}`], [`${offer.km} km`, `~${offer.mins} min trip`]].map(([v, l]) => (
            <div key={l} style={{ ...card, padding: "10px 8px", textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{v}</p>
              <p style={{ margin: 0, fontSize: 10.5, color: "var(--ink-soft)" }}>{l}</p>
            </div>
          ))}
        </div>
        <div style={{ ...card, padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <Avatar initials={initials(who)} size={36} tone="gold" />
            <div style={{ flex: 1 }}><p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{who}</p><p style={{ margin: 0, fontSize: 11.5, color: "var(--ink-soft)" }}>{offer.customer?.rating ? `★ ${offer.customer.rating}` : "New"} {parcel ? "sender" : "customer"}</p></div>
          </div>
          <RouteLines from={`${offer.from.name}, ${offer.from.address}`} to={`${offer.to.name}, ${offer.to.address}`} />
        </div>
        <ErrorText msg={err} />
        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <PrimaryButton tone="ghost" disabled={busy} onClick={() => onDecline(false)} style={{ flex: 1, color: "var(--red)" }}>Decline</PrimaryButton>
          <PrimaryButton disabled={busy} onClick={onAccept} style={{ flex: 2, background: "linear-gradient(135deg,#34c38f,var(--green))", boxShadow: "0 6px 16px rgba(47,158,118,0.35)" }}>{busy ? "Accepting…" : parcel ? "Accept Delivery" : "Accept Ride"}</PrimaryButton>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Trip management ───────────────────────── */

const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;

function useSince(iso: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  return iso ? Math.max(0, (now - new Date(iso).getTime()) / 1000) : 0;
}

export function TripPage({ trip, busy, err, onArrived, onStart, onEnd, onCollected, onRated, onBack, onCall, onCancel, onSos, onNavigate }: {
  trip: RideView; busy: boolean; err: string | null;
  onArrived: () => void; onStart: (otp: string) => void; onEnd: () => void; onCollected: () => void; onRated: (stars: number) => void;
  onBack: () => void; onCall: () => void; onCancel: () => void; onSos: () => void; onNavigate: () => void;
}) {
  const [otp, setOtp] = useState("");
  const [stars, setStars] = useState(0);
  const waited = useSince(trip.arrived_at);
  const sinceAssign = useSince(trip.assigned_at);
  const sinceStart = useSince(trip.started_at);
  const parcel = trip.service === "parcel";
  const who = trip.customer?.name ?? "Customer";
  const commission = trip.commission_pct / 100;

  if (trip.status === "Completed") {
    const gross = trip.fare + trip.wait_fee;
    const earn = Math.round(gross * (1 - commission));
    const cashDue = trip.pay === "Cash" && trip.payment_status === "pending";
    return (
      <div style={{ minHeight: "100%", display: "flex", flexDirection: "column", padding: "34px 16px 20px" }}>
        <div style={{ textAlign: "center" }}>
          <div className="fade-up" style={{ width: 76, height: 76, margin: "0 auto", borderRadius: "50%", background: "linear-gradient(135deg,#34c38f,var(--green))", display: "flex", alignItems: "center", justifyContent: "center" }}><CheckIcon s={38} c="white" w={3} /></div>
          <p style={{ margin: "14px 0 0", fontSize: 22, fontWeight: 800 }}>{parcel ? "Parcel Delivered" : "Trip Completed"}</p>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--ink-soft)" }}>{trip.km} km · {trip.mins} min · #{trip.code}</p>
          <p style={{ margin: "14px 0 0", fontSize: 38, fontWeight: 800 }}>{inr(trip.total)}</p>
          <p style={{ margin: "2px 0 0", fontSize: 13, fontWeight: 600, color: trip.payment_status === "paid" ? "var(--success-text)" : "var(--warning-text)" }}>
            {trip.pay === "Cash" ? (cashDue ? `Collect ${inr(trip.total)} in cash` : "✓ Cash collected") : trip.payment_status === "paid" ? `✓ Paid online · ${trip.pay}` : `Customer pays ${trip.pay} in the app`}
          </p>
        </div>
        <div style={{ ...card, padding: "12px 16px", marginTop: 18 }}>
          {([["Trip fare", inr(trip.fare)], trip.wait_fee ? ["Waiting charge", inr(trip.wait_fee)] : null, [`Platform commission (${trip.commission_pct}%)`, "− " + inr(gross - earn)]].filter(Boolean) as string[][]).map(([l, v]) => (
            <div key={l} style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, color: "var(--ink-soft)", padding: "4px 0" }}><span>{l}</span><span>{v}</span></div>
          ))}
          <div style={{ borderTop: "1px dashed var(--line-strong)", margin: "6px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 700, padding: "4px 0" }}><span>You earn</span><span style={{ color: "var(--success-text)" }}>{inr(earn)}</span></div>
          {trip.discount > 0 && <p style={{ margin: "6px 0 0", fontSize: 11.5, color: "var(--ink-mute)", lineHeight: 1.45 }}>The customer used coupon {trip.coupon} (−{inr(trip.discount)}). DriveWay covers it — your earning is unchanged.</p>}
          {trip.pay === "Cash" && <p style={{ margin: "6px 0 0", fontSize: 11.5, color: "var(--ink-mute)", lineHeight: 1.45 }}>You keep the cash; it's deducted from your wallet, so a negative balance is dues owed.</p>}
        </div>
        {!cashDue && (
          <div className="fade-up" style={{ ...card, padding: 16, marginTop: 12, textAlign: "center" }}>
            <p style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 700 }}>Rate {who}</p>
            <Stars value={stars} onChange={setStars} />
          </div>
        )}
        <ErrorText msg={err} />
        <div style={{ marginTop: "auto", paddingTop: 20 }}>
          {cashDue
            ? <PrimaryButton disabled={busy} onClick={onCollected}>{busy ? "Saving…" : `Cash Collected · ${inr(trip.total)}`}</PrimaryButton>
            : <PrimaryButton disabled={busy} onClick={() => onRated(stars)}>{busy ? "Saving…" : stars ? "Submit & Go Online" : "Skip & Go Online"}</PrimaryButton>}
        </div>
      </div>
    );
  }

  const phase = trip.status;            // Arriving | Arrived | Started
  const title = parcel
    ? { Arriving: "Going to collect parcel", Arrived: "Collect the parcel", Started: "Delivering parcel" }[phase as "Arriving"]
    : { Arriving: "On the way to pickup", Arrived: "Waiting for customer", Started: "Trip in progress" }[phase as "Arriving"];
  const approach = 5 * 60;
  const progress = phase === "Arrived" ? 1 : phase === "Started" ? Math.min(0.97, sinceStart / (trip.mins * 60)) : Math.min(0.95, sinceAssign / approach);
  const motion = phase === "Started" && trip.started_at ? { since: trip.started_at, seconds: trip.mins * 60, max: 0.97 }
    : phase === "Arriving" && trip.assigned_at ? { since: trip.assigned_at, seconds: approach, max: 0.95 } : undefined;
  const eta = phase === "Started" ? Math.max(1, Math.round((trip.mins * 60 - sinceStart) / 60)) : Math.max(1, Math.round((approach - sinceAssign) / 60));
  const fee = Math.max(0, Math.ceil((waited - trip.free_wait_sec) / 60)) * trip.wait_fee_per_min;
  const pill: React.CSSProperties = { flex: 1, border: "none", borderRadius: 12, padding: "10px 6px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 };

  return (
    <div style={{ minHeight: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ position: "relative" }}>
        <MapView mode={phase === "Started" ? "trip" : "approach"} progress={progress} motion={motion} height={320} radius={0} nearby={false} />
        <button onClick={onBack} aria-label="Back" className="press" style={{ ...iconBtn, position: "absolute", top: 16, left: 16, width: 40, height: 40, borderRadius: "50%", background: "white", justifyContent: "center", boxShadow: "var(--shadow-md)" }}><BackIcon c="var(--ink)" /></button>
        <div style={{ position: "absolute", top: 16, left: 66, right: 16, background: "var(--blue-dark)", color: "white", borderRadius: 14, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10, boxShadow: "var(--shadow-md)" }}>
          <NavIcon s={22} c="var(--gold)" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700 }}>{phase === "Arrived" ? "You've arrived" : phase === "Started" ? "Head to drop" : "Head to pickup"}</p>
            <p style={{ margin: 0, fontSize: 11.5, color: "rgba(255,255,255,0.7)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{phase === "Started" ? `${trip.to.name}, ${trip.to.address}` : `${trip.from.name}, ${trip.from.address}`}</p>
          </div>
          {phase !== "Arrived" && <span style={{ fontSize: 13, fontWeight: 800, color: "var(--gold)" }}>~{eta} min</span>}
        </div>
        <button onClick={onSos} aria-label="Emergency SOS" className="press" style={{ position: "absolute", right: 16, bottom: 32, width: 50, height: 50, borderRadius: "50%", border: "3px solid white", background: "var(--red)", color: "white", fontSize: 11, fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 14px rgba(224,49,49,0.45)" }}>SOS</button>
      </div>
      <div style={{ flex: 1, marginTop: -20, position: "relative", background: "var(--app-bg)", borderRadius: "22px 22px 0 0", padding: "8px 16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ width: 40, height: 4, borderRadius: 4, background: "var(--line-strong)", margin: "0 auto 2px" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{title}</p>
          <StatusBadge status={phase} />
        </div>
        <div style={{ ...card, padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <Avatar initials={initials(who)} size={42} tone="gold" />
            <div style={{ flex: 1 }}><p style={{ margin: 0, fontSize: 14.5, fontWeight: 700 }}>{trip.passenger?.name ?? who}</p><p style={{ margin: 0, fontSize: 12, color: "var(--ink-soft)" }}>{trip.pay} · {inr(trip.fare - trip.discount)} · {rideLabel(trip, vehicleById(trip.vehicle).name)}</p></div>
            <button onClick={onCall} disabled={!trip.customer?.phone} aria-label="Call customer" className="press" style={{ width: 42, height: 42, borderRadius: "50%", border: "none", background: "var(--blue-tint)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><PhoneIcon s={19} c="var(--blue)" /></button>
          </div>
          <RouteLines from={`${trip.from.name}, ${trip.from.address}`} to={`${trip.to.name}, ${trip.to.address}`} />
          {parcel && trip.parcel && <p style={{ margin: "10px 0 0", fontSize: 12.5, color: "var(--ink-soft)", background: "var(--gold-tint)", borderRadius: 10, padding: "8px 10px" }}>📦 {trip.parcel.type} · {trip.parcel.weight_label} · deliver to {trip.parcel.receiver.name}{trip.parcel.note ? ` · “${trip.parcel.note}”` : ""}</p>}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onNavigate} className="press" style={{ ...pill, background: "var(--blue-tint)", color: "var(--blue)" }}><NavIcon s={15} c="var(--blue)" /> Navigate</button>
          {phase !== "Started" && <button onClick={onCancel} className="press" style={{ ...pill, background: "var(--error)", color: "var(--error-text)" }}>Cancel ride</button>}
        </div>

        {phase === "Arrived" && (
          <>
            <div style={{ ...card, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
              <ClockIcon s={20} c={waited >= trip.free_wait_sec ? "var(--warning-text)" : "var(--blue)"} />
              <span style={{ flex: 1, fontSize: 13 }}>
                <b>Waiting {mmss(waited)}</b>
                <span style={{ color: "var(--ink-soft)" }}>{waited < trip.free_wait_sec ? ` · free for ${mmss(trip.free_wait_sec - waited)}` : ` · ${inr(trip.wait_fee_per_min)}/min charge`}</span>
              </span>
              {fee > 0 && <span style={{ fontSize: 13.5, fontWeight: 800, color: "var(--warning-text)" }}>+{inr(fee)}</span>}
            </div>
            <div style={{ ...card, padding: 16, textAlign: "center" }}>
              <p style={{ margin: "0 0 12px", fontSize: 13.5, fontWeight: 600 }}>{parcel ? "Ask the sender for the 4-digit pickup OTP" : "Ask the customer for their 4-digit ride OTP"}</p>
              <OtpInput value={otp} onChange={setOtp} autoFocus={false} />
            </div>
          </>
        )}
        <ErrorText msg={err} />

        <div style={{ marginTop: "auto" }}>
          {phase === "Arriving" && <PrimaryButton disabled={busy} onClick={onArrived}>{busy ? "Saving…" : "I've Arrived"}</PrimaryButton>}
          {phase === "Arrived" && <PrimaryButton disabled={busy || otp.length !== 4} onClick={() => { onStart(otp); setOtp(""); }}>{busy ? "Checking OTP…" : "Start Trip"}</PrimaryButton>}
          {phase === "Started" && <PrimaryButton tone="red" disabled={busy} onClick={onEnd}>{busy ? "Saving…" : parcel ? "Mark Delivered" : "End Trip"}</PrimaryButton>}
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Earnings ───────────────────────── */

export function EarningsScreen({ me, onBack }: { me: DriverMe; onBack?: () => void }) {
  const [range, setRange] = useState<"day" | "week" | "month">("week");
  const net = { day: me.today.earnings, week: me.earnings.week, month: me.earnings.month }[range];
  const payouts = me.txns.filter((t) => t.kind === "payout");
  return (
    <div>
      <PageHeader title="Earnings" onBack={onBack} />
      <div style={{ padding: "0 16px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
        <Tabs value={range} onChange={setRange} tabs={[{ id: "day", label: "Today" }, { id: "week", label: "This Week" }, { id: "month", label: "This Month" }]} />
        <div style={{ borderRadius: 22, padding: 18, background: "linear-gradient(150deg,var(--blue-dark),var(--blue))", color: "white", boxShadow: "0 10px 28px rgba(11,92,255,0.28)" }}>
          <p style={{ margin: 0, fontSize: 12.5, color: "rgba(255,255,255,0.75)" }}>Net earnings (after {me.commission_pct}% commission, incl. bonuses)</p>
          <p style={{ margin: "2px 0 0", fontSize: 32, fontWeight: 800 }}>{inr(net)}</p>
          {range === "week" && <p style={{ margin: "6px 0 0", fontSize: 12.5, color: "rgba(255,255,255,0.8)" }}>{me.week_trips} trips · {inr(me.earnings.incentives_week)} in bonuses</p>}
          {range === "day" && <p style={{ margin: "6px 0 0", fontSize: 12.5, color: "rgba(255,255,255,0.8)" }}>{me.today.trips} trips today</p>}
        </div>
        <p style={{ margin: "4px 2px 0", fontSize: 13.5, fontWeight: 700 }}>Payouts</p>
        {payouts.length === 0 && <p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-soft)" }}>No payouts yet. Take an instant payout from your Wallet once you have ₹{me.min_payout} or more.</p>}
        {payouts.map((p) => (
          <div key={p.id} style={{ ...card, padding: 14, display: "flex", alignItems: "center", gap: 12 }}>
            <WalletIcon s={22} c="var(--blue)" />
            <div style={{ flex: 1 }}><p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{inr(-p.amount)}</p><p style={{ margin: 0, fontSize: 12, color: "var(--ink-soft)" }}>{fmtWhen(p.at)} · {p.note}</p></div>
            <StatusBadge status="Paid" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ───────────────────────── Trips history ───────────────────────── */

export function TripsScreen({ trips, commissionPct, onOpen }: { trips: RideView[] | null; commissionPct: number; onOpen: (r: RideView) => void }) {
  const [filter, setFilter] = useState<"all" | "done" | "cancelled">("all");
  const list = trips ?? [];
  const shown = list.filter((r) => filter === "all" || (filter === "done" ? r.status === "Completed" : r.status === "Cancelled"));
  return (
    <div>
      <PageHeader title="Trip History" sub={`${list.filter((r) => r.status === "Completed").length} completed`} />
      <div style={{ padding: "0 16px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
        <Tabs value={filter} onChange={setFilter} tabs={[{ id: "all", label: "All" }, { id: "done", label: "Completed" }, { id: "cancelled", label: "Cancelled" }]} />
        {shown.length === 0 && <p style={{ textAlign: "center", color: "var(--ink-mute)", fontSize: 13.5, padding: "30px 0" }}>{trips ? "No trips here yet." : "Loading…"}</p>}
        {shown.map((r) => (
          <button key={r.id} onClick={() => onOpen(r)} className="press" style={{ ...card, border: "none", cursor: "pointer", textAlign: "left", padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)" }}>#{r.code} · {fmtWhen(r.assigned_at ?? r.created_at)}</span>
              <StatusBadge status={r.status} />
            </div>
            <RouteLines from={r.from.name} to={r.to.name} />
            <div style={{ borderTop: "1px solid var(--line)", marginTop: 10, paddingTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>{r.customer?.name ?? "Customer"} · {r.km} km · {r.pay}</span>
              <span style={{ fontSize: 15, fontWeight: 800, color: r.status === "Completed" ? "var(--ink)" : "var(--ink-mute)" }}>{r.status === "Completed" ? inr(Math.round((r.fare + r.wait_fee) * (1 - commissionPct / 100))) : "—"}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ───────────────────────── Notifications (from wallet activity) ───────────────────────── */

export function AlertsScreen({ txns, onBack }: { txns: Txn[]; onBack?: () => void }) {
  return (
    <div>
      <PageHeader title="Notifications" onBack={onBack} />
      <div style={{ padding: "0 16px 24px", display: "flex", flexDirection: "column", gap: 10 }}>
        {txns.length === 0 && <p style={{ textAlign: "center", color: "var(--ink-soft)", fontSize: 13.5 }}>Trip earnings, bonuses and payouts will show up here.</p>}
        {txns.slice(0, 20).map((t) => {
          const good = t.amount > 0;
          return (
            <div key={t.id} style={{ ...card, padding: 14, display: "flex", gap: 12, alignItems: "center" }}>
              <span style={{ width: 42, height: 42, borderRadius: 12, background: t.kind === "incentive" ? "var(--purple-tint)" : good ? "var(--success)" : "var(--bg-secondary)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {t.kind === "incentive" ? <GiftIcon s={20} c="var(--purple)" /> : good ? <CheckIcon s={20} c="var(--success-text)" /> : <AlertIcon s={20} c="var(--ink-soft)" />}
              </span>
              <div style={{ flex: 1 }}><p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{t.note ?? t.kind}</p><p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--ink-mute)" }}>{fmtWhen(t.at)}</p></div>
              <span style={{ fontWeight: 700, color: good ? "var(--success-text)" : "var(--ink)", whiteSpace: "nowrap" }}>{good ? "+ " : "− "}{inr(Math.abs(t.amount))}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ───────────────────────── Account ───────────────────────── */

export type AccountKey = "documents" | "vehicle" | "bank" | "preferences" | "performance" | "help";

const MENU: { k: AccountKey; label: string; Icon: typeof HelpIcon }[] = [
  { k: "performance", label: "Ratings & Performance", Icon: ShieldIcon },
  { k: "documents", label: "Documents", Icon: DocIcon },
  { k: "vehicle", label: "Vehicle details", Icon: SteeringIcon },
  { k: "bank", label: "UPI for payouts", Icon: WalletIcon },
  { k: "preferences", label: "Ride preferences", Icon: GearIcon },
  { k: "help", label: "Help & Support", Icon: HelpIcon },
];

export const rates = (me: DriverMe) => {
  const offered = me.offers_accepted + me.offers_declined;
  return {
    acceptance: offered ? Math.round((me.offers_accepted / offered) * 100) : 100,
    cancellation: me.offers_accepted ? Math.round((me.cancellations / me.offers_accepted) * 100) : 0,
  };
};

export function RiderAccount({ me, onMenu, onLogout }: { me: DriverMe; onMenu: (k: AccountKey) => void; onLogout: () => void }) {
  const r = rates(me);
  return (
    <div style={{ paddingBottom: 12 }}>
      <PageHeader title="My Account" />
      <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ ...card, padding: "18px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Avatar initials={initials(me.name)} size={58} />
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 19, fontWeight: 700 }}>{me.name}</p>
              <p style={{ margin: "1px 0 0", fontSize: 12.5, color: "var(--text-muted)" }}>{me.phone ? `+${me.phone}` : ""}</p>
              <p style={{ margin: "1px 0 0", fontSize: 12.5, color: "var(--text-muted)" }}>{me.city}</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            {me.kyc === "Approved" && !me.suspended && <span style={{ background: "var(--green)", color: "white", fontSize: 11, fontWeight: 600, padding: "5px 11px", borderRadius: 6 }}>✓ VERIFIED RIDER</span>}
            {me.suspended && <StatusBadge status="Suspended" />}
            <span style={{ background: "var(--gold-tint)", color: "var(--gold-dark)", fontSize: 11, fontWeight: 700, padding: "5px 11px", borderRadius: 6 }}>★ {me.rating ?? "New"}</span>
          </div>
        </div>
        <div style={{ ...card, padding: "14px 16px", display: "flex" }}>
          {[[me.trips.toLocaleString("en-IN"), "Trips"], [`${r.acceptance}%`, "Acceptance"], [`${r.cancellation}%`, "Cancellation"]].map(([v, l], i) => (
            <div key={l} style={{ flex: 1, textAlign: "center", borderRight: i < 2 ? "1px solid var(--border)" : "none" }}>
              <p style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{v}</p><p style={{ margin: "2px 0 0", fontSize: 11.5, color: "var(--text-muted)" }}>{l}</p>
            </div>
          ))}
        </div>
        <div style={{ ...card, padding: "0 14px" }}>
          {MENU.map(({ k, label: l, Icon }, i) => (
            <button key={k} onClick={() => onMenu(k)} className="press" style={{ width: "100%", display: "flex", alignItems: "center", gap: 14, padding: "14px 0", background: "none", border: "none", borderTop: i ? "1px solid var(--line)" : "none", cursor: "pointer", textAlign: "left" }}>
              <Icon s={21} c="var(--text-muted)" w={1.6} /><span style={{ flex: 1, fontSize: 14.5, fontWeight: 500, color: "var(--text-secondary)" }}>{l}</span><ChevronRight s={16} c="var(--ink-mute)" />
            </button>
          ))}
        </div>
        <button onClick={onLogout} className="press" style={{ width: "100%", background: "var(--surface)", color: "var(--red)", border: "none", borderRadius: 16, padding: 15, fontSize: 15, fontWeight: 600, cursor: "pointer" }}>Log Out</button>
        <p style={{ textAlign: "center", fontSize: 11.5, color: "var(--text-disabled)", margin: "0 0 12px" }}>DriveWay Rider v2.0.0</p>
      </div>
    </div>
  );
}
