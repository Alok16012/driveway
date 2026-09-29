"use client";

import { useEffect, useState } from "react";
import {
  AlertIcon, BackIcon, BellIcon, BoltIcon, CheckIcon, ChevronRight, ClockIcon, DocIcon, GearIcon, GiftIcon, HelpIcon, HomeIcon,
  NavIcon, PhoneIcon, RupeeIcon, ShieldIcon, SteeringIcon, UsersIcon, WalletIcon,
} from "../icons";
import { BrandMark, Wordmark } from "../Brand";
import MapView from "../MapView";
import VehicleArt from "../VehicleArt";
import { Avatar, OtpInput, PageHeader, PrimaryButton, Stars, StatusBadge, Tabs, Toggle, card, iconBtn } from "../ui";
import { HOTSPOTS, INCENTIVES, inr, vehicleById, WEEK, type Driver, type Ride } from "../../lib/data";

/** Platform commission on every fare. */
export const COMMISSION = 0.2;

export interface RideRequest {
  id: string; customer: string; initials: string; rating: number;
  from: string; to: string; pickupKm: number; pickupMin: number; km: number; min: number; fare: number; pay: "Cash" | "UPI";
  waitFee?: number;   // added when the customer keeps the rider waiting past the free window
}

const dotStyle = (c: string, sq = false): React.CSSProperties => ({ width: 9, height: 9, borderRadius: sq ? 2 : "50%", background: c, flexShrink: 0 });

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

export type QuickKey = "wallet" | "incentives" | "performance" | "hotspots";

const QUICK: { k: QuickKey; label: string; Icon: typeof WalletIcon; c: string; bg: string }[] = [
  { k: "wallet", label: "Wallet", Icon: WalletIcon, c: "var(--blue)", bg: "var(--blue-tint)" },
  { k: "incentives", label: "Incentives", Icon: GiftIcon, c: "var(--gold-dark)", bg: "var(--gold-tint)" },
  { k: "performance", label: "Ratings", Icon: StarOutline, c: "var(--purple)", bg: "var(--purple-tint)" },
  { k: "hotspots", label: "Hotspots", Icon: BoltIcon, c: "var(--red)", bg: "var(--error)" },
];

function StarOutline(p: { s?: number; c?: string }) {
  return <svg width={p.s ?? 22} height={p.s ?? 22} viewBox="0 0 24 24" fill="none" stroke={p.c ?? "currentColor"} strokeWidth={1.8} strokeLinejoin="round" aria-hidden="true"><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5-4.8-4.6 6.6-.9z" /></svg>;
}

export function RiderHome({ rider, online, onToggle, today, wallet, goHome, onOpenEarnings, onAlerts, onQuick, onClearGoHome, unread }: {
  rider: Driver; online: boolean; onToggle: (v: boolean) => void;
  today: { earnings: number; trips: number; minutes: number }; wallet: number; goHome: string | null;
  onOpenEarnings: () => void; onAlerts: () => void; onQuick: (k: QuickKey) => void; onClearGoHome: () => void; unread: number;
}) {
  const h = Math.floor(today.minutes / 60), m = today.minutes % 60;
  const daily = INCENTIVES[0];
  return (
    <div style={{ paddingBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px 10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}><BrandMark size={34} /><Wordmark sub="RIDER · DRIVE · EARN" /></div>
        <button aria-label="Notifications" onClick={onAlerts} className="press" style={iconBtn}>
          <BellIcon s={25} c="var(--text-secondary)" w={1.7} />
          {unread > 0 && <span style={{ position: "absolute", top: 1, right: 2, width: 8, height: 8, borderRadius: "50%", background: "var(--red)", border: "1.5px solid var(--app-bg)" }} />}
        </button>
      </div>

      {/* online switch */}
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
            <span style={{ display: "block", fontSize: 17, fontWeight: 700 }}>{online ? "You're Online" : "You're Offline"}</span>
            <span style={{ display: "block", fontSize: 12.5, opacity: 0.8 }}>{online ? (goHome ? "Only rides towards home…" : "Looking for ride requests nearby…") : "Go online to start receiving rides"}</span>
          </span>
          <Toggle on={online} onChange={onToggle} label="Go online" />
        </div>
      </div>

      {goHome && (
        <div style={{ padding: "10px 16px 0" }}>
          <div style={{ ...card, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10, border: "1px solid var(--blue-ghost)" }}>
            <HomeIcon s={20} c="var(--blue)" />
            <span style={{ flex: 1, fontSize: 12.5, minWidth: 0 }}><b>Go Home on</b> · <span style={{ color: "var(--ink-soft)" }}>{goHome}</span></span>
            <button onClick={onClearGoHome} style={{ background: "none", border: "none", color: "var(--red)", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>Turn off</button>
          </div>
        </div>
      )}

      <div style={{ padding: "14px 16px 0" }}>
        <MapView height={200} radius={22} nearby={false}>
          <div style={{ position: "absolute", top: 12, left: 12, display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.95)", borderRadius: 999, padding: "6px 12px 6px 8px", boxShadow: "var(--shadow-md)" }}>
            <NavIcon s={14} c="var(--blue)" />
            <span style={{ fontSize: 12, fontWeight: 600 }}>GPS · Sector 12, Noida</span>
          </div>
          {online && <button onClick={() => onQuick("hotspots")} style={{ position: "absolute", right: 12, bottom: 12, background: "var(--ink)", color: "white", border: "none", cursor: "pointer", borderRadius: 999, padding: "5px 11px", fontSize: 11.5, fontWeight: 600 }}>🔥 {HOTSPOTS[0].surge}x demand · {HOTSPOTS[0].km} km away</button>}
        </MapView>
      </div>

      {/* quick actions */}
      <div style={{ padding: "14px 16px 0", display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
        {QUICK.map(({ k, label: l, Icon, c, bg }) => (
          <button key={k} onClick={() => onQuick(k)} className="press" style={{ ...card, border: "none", cursor: "pointer", padding: "12px 4px 10px", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <span style={{ width: 38, height: 38, borderRadius: 12, background: bg, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon s={20} c={c} /></span>
            <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--ink)" }}>{k === "wallet" ? inr(wallet) : l}</span>
          </button>
        ))}
      </div>

      {/* today */}
      <div style={{ padding: "18px 16px 0", display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div>
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-soft)", fontWeight: 500 }}>Today</p>
          <p style={{ margin: 0, fontSize: 19, fontWeight: 700 }}>Your Summary</p>
        </div>
        <button onClick={onOpenEarnings} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--blue)", fontSize: 13.5, fontWeight: 600 }}>Earnings →</button>
      </div>
      <div style={{ padding: "12px 16px 0", display: "grid", gridTemplateColumns: "1.3fr 1fr 1fr", gap: 10 }}>
        <div style={{ borderRadius: 18, padding: "14px 12px", background: "linear-gradient(150deg,var(--blue-dark),var(--blue))", color: "white", boxShadow: "0 10px 24px rgba(11,92,255,0.25)" }}>
          <RupeeIcon s={20} c="var(--gold)" />
          <p style={{ margin: "8px 0 0", fontSize: 21, fontWeight: 800 }}>{inr(today.earnings)}</p>
          <p style={{ margin: 0, fontSize: 11.5, color: "rgba(255,255,255,0.75)" }}>Earnings</p>
        </div>
        {[[String(today.trips), "Trips", CheckIcon], [`${h}h ${m}m`, "Online", ClockIcon]].map(([v, l, I]) => {
          const Icon = I as typeof CheckIcon;
          return (
            <div key={l as string} style={{ ...card, padding: "14px 12px" }}>
              <Icon s={20} c="var(--blue)" />
              <p style={{ margin: "8px 0 0", fontSize: 19, fontWeight: 800 }}>{v as string}</p>
              <p style={{ margin: 0, fontSize: 11.5, color: "var(--ink-soft)" }}>{l as string}</p>
            </div>
          );
        })}
      </div>

      <div style={{ padding: "14px 16px 0" }}>
        <button onClick={() => onQuick("incentives")} className="press" style={{ ...card, width: "100%", cursor: "pointer", textAlign: "left", padding: 14, display: "flex", alignItems: "center", gap: 12, border: "1px solid var(--line)" }}>
          <span style={{ width: 48, height: 48, borderRadius: 14, flexShrink: 0, background: "linear-gradient(135deg,var(--gold),var(--gold-dark))", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(245,166,35,0.3)" }}><GiftIcon s={24} c="white" w={2} /></span>
          <span style={{ flex: 1 }}>
            <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: "var(--ink)" }}>
              {today.trips >= daily.target ? `🎉 ${inr(daily.reward)} bonus unlocked!` : `Bonus: ${daily.target - today.trips} more trips → ${inr(daily.reward)}`}
            </span>
            <span style={{ display: "block", height: 6, borderRadius: 3, background: "var(--line)", margin: "6px 0 0" }}>
              <span style={{ display: "block", width: `${Math.min(100, (today.trips / daily.target) * 100)}%`, height: "100%", borderRadius: 3, background: "var(--gold)", transition: "width 0.4s" }} />
            </span>
          </span>
          <ChevronRight s={16} c="var(--ink-mute)" />
        </button>
      </div>

      <div style={{ padding: "14px 16px 0" }}>
        <div style={{ ...card, padding: 14, display: "flex", alignItems: "center", gap: 12 }}>
          <VehicleArt kind={rider.vehicle} size={60} />
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{rider.model}</p>
            <p style={{ margin: "1px 0 0", fontSize: 12, color: "var(--ink-soft)" }}>{vehicleById(rider.vehicle).name} · {rider.plate}</p>
          </div>
          <StatusBadge status={rider.kyc} />
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Incoming request popup ───────────────────────── */

export const REQUEST_SECONDS = 15;

export function RequestPopup({ req, autoAccept, towardsHome, onAccept, onDecline }: {
  req: RideRequest; autoAccept?: boolean; towardsHome?: boolean; onAccept: () => void; onDecline: (expired: boolean) => void;
}) {
  const [left, setLeft] = useState(REQUEST_SECONDS);
  useEffect(() => {
    if (left <= 0) { onDecline(true); return; }
    if (autoAccept && left <= REQUEST_SECONDS - 3) { onAccept(); return; }
    const t = setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => clearTimeout(t);
  }, [left, autoAccept, onAccept, onDecline]);

  const net = req.fare * (1 - COMMISSION);
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 150, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <div className="fade-up" style={{ position: "absolute", inset: 0, background: "rgba(15,23,41,0.5)" }} />
      <div className="slide-up" style={{ position: "relative", background: "var(--app-bg)", borderRadius: "24px 24px 0 0", padding: "16px 16px calc(18px + env(safe-area-inset-bottom))", maxHeight: "94%", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>New Ride Request</p>
            <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
              {towardsHome && <span style={{ background: "var(--blue-tint)", color: "var(--blue)", fontSize: 10.5, fontWeight: 700, padding: "3px 8px", borderRadius: 6 }}>🏠 TOWARDS HOME</span>}
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
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 12 }}>
          {[[inr(req.fare), `${req.pay} · you get ${inr(net)}`], [`${req.pickupKm} km`, `${req.pickupMin} min to pickup`], [`${req.km} km`, `~${req.min} min trip`]].map(([v, l]) => (
            <div key={l} style={{ ...card, padding: "10px 8px", textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{v}</p>
              <p style={{ margin: 0, fontSize: 10.5, color: "var(--ink-soft)" }}>{l}</p>
            </div>
          ))}
        </div>
        <div style={{ ...card, padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <Avatar initials={req.initials} size={36} tone="gold" />
            <div style={{ flex: 1 }}><p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{req.customer}</p><p style={{ margin: 0, fontSize: 11.5, color: "var(--ink-soft)" }}>★ {req.rating} customer</p></div>
          </div>
          <RouteLines from={req.from} to={req.to} />
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <PrimaryButton tone="ghost" onClick={() => onDecline(false)} style={{ flex: 1, color: "var(--red)" }}>Decline</PrimaryButton>
          <PrimaryButton onClick={onAccept} style={{ flex: 2, background: "linear-gradient(135deg,#34c38f,var(--green))", boxShadow: "0 6px 16px rgba(47,158,118,0.35)" }}>Accept Ride</PrimaryButton>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Trip management ───────────────────────── */

export type TripPhase = "toPickup" | "arrived" | "onTrip" | "collect" | "rate";

/** Free waiting time at pickup, then a per-minute fee (PRD §6 fare rules). */
export const FREE_WAIT_SEC = 180;
export const WAIT_FEE_PER_MIN = 2;
export const waitFeeFor = (sec: number) => Math.max(0, Math.ceil((sec - FREE_WAIT_SEC) / 60)) * WAIT_FEE_PER_MIN;
const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

export function TripPage({ req, phase, progress, onArrived, onStart, onEnd, onCollected, onRated, onBack, onCall, onCancel, onSos, onNavigate }: {
  req: RideRequest; phase: TripPhase; progress: number;
  onArrived: () => void; onStart: (waitFee: number) => void; onEnd: () => void; onCollected: () => void; onRated: (n: number) => void;
  onBack: () => void; onCall: () => void; onCancel: () => void; onSos: () => void; onNavigate: () => void;
}) {
  const [otp, setOtp] = useState("");
  const [otpErr, setOtpErr] = useState(false);
  const [stars, setStars] = useState(0);
  const [waited, setWaited] = useState(0);

  // Waiting clock at pickup.
  useEffect(() => {
    if (phase !== "arrived") return;
    const t = setInterval(() => setWaited((w) => w + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  if (phase === "collect" || phase === "rate") {
    const wait = req.waitFee ?? 0;
    const total = req.fare + wait;
    return (
      <div style={{ minHeight: "100%", display: "flex", flexDirection: "column", padding: "34px 16px 20px" }}>
        <div style={{ textAlign: "center" }}>
          <div className="fade-up" style={{ width: 76, height: 76, margin: "0 auto", borderRadius: "50%", background: "linear-gradient(135deg,#34c38f,var(--green))", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 10px 24px rgba(47,158,118,0.35)" }}><CheckIcon s={38} c="white" w={3} /></div>
          <p style={{ margin: "14px 0 0", fontSize: 22, fontWeight: 800 }}>Trip Completed</p>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--ink-soft)" }}>{req.km} km · {req.min} min · #{req.id}</p>
          <p style={{ margin: "14px 0 0", fontSize: 38, fontWeight: 800 }}>{inr(total)}</p>
          <p style={{ margin: "2px 0 0", fontSize: 13, fontWeight: 600, color: phase === "rate" || req.pay !== "Cash" ? "var(--success-text)" : "var(--warning-text)" }}>
            {req.pay === "Cash" ? (phase === "rate" ? "✓ Cash collected" : `Collect ${inr(total)} in cash`) : "✓ Paid online via UPI"}
          </p>
        </div>
        <div style={{ ...card, padding: "12px 16px", marginTop: 18 }}>
          {([["Trip fare", inr(req.fare)], wait ? ["Waiting charge", inr(wait)] : null, [`Platform commission (${COMMISSION * 100}%)`, "− " + inr(total * COMMISSION)]].filter(Boolean) as string[][]).map(([l, v]) => (
            <div key={l} style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, color: "var(--ink-soft)", padding: "4px 0" }}><span>{l}</span><span>{v}</span></div>
          ))}
          <div style={{ borderTop: "1px dashed var(--line-strong)", margin: "6px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 700, padding: "4px 0" }}><span>You earn</span><span style={{ color: "var(--success-text)" }}>{inr(total * (1 - COMMISSION))}</span></div>
          {req.pay === "Cash" && <p style={{ margin: "6px 0 0", fontSize: 11.5, color: "var(--ink-mute)", lineHeight: 1.45 }}>You keep the cash. The {inr(total * COMMISSION)} commission is added to your wallet dues.</p>}
        </div>
        {phase === "rate" && (
          <div className="fade-up" style={{ ...card, padding: 16, marginTop: 12, textAlign: "center" }}>
            <p style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 700 }}>Rate {req.customer}</p>
            <Stars value={stars} onChange={setStars} />
          </div>
        )}
        <div style={{ marginTop: "auto", paddingTop: 20 }}>
          {phase === "collect"
            ? <PrimaryButton onClick={onCollected}>{req.pay === "Cash" ? "Cash Collected" : "Continue"}</PrimaryButton>
            : <PrimaryButton onClick={() => onRated(stars)}>{stars ? "Submit & Go Online" : "Skip & Go Online"}</PrimaryButton>}
        </div>
      </div>
    );
  }

  const title = { toPickup: "On the way to pickup", arrived: "Waiting for customer", onTrip: "Trip in progress" }[phase];
  const eta = phase === "onTrip" ? Math.max(1, Math.round(req.min * (1 - progress))) : Math.max(1, Math.round(req.pickupMin * (1 - progress)));
  const fee = waitFeeFor(waited);
  const pill: React.CSSProperties = { flex: 1, border: "none", borderRadius: 12, padding: "10px 6px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 };

  return (
    <div style={{ minHeight: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ position: "relative" }}>
        <MapView mode={phase === "onTrip" ? "trip" : "approach"} progress={phase === "arrived" ? 1 : progress} height={320} radius={0} nearby={false} />
        <button onClick={onBack} aria-label="Back" className="press" style={{ ...iconBtn, position: "absolute", top: 16, left: 16, width: 40, height: 40, borderRadius: "50%", background: "white", justifyContent: "center", boxShadow: "var(--shadow-md)" }}><BackIcon c="var(--ink)" /></button>
        <div style={{ position: "absolute", top: 16, left: 66, right: 16, background: "var(--blue-dark)", color: "white", borderRadius: 14, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10, boxShadow: "var(--shadow-md)" }}>
          <NavIcon s={22} c="var(--gold)" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700 }}>{phase === "arrived" ? "You've arrived" : phase === "onTrip" ? "Head north-east on NH 24" : "Turn right on Sector 12 Rd"}</p>
            <p style={{ margin: 0, fontSize: 11.5, color: "rgba(255,255,255,0.7)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{phase === "onTrip" ? req.to : req.from}</p>
          </div>
          {phase !== "arrived" && <span style={{ fontSize: 13, fontWeight: 800, color: "var(--gold)" }}>{eta} min</span>}
        </div>
        <button onClick={onSos} aria-label="Emergency SOS" className="press" style={{ position: "absolute", right: 16, bottom: 32, width: 50, height: 50, borderRadius: "50%", border: "3px solid white", background: "var(--red)", color: "white", fontSize: 12, fontWeight: 800, cursor: "pointer", boxShadow: "0 6px 16px rgba(224,49,49,0.4)" }}>SOS</button>
      </div>
      <div style={{ flex: 1, marginTop: -20, position: "relative", background: "var(--app-bg)", borderRadius: "22px 22px 0 0", padding: "8px 16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ width: 40, height: 4, borderRadius: 4, background: "var(--line-strong)", margin: "0 auto 2px" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{title}</p>
          <StatusBadge status={phase === "onTrip" ? "Started" : phase === "arrived" ? "Arrived" : "Arriving"} />
        </div>
        <div style={{ ...card, padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <Avatar initials={req.initials} size={42} tone="gold" />
            <div style={{ flex: 1 }}><p style={{ margin: 0, fontSize: 14.5, fontWeight: 700 }}>{req.customer}</p><p style={{ margin: 0, fontSize: 12, color: "var(--ink-soft)" }}>★ {req.rating} · {req.pay} · {inr(req.fare)}</p></div>
            <button onClick={onCall} aria-label="Call customer" className="press" style={{ width: 42, height: 42, borderRadius: "50%", border: "none", background: "var(--blue-tint)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><PhoneIcon s={19} c="var(--blue)" /></button>
          </div>
          <RouteLines from={req.from} to={req.to} />
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onNavigate} className="press" style={{ ...pill, background: "var(--blue-tint)", color: "var(--blue)" }}><NavIcon s={15} c="var(--blue)" /> Navigate</button>
          {phase !== "onTrip" && <button onClick={onCancel} className="press" style={{ ...pill, background: "var(--error)", color: "var(--error-text)" }}>Cancel ride</button>}
        </div>

        {phase === "arrived" && (
          <>
            <div style={{ ...card, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
              <ClockIcon s={20} c={waited >= FREE_WAIT_SEC ? "var(--warning-text)" : "var(--blue)"} />
              <span style={{ flex: 1, fontSize: 13 }}>
                <b>Waiting {mmss(waited)}</b>
                <span style={{ color: "var(--ink-soft)" }}>{waited < FREE_WAIT_SEC ? ` · free for ${mmss(FREE_WAIT_SEC - waited)}` : ` · ${inr(WAIT_FEE_PER_MIN)}/min charge`}</span>
              </span>
              {fee > 0 ? <span style={{ fontSize: 13.5, fontWeight: 800, color: "var(--warning-text)" }}>+{inr(fee)}</span>
                : <button onClick={() => setWaited(FREE_WAIT_SEC + 55)} style={{ background: "none", border: "1px dashed var(--line-strong)", borderRadius: 8, padding: "3px 8px", fontSize: 10.5, color: "var(--ink-mute)", cursor: "pointer" }}>Demo: skip 3 min</button>}
            </div>
            <div style={{ ...card, padding: 16, textAlign: "center" }}>
              <p style={{ margin: "0 0 12px", fontSize: 13.5, fontWeight: 600 }}>Ask the customer for their 4-digit ride OTP</p>
              <OtpInput value={otp} onChange={(v) => { setOtp(v); setOtpErr(false); }} />
              {otpErr && <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--error-text)" }}>Enter all 4 digits</p>}
              <p style={{ margin: "8px 0 0", fontSize: 11, color: "var(--ink-mute)" }}>Demo: any 4 digits</p>
            </div>
          </>
        )}

        <div style={{ marginTop: "auto" }}>
          {phase === "toPickup" && <PrimaryButton onClick={onArrived}>{progress >= 1 ? "I've Arrived" : "Mark Arrived"}</PrimaryButton>}
          {phase === "arrived" && <PrimaryButton onClick={() => (otp.length === 4 ? onStart(fee) : setOtpErr(true))}>Start Trip</PrimaryButton>}
          {phase === "onTrip" && <PrimaryButton tone="red" onClick={onEnd}>End Trip</PrimaryButton>}
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Earnings ───────────────────────── */

export function EarningsScreen({ today, onBack }: { today: { earnings: number; trips: number; minutes: number }; onBack?: () => void }) {
  const [range, setRange] = useState<"day" | "week" | "month">("week");
  const gross = { day: today.earnings / (1 - COMMISSION), week: 18420, month: 74860 }[range];
  const trips = { day: today.trips, week: 92, month: 371 }[range];
  const commission = gross * COMMISSION;
  const bars = range === "day"
    ? ["6a", "9a", "12p", "3p", "6p", "9p"].map((d, i) => ({ d, v: [0.2, 0.7, 0.4, 0.5, 0.9, 0.6][i] }))
    : WEEK.map((w) => ({ d: w.d, v: w.revenue / 320000 }));
  return (
    <div>
      <PageHeader title="Earnings" onBack={onBack} />
      <div style={{ padding: "0 16px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
        <Tabs value={range} onChange={setRange} tabs={[{ id: "day", label: "Today" }, { id: "week", label: "This Week" }, { id: "month", label: "This Month" }]} />
        <div style={{ borderRadius: 22, padding: 18, background: "linear-gradient(150deg,var(--blue-dark),var(--blue))", color: "white", boxShadow: "0 10px 28px rgba(11,92,255,0.28)", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", right: -50, top: -60, width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, rgba(245,166,35,0.3), transparent 70%)" }} />
          <p style={{ margin: 0, fontSize: 12.5, color: "rgba(255,255,255,0.75)" }}>Net earnings</p>
          <p style={{ margin: "2px 0 0", fontSize: 32, fontWeight: 800 }}>{inr(gross - commission)}</p>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 90, marginTop: 14 }}>
            {bars.map((b, i) => (
              <div key={b.d} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, height: "100%", justifyContent: "flex-end" }}>
                <div style={{ width: "100%", maxWidth: 26, height: `${Math.max(6, b.v * 100)}%`, borderRadius: 6, background: i === bars.length - 1 ? "var(--gold)" : "rgba(255,255,255,0.35)" }} />
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.7)" }}>{b.d}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ ...card, padding: "14px 16px", display: "flex" }}>
          {[[String(trips), "Trips"], [inr(gross / Math.max(1, trips)), "Per trip"], [range === "day" ? `${Math.floor(today.minutes / 60)}h` : range === "week" ? "41h" : "168h", "Online"]].map(([v, l], i) => (
            <div key={l} style={{ flex: 1, textAlign: "center", borderRight: i < 2 ? "1px solid var(--border)" : "none" }}>
              <p style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{v}</p><p style={{ margin: "2px 0 0", fontSize: 11.5, color: "var(--text-muted)" }}>{l}</p>
            </div>
          ))}
        </div>
        <div style={{ ...card, padding: "12px 16px" }}>
          <p style={{ margin: "0 0 6px", fontSize: 13.5, fontWeight: 700 }}>Breakdown</p>
          {[["Gross fares", inr(gross)], [`Platform commission (${COMMISSION * 100}%)`, "− " + inr(commission)], ["Incentives & bonus", inr(range === "day" ? 0 : range === "week" ? 500 : 2000)]].map(([l, v]) => (
            <div key={l} style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, color: "var(--ink-soft)", padding: "4px 0" }}><span>{l}</span><span>{v}</span></div>
          ))}
          <div style={{ borderTop: "1px dashed var(--line-strong)", margin: "6px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 700, padding: "4px 0" }}><span>Net payable</span><span>{inr(gross - commission + (range === "day" ? 0 : range === "week" ? 500 : 2000))}</span></div>
        </div>
        <p style={{ margin: "4px 2px 0", fontSize: 13.5, fontWeight: 700 }}>Payouts</p>
        {[["22 Sep 2026", 12840, "Paid"], ["15 Sep 2026", 14120, "Paid"], ["29 Sep 2026", 16200, "Pending"]].reverse().map(([d, a, s]) => (
          <div key={d as string} style={{ ...card, padding: 14, display: "flex", alignItems: "center", gap: 12 }}>
            <WalletIcon s={22} c="var(--blue)" />
            <div style={{ flex: 1 }}><p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{inr(a as number)}</p><p style={{ margin: 0, fontSize: 12, color: "var(--ink-soft)" }}>{s === "Paid" ? "Settled" : "Scheduled"} · {d as string} · HDFC ••4521</p></div>
            <StatusBadge status={s as string} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ───────────────────────── Trips history ───────────────────────── */

export function TripsScreen({ trips, onOpen }: { trips: Ride[]; onOpen: (r: Ride) => void }) {
  const [filter, setFilter] = useState<"all" | "done" | "cancelled">("all");
  const shown = trips.filter((r) => filter === "all" || (filter === "done" ? r.status === "Completed" : r.status === "Cancelled"));
  return (
    <div>
      <PageHeader title="Trip History" sub={`${trips.filter((r) => r.status === "Completed").length} completed · ${trips.filter((r) => r.status === "Cancelled").length} cancelled`} />
      <div style={{ padding: "0 16px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
        <Tabs value={filter} onChange={setFilter} tabs={[{ id: "all", label: "All" }, { id: "done", label: "Completed" }, { id: "cancelled", label: "Cancelled" }]} />
        {shown.length === 0 && <p style={{ textAlign: "center", color: "var(--ink-mute)", fontSize: 13.5, padding: "30px 0" }}>No trips here yet.</p>}
        {shown.map((r) => (
          <button key={r.id} onClick={() => onOpen(r)} className="press" style={{ ...card, border: "none", cursor: "pointer", textAlign: "left", padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)" }}>#{r.id} · {r.date}, {r.time}</span>
              <StatusBadge status={r.status} />
            </div>
            <RouteLines from={r.from} to={r.to} />
            <div style={{ borderTop: "1px solid var(--line)", marginTop: 10, paddingTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>{r.customer} · {r.km} km · {r.pay}</span>
              <span style={{ fontSize: 15, fontWeight: 800, color: r.status === "Cancelled" ? "var(--ink-mute)" : "var(--ink)" }}>{r.status === "Cancelled" ? "—" : inr(r.fare * (1 - COMMISSION))}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ───────────────────────── Notifications ───────────────────────── */

export type RiderAlert = [string, string, string, "ride" | "pay" | "policy" | "bonus"];

export const RIDER_ALERTS: RiderAlert[] = [
  ["New Ride Request", "Sector 12 → DLF Mall · ₹160", "2 min ago", "ride"],
  ["Trip Completed", "₹128 credited to your wallet", "12 min ago", "pay"],
  ["Policy Update", "New safety guidelines for night rides", "1 hour ago", "policy"],
  ["Bonus Offer", "Complete 5 rides today & get ₹500", "3 hours ago", "bonus"],
];

export function AlertsScreen({ items, onBack }: { items: RiderAlert[]; onBack?: () => void }) {
  const icon = { ride: [AlertIcon, "var(--gold-dark)", "var(--gold-tint)"], pay: [CheckIcon, "var(--success-text)", "var(--success)"], policy: [ShieldIcon, "var(--blue)", "var(--blue-tint)"], bonus: [GiftIcon, "var(--purple)", "var(--purple-tint)"] } as const;
  return (
    <div>
      <PageHeader title="Notifications" onBack={onBack} />
      <div style={{ padding: "0 16px 24px", display: "flex", flexDirection: "column", gap: 10 }}>
        {items.map(([t, b, w, k], i) => {
          const [I, c, bg] = icon[k];
          return (
            <div key={i} style={{ ...card, padding: 14, display: "flex", gap: 12, alignItems: "center" }}>
              <span style={{ width: 42, height: 42, borderRadius: 12, background: bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><I s={20} c={c} /></span>
              <div style={{ flex: 1 }}><p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{t}</p><p style={{ margin: "1px 0 0", fontSize: 12.5, color: "var(--ink-soft)" }}>{b}</p><p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--ink-mute)" }}>{w}</p></div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ───────────────────────── Account ───────────────────────── */

export type AccountKey = "documents" | "vehicle" | "bank" | "preferences" | "performance" | "refer" | "help";

const MENU: { k: AccountKey; label: string; Icon: typeof HelpIcon }[] = [
  { k: "performance", label: "Ratings & Performance", Icon: ShieldIcon },
  { k: "documents", label: "Documents", Icon: DocIcon },
  { k: "vehicle", label: "Vehicle details", Icon: SteeringIcon },
  { k: "bank", label: "Bank & UPI details", Icon: WalletIcon },
  { k: "preferences", label: "Ride preferences", Icon: GearIcon },
  { k: "refer", label: "Refer & Earn", Icon: UsersIcon },
  { k: "help", label: "Help & Support", Icon: HelpIcon },
];

export function RiderAccount({ rider, stats, onMenu, onLogout }: {
  rider: Driver; stats: { acceptance: number; cancellation: number }; onMenu: (k: AccountKey) => void; onLogout: () => void;
}) {
  return (
    <div style={{ paddingBottom: 12 }}>
      <PageHeader title="My Account" />
      <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ ...card, padding: "18px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Avatar initials={rider.initials} size={58} />
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 19, fontWeight: 700 }}>{rider.name}</p>
              <p style={{ margin: "1px 0 0", fontSize: 12.5, color: "var(--text-muted)" }}>{rider.phone}</p>
              <p style={{ margin: "1px 0 0", fontSize: 12.5, color: "var(--text-muted)" }}>Rider ID {rider.id} · {rider.city}</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <span style={{ background: "var(--green)", color: "white", fontSize: 11, fontWeight: 600, padding: "5px 11px", borderRadius: 6 }}>✓ VERIFIED RIDER</span>
            <span style={{ background: "var(--gold-tint)", color: "var(--gold-dark)", fontSize: 11, fontWeight: 700, padding: "5px 11px", borderRadius: 6 }}>★ {rider.rating || "New"}</span>
          </div>
        </div>
        <div style={{ ...card, padding: "14px 16px", display: "flex" }}>
          {[[rider.trips.toLocaleString("en-IN"), "Trips"], [`${stats.acceptance}%`, "Acceptance"], [`${stats.cancellation}%`, "Cancellation"]].map(([v, l], i) => (
            <div key={l} style={{ flex: 1, textAlign: "center", borderRight: i < 2 ? "1px solid var(--border)" : "none" }}>
              <p style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{v}</p><p style={{ margin: "2px 0 0", fontSize: 11.5, color: "var(--text-muted)" }}>{l}</p>
            </div>
          ))}
        </div>
        <div style={{ ...card, padding: 14, display: "flex", alignItems: "center", gap: 12 }}>
          <VehicleArt kind={rider.vehicle} size={60} />
          <div style={{ flex: 1 }}><p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{rider.model}</p><p style={{ margin: 0, fontSize: 12, color: "var(--ink-soft)" }}>{vehicleById(rider.vehicle).name} · {rider.plate}</p></div>
        </div>
        <div style={{ ...card, padding: "0 14px" }}>
          {MENU.map(({ k, label: l, Icon }, i) => (
            <button key={k} onClick={() => onMenu(k)} className="press" style={{ width: "100%", display: "flex", alignItems: "center", gap: 14, padding: "14px 0", background: "none", border: "none", borderTop: i ? "1px solid var(--line)" : "none", cursor: "pointer", textAlign: "left" }}>
              <Icon s={21} c="var(--text-muted)" w={1.6} /><span style={{ flex: 1, fontSize: 14.5, fontWeight: 500, color: "var(--text-secondary)" }}>{l}</span><ChevronRight s={16} c="var(--ink-mute)" />
            </button>
          ))}
        </div>
        <button onClick={onLogout} className="press" style={{ width: "100%", background: "var(--surface)", color: "var(--red)", border: "none", borderRadius: 16, padding: 15, fontSize: 15, fontWeight: 600, cursor: "pointer" }}>Log Out</button>
        <p style={{ textAlign: "center", fontSize: 11.5, color: "var(--text-disabled)", margin: "0 0 12px" }}>DriveWay Rider v1.1.0</p>
      </div>
    </div>
  );
}
