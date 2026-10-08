"use client";

import { useState } from "react";
import { CheckIcon, ClockIcon, DocIcon, GiftIcon, NavIcon, PhoneIcon, ShareIcon, ShieldIcon, WalletIcon } from "../icons";
import VehicleArt from "../VehicleArt";
import { Sheet } from "../customer/BookingScreens";
import { InfoPage } from "../customer/AccountScreens";
import { RouteLines, rates } from "./RiderScreens";
import { ErrorText, PrimaryButton, StatusBadge, Stars, Toggle, card, field, label } from "../ui";
import { inr, vehicleById } from "../../lib/data";
import { fmtWhen, type DriverMe, type RideView } from "../../lib/api";

const row: React.CSSProperties = { ...card, padding: 14, display: "flex", alignItems: "center", gap: 12 };
const small: React.CSSProperties = { margin: "2px 0 0", fontSize: 12.5, color: "var(--ink-soft)", lineHeight: 1.5 };
const iconTile = (bg: string): React.CSSProperties => ({ width: 42, height: 42, borderRadius: 12, background: bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 });

/* ───────────────────────── Wallet ───────────────────────── */

/** One balance from the ledger: positive = withdrawable, negative = dues owed (cash trips). */
export function WalletPage({ me, busy, err, onWithdraw, onPayDues, onBack }: {
  me: DriverMe; busy: boolean; err: string | null; onWithdraw: () => void; onPayDues: () => void; onBack: () => void;
}) {
  const dues = Math.max(0, -me.balance);
  const withdrawable = Math.max(0, me.balance);
  return (
    <InfoPage title="Rider Wallet" onBack={onBack}>
      <div style={{ borderRadius: 22, padding: 18, background: "linear-gradient(150deg,var(--blue-dark),var(--blue))", color: "white", boxShadow: "0 10px 28px rgba(11,92,255,0.28)" }}>
        <p style={{ margin: 0, fontSize: 12.5, color: "rgba(255,255,255,0.75)" }}>Wallet balance</p>
        <p style={{ margin: "2px 0 0", fontSize: 32, fontWeight: 800 }}>{me.balance < 0 ? "− " : ""}{inr(Math.abs(me.balance))}</p>
        <div style={{ display: "flex", gap: 18, marginTop: 10, fontSize: 12 }}>
          <span><span style={{ color: "rgba(255,255,255,0.7)" }}>Cash dues</span><br /><b style={{ fontSize: 14 }}>{inr(dues)}</b></span>
          <span><span style={{ color: "rgba(255,255,255,0.7)" }}>Withdrawable</span><br /><b style={{ fontSize: 14 }}>{inr(withdrawable)}</b></span>
        </div>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <PrimaryButton tone="gold" onClick={onWithdraw} disabled={busy || withdrawable < me.min_payout || !me.upi} style={{ flex: 1 }}>Instant Payout</PrimaryButton>
        <PrimaryButton tone="ghost" onClick={onPayDues} disabled={busy || dues <= 0} style={{ flex: 1 }}>Clear Dues</PrimaryButton>
      </div>
      <ErrorText msg={err} />
      <p style={{ ...small, margin: 0, textAlign: "center" }}>
        {!me.upi ? "Add a UPI ID in Account → UPI for payouts first." : withdrawable < me.min_payout ? `Minimum ${inr(me.min_payout)} withdrawable balance for instant payout.` : `Instant payout to ${me.upi} · ${inr(me.payout_fee)} fee.`}
      </p>
      <p style={{ margin: "4px 2px 0", fontSize: 13.5, fontWeight: 700 }}>Transactions</p>
      {me.txns.length === 0 && <p style={{ ...small, textAlign: "center" }}>No transactions yet.</p>}
      {me.txns.map((t) => (
        <div key={t.id} style={row}>
          <span style={iconTile(t.amount > 0 ? "var(--success)" : "var(--bg-secondary)")}><WalletIcon s={20} c={t.amount > 0 ? "var(--success-text)" : "var(--ink-soft)"} /></span>
          <div style={{ flex: 1, minWidth: 0 }}><p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{t.note ?? t.kind}</p><p style={{ ...small, margin: 0 }}>{fmtWhen(t.at)}</p></div>
          <span style={{ fontWeight: 700, color: t.amount > 0 ? "var(--success-text)" : "var(--ink)", whiteSpace: "nowrap" }}>{t.amount > 0 ? "+ " : "− "}{inr(Math.abs(t.amount))}</span>
        </div>
      ))}
    </InfoPage>
  );
}

/* ───────────────────────── Incentives (paid by the server when a target is hit) ───────────────────────── */

export function IncentivesScreen({ me }: { me: DriverMe }) {
  const window_ = { today: "Resets at midnight", peak: "Today, 6 – 9 PM", week: "Monday – Sunday" };
  return (
    <div>
      <div style={{ padding: "18px 16px 8px" }}><p style={{ margin: 0, fontSize: 21, fontWeight: 700 }}>Incentives</p><p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-soft)" }}>Hit targets, earn bonuses</p></div>
      <div style={{ padding: "0 16px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ borderRadius: 20, padding: 18, background: "linear-gradient(135deg,var(--gold),var(--gold-dark))", color: "var(--blue-dark)", boxShadow: "0 10px 24px rgba(245,166,35,0.35)" }}>
          <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600 }}>Bonuses this week</p>
          <p style={{ margin: "2px 0 0", fontSize: 30, fontWeight: 800 }}>{inr(me.earnings.incentives_week)}</p>
          <p style={{ margin: "4px 0 0", fontSize: 12 }}>Credited to your wallet automatically when a target is met.</p>
        </div>
        {me.incentives.map((i) => {
          const done = Math.min(i.progress, i.target);
          const hit = done >= i.target;
          return (
            <div key={i.id} style={{ ...card, padding: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={iconTile(hit ? "var(--success)" : "var(--gold-tint)")}>{hit ? <CheckIcon s={20} c="var(--success-text)" /> : <GiftIcon s={20} c="var(--gold-dark)" />}</span>
                <div style={{ flex: 1 }}><p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{i.title}</p><p style={{ ...small, margin: 0 }}>{i.body}</p></div>
                <span style={{ fontSize: 16, fontWeight: 800, color: hit ? "var(--success-text)" : "var(--ink)" }}>{inr(i.reward)}</span>
              </div>
              <div style={{ height: 7, borderRadius: 4, background: "var(--line)", margin: "12px 0 6px" }}>
                <div style={{ width: `${(done / i.target) * 100}%`, height: "100%", borderRadius: 4, background: hit ? "var(--green)" : "var(--gold)", transition: "width 0.4s" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "var(--ink-soft)" }}>
                <span>{done} / {i.target} trips</span><span>{hit ? "✓ Unlocked" : window_[i.kind]}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ───────────────────────── Ratings & performance ───────────────────────── */

export function PerformancePage({ me, trips, onBack }: { me: DriverMe; trips: RideView[]; onBack: () => void }) {
  const r = rates(me);
  const rated = trips.filter((t) => t.rating);
  const dist = [5, 4, 3, 2, 1].map((s) => [s, rated.length ? Math.round((rated.filter((t) => t.rating === s).length / rated.length) * 100) : 0]);
  const meter = (l: string, v: number, good: boolean, hint: string) => (
    <div style={{ ...card, padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontSize: 13.5, fontWeight: 600 }}>{l}</span>
        <span style={{ fontSize: 18, fontWeight: 800, color: good ? "var(--success-text)" : "var(--warning-text)" }}>{v}%</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: "var(--line)", margin: "8px 0 6px" }}><div style={{ width: `${v}%`, height: "100%", borderRadius: 3, background: good ? "var(--green)" : "var(--gold)" }} /></div>
      <p style={{ ...small, margin: 0, fontSize: 11.5 }}>{hint}</p>
    </div>
  );
  return (
    <InfoPage title="Ratings & Performance" onBack={onBack}>
      <div style={{ ...card, padding: 16, display: "flex", gap: 16, alignItems: "center" }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: 38, fontWeight: 800, lineHeight: 1 }}>{me.rating ?? "—"}</p>
          <Stars value={Math.round(me.rating ?? 0)} size={14} />
          <p style={{ ...small, fontSize: 11 }}>{rated.length} ratings</p>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
          {dist.map(([s, p]) => (
            <div key={s} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, color: "var(--ink-soft)" }}>
              <span style={{ width: 10 }}>{s}</span>
              <span style={{ flex: 1, height: 6, borderRadius: 3, background: "var(--line)" }}><span style={{ display: "block", width: `${p}%`, height: "100%", borderRadius: 3, background: "var(--gold)" }} /></span>
              <span style={{ width: 28, textAlign: "right" }}>{p}%</span>
            </div>
          ))}
        </div>
      </div>
      {meter("Acceptance rate", r.acceptance, r.acceptance >= 80, `${me.offers_accepted} accepted · ${me.offers_declined} declined or missed.`)}
      {meter("Cancellation rate", r.cancellation, r.cancellation <= 5, `${me.cancellations} cancelled by you.`)}
    </InfoPage>
  );
}

/* ───────────────────────── Documents & vehicle ───────────────────────── */

export function DocumentsPage({ me, onBack }: { me: DriverMe; onBack: () => void }) {
  return (
    <InfoPage title="Documents" onBack={onBack}>
      {["Profile Photo", "Driving Licence", "Vehicle RC", "Vehicle Insurance", "Aadhaar / ID Proof"].map((d) => (
        <div key={d} style={row}>
          <span style={iconTile("var(--blue-tint)")}><DocIcon s={20} c="var(--blue)" /></span>
          <div style={{ flex: 1, minWidth: 0 }}><p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{d}</p><p style={{ ...small, margin: 0 }}>Submitted with your application</p></div>
          <StatusBadge status={me.kyc} />
        </div>
      ))}
      <p style={{ ...small, textAlign: "center" }}>To replace a document, message Rider Support — the new copy is re-verified before it takes effect.</p>
    </InfoPage>
  );
}

export function VehiclePage({ me, onBack }: { me: DriverMe; onBack: () => void }) {
  const v = vehicleById(me.vehicle);
  return (
    <InfoPage title="Vehicle Details" onBack={onBack}>
      <div style={{ ...card, padding: 18, textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center" }}><VehicleArt kind={me.vehicle} size={110} /></div>
        <p style={{ margin: "8px 0 0", fontSize: 17, fontWeight: 700 }}>{me.model}</p>
        <p style={{ margin: "4px auto 0", display: "inline-block", background: "var(--ink)", color: "white", borderRadius: 8, padding: "4px 12px", fontSize: 13, fontWeight: 700, letterSpacing: "0.06em" }}>{me.plate}</p>
      </div>
      <div style={{ ...card, padding: "4px 14px" }}>
        {[["Category", v.name], ["Air conditioning", me.ac ? "❄ AC — gets AC & Non-AC rides" : "Non-AC — Non-AC rides only"], ["Seats", String(v.seats)], ["City", me.city]].map(([l, val], i) => (
          <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "11px 0", borderTop: i ? "1px solid var(--line)" : "none", fontSize: 13.5 }}>
            <span style={{ color: "var(--ink-soft)" }}>{l}</span><span style={{ fontWeight: 600 }}>{val}</span>
          </div>
        ))}
      </div>
      <p style={{ ...small, textAlign: "center" }}>To change your vehicle, contact rider support — a new RC and insurance will need re-verification.</p>
    </InfoPage>
  );
}

/* ───────────────────────── UPI for payouts ───────────────────────── */

const UPI_RE = /^[a-zA-Z0-9._-]{2,64}@[a-zA-Z]{2,32}$/;

export function BankPage({ upi: initial, onSave, onBack }: { upi: string | null; onSave: (upi: string) => Promise<void>; onBack: () => void }) {
  const [upi, setUpi] = useState(initial ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const ok = UPI_RE.test(upi);
  const save = async () => {
    setBusy(true); setErr(null);
    try { await onSave(upi); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <InfoPage title="UPI for payouts" onBack={onBack}>
      <div style={{ ...card, padding: 14 }}>
        <label style={label} htmlFor="rupi">UPI ID for instant payouts</label>
        <input id="rupi" value={upi} maxLength={97} onChange={(e) => { setUpi(e.target.value.trim()); setErr(null); }} placeholder="name@okaxis" style={field} />
        {upi && !ok && <ErrorText msg="Enter a UPI ID like name@okaxis." />}
        <ErrorText msg={err} />
        <div style={{ marginTop: 12 }}><PrimaryButton disabled={!ok || busy || upi === initial} onClick={() => void save()}>{busy ? "Saving…" : "Save UPI ID"}</PrimaryButton></div>
      </div>
    </InfoPage>
  );
}

/* ───────────────────────── Preferences (stored on this device) ───────────────────────── */

export interface RiderPrefs { autoAccept: boolean; cash: boolean; nav: "Google Maps" | "In-app" }

export function PreferencesPage({ prefs, onChange, onBack }: { prefs: RiderPrefs; onChange: (p: Partial<RiderPrefs>) => void; onBack: () => void }) {
  const switchRow = (t: string, b: string, on: boolean, set: (v: boolean) => void) => (
    <div style={row}>
      <div style={{ flex: 1 }}><p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{t}</p><p style={{ ...small, margin: 0, fontSize: 12 }}>{b}</p></div>
      <Toggle on={on} onChange={set} label={t} />
    </div>
  );
  return (
    <InfoPage title="Ride Preferences" onBack={onBack}>
      {switchRow("Auto-accept rides", "Requests are accepted for you after 3 seconds.", prefs.autoAccept, (v) => onChange({ autoAccept: v }))}
      {switchRow("Accept cash rides", "Turn off to only see UPI / card / wallet rides.", prefs.cash, (v) => onChange({ cash: v }))}
      <div style={{ ...card, padding: 14 }}>
        <p style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}><NavIcon s={16} c="var(--blue)" /> Navigation app</p>
        <div style={{ display: "flex", gap: 8 }}>
          {(["Google Maps", "In-app"] as const).map((n) => {
            const on = prefs.nav === n;
            return <button key={n} onClick={() => onChange({ nav: n })} aria-pressed={on} style={{ flex: 1, padding: "9px 12px", borderRadius: 12, cursor: "pointer", fontSize: 13, fontWeight: 600, background: on ? "var(--blue-tint)" : "var(--surface)", color: on ? "var(--blue)" : "var(--text-secondary)", border: on ? "1.5px solid var(--blue)" : "1.5px solid var(--line)" }}>{n}</button>;
          })}
        </div>
      </div>
    </InfoPage>
  );
}

/* ───────────────────────── Trip detail ───────────────────────── */

export function TripDetailPage({ ride, onHelp, onBack }: { ride: RideView; onHelp: () => void; onBack: () => void }) {
  const done = ride.status === "Completed";
  const gross = ride.fare + ride.wait_fee;
  const earn = Math.round(gross * (1 - ride.commission_pct / 100));
  return (
    <InfoPage title={`Trip #${ride.code}`} onBack={onBack}>
      <div style={{ ...card, padding: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span style={{ fontSize: 13, color: "var(--ink-soft)", display: "flex", alignItems: "center", gap: 6 }}><ClockIcon s={16} c="var(--ink-soft)" /> {fmtWhen(ride.assigned_at ?? ride.created_at)}</span>
          <StatusBadge status={ride.status} />
        </div>
        <RouteLines from={ride.from.name} to={ride.to.name} />
      </div>
      <div style={{ ...card, padding: "12px 16px" }}>
        {[["Customer", ride.customer?.name ?? "—"], ["Distance · time", `${ride.km} km · ${ride.mins} min`], ["Payment", `${ride.pay} · ${ride.payment_status}`],
          ...(done ? [["Trip fare", inr(ride.fare)], ...(ride.wait_fee ? [["Waiting charge", inr(ride.wait_fee)]] : []), [`Commission (${ride.commission_pct}%)`, "− " + inr(gross - earn)]] : [])].map(([l, v]) => (
          <div key={l} style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, padding: "5px 0" }}><span style={{ color: "var(--ink-soft)" }}>{l}</span><span style={{ fontWeight: 600 }}>{v}</span></div>
        ))}
        {done && (
          <>
            <div style={{ borderTop: "1px dashed var(--line-strong)", margin: "6px 0" }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 700, padding: "4px 0" }}><span>You earned</span><span style={{ color: "var(--success-text)" }}>{inr(earn)}</span></div>
          </>
        )}
      </div>
      {ride.rating && <div style={{ ...card, padding: 14, textAlign: "center" }}><p style={{ margin: "0 0 6px", fontSize: 13, color: "var(--ink-soft)" }}>The customer rated you</p><Stars value={ride.rating} size={20} /></div>}
      <PrimaryButton tone="ghost" onClick={onHelp}>Report an issue with this trip</PrimaryButton>
    </InfoPage>
  );
}

/* ───────────────────────── Sheets used during a trip ───────────────────────── */

const CANCEL_REASONS = ["Customer not reachable", "Customer asked me to cancel", "Pickup location is wrong", "Vehicle problem", "Too far from pickup"];

export function CancelTripSheet({ busy, err, onClose, onConfirm }: { busy: boolean; err: string | null; onClose: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState<string | null>(null);
  return (
    <Sheet onClose={onClose}>
      <p style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Cancel this ride?</p>
      <p style={{ ...small, margin: "4px 0 14px" }}>The ride goes back to other drivers. Frequent cancellations lower your priority.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {CANCEL_REASONS.map((r) => {
          const on = r === reason;
          return <button key={r} onClick={() => setReason(r)} aria-pressed={on} style={{ ...card, textAlign: "left", cursor: "pointer", padding: "12px 14px", fontSize: 13.5, fontWeight: 500, color: "var(--ink)", border: on ? "1.5px solid var(--red)" : "1.5px solid transparent", background: on ? "var(--error)" : "var(--surface)" }}>{r}</button>;
        })}
      </div>
      <ErrorText msg={err} />
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
        <PrimaryButton tone="red" disabled={!reason || busy} onClick={() => reason && onConfirm(reason)}>{busy ? "Cancelling…" : "Cancel Ride"}</PrimaryButton>
        <PrimaryButton tone="ghost" onClick={onClose}>Keep the ride</PrimaryButton>
      </div>
    </Sheet>
  );
}

export function SosSheet({ onClose, onAction }: { onClose: () => void; onAction: (a: "police" | "support" | "share") => void }) {
  const actions = [
    { a: "police" as const, t: "Call Police (112)", b: "Connects you to emergency services", Icon: PhoneIcon, c: "var(--red)", bg: "var(--error)" },
    { a: "support" as const, t: "Message DriveWay Support", b: "Creates a priority ticket with this trip", Icon: ShieldIcon, c: "var(--blue)", bg: "var(--blue-tint)" },
    { a: "share" as const, t: "Share trip details", b: "Send pickup, drop and vehicle to someone you trust", Icon: ShareIcon, c: "var(--green)", bg: "var(--success)" },
  ];
  return (
    <Sheet onClose={onClose}>
      <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "var(--red)" }}>Emergency help</p>
      <p style={{ ...small, margin: "4px 0 14px" }}>In immediate danger, call 112.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {actions.map(({ a, t, b, Icon, c, bg }) => (
          <button key={a} onClick={() => onAction(a)} className="press" style={{ ...row, border: "none", cursor: "pointer", textAlign: "left" }}>
            <span style={iconTile(bg)}><Icon s={20} c={c} /></span>
            <span style={{ flex: 1 }}><span style={{ display: "block", fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>{t}</span><span style={{ display: "block", fontSize: 12, color: "var(--ink-soft)" }}>{b}</span></span>
          </button>
        ))}
      </div>
      <div style={{ marginTop: 14 }}><PrimaryButton tone="ghost" onClick={onClose}>Close</PrimaryButton></div>
    </Sheet>
  );
}
