"use client";

import { useState } from "react";
import {
  AlertIcon, BoltIcon, CheckIcon, ClockIcon, DocIcon, GiftIcon, HomeIcon, NavIcon, PhoneIcon, ShareIcon, ShieldIcon, UploadIcon, WalletIcon,
} from "../icons";
import VehicleArt from "../VehicleArt";
import { Sheet } from "../customer/BookingScreens";
import { InfoPage } from "../customer/AccountScreens";
import { COMMISSION, RouteLines } from "./RiderScreens";
import { DemoButton, PageHeader, PrimaryButton, StatusBadge, Stars, Toggle, card, field, label } from "../ui";
import {
  HOTSPOTS, INCENTIVES, PLACES, RIDER_FEEDBACK, inr, vehicleById,
  type Driver, type Incentive, type Ride, type WalletTxn,
} from "../../lib/data";

const row: React.CSSProperties = { ...card, padding: 14, display: "flex", alignItems: "center", gap: 12 };
const small: React.CSSProperties = { margin: "2px 0 0", fontSize: 12.5, color: "var(--ink-soft)", lineHeight: 1.5 };
const iconTile = (bg: string): React.CSSProperties => ({ width: 42, height: 42, borderRadius: 12, background: bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 });

/* ───────────────────────── Wallet ───────────────────────── */

/** Balance = online earnings not yet paid out. Dues = commission owed on cash trips. */
export function WalletPage({ balance, dues, txns, onWithdraw, onPayDues, onBack }: {
  balance: number; dues: number; txns: WalletTxn[]; onWithdraw: () => void; onPayDues: () => void; onBack: () => void;
}) {
  const payable = balance - dues;
  return (
    <InfoPage title="Rider Wallet" onBack={onBack}>
      <div style={{ borderRadius: 22, padding: 18, background: "linear-gradient(150deg,var(--blue-dark),var(--blue))", color: "white", boxShadow: "0 10px 28px rgba(11,92,255,0.28)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", right: -50, top: -60, width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, rgba(245,166,35,0.3), transparent 70%)" }} />
        <p style={{ margin: 0, fontSize: 12.5, color: "rgba(255,255,255,0.75)" }}>Wallet balance</p>
        <p style={{ margin: "2px 0 0", fontSize: 32, fontWeight: 800 }}>{inr(balance)}</p>
        <div style={{ display: "flex", gap: 18, marginTop: 10, fontSize: 12 }}>
          <span><span style={{ color: "rgba(255,255,255,0.7)" }}>Cash dues</span><br /><b style={{ fontSize: 14 }}>{inr(dues)}</b></span>
          <span><span style={{ color: "rgba(255,255,255,0.7)" }}>Withdrawable</span><br /><b style={{ fontSize: 14 }}>{inr(Math.max(0, payable))}</b></span>
        </div>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <PrimaryButton tone="gold" onClick={onWithdraw} disabled={payable < 100} style={{ flex: 1 }}>Instant Payout</PrimaryButton>
        <PrimaryButton tone="ghost" onClick={onPayDues} disabled={dues <= 0} style={{ flex: 1 }}>Clear Dues</PrimaryButton>
      </div>
      <p style={{ ...small, margin: 0, textAlign: "center" }}>
        {payable < 100 ? "Minimum ₹100 withdrawable balance for instant payout." : "Instant payout to HDFC ••4521 · ₹5 fee. Weekly settlement every Monday is free."}
      </p>
      <p style={{ margin: "4px 2px 0", fontSize: 13.5, fontWeight: 700 }}>Transactions</p>
      {txns.map((t) => (
        <div key={t.id} style={row}>
          <span style={iconTile(t.amount > 0 ? "var(--success)" : "var(--bg-secondary)")}><WalletIcon s={20} c={t.amount > 0 ? "var(--success-text)" : "var(--ink-soft)"} /></span>
          <div style={{ flex: 1, minWidth: 0 }}><p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{t.kind}</p><p style={{ ...small, margin: 0 }}>{t.note} · {t.at}</p></div>
          <span style={{ fontWeight: 700, color: t.amount > 0 ? "var(--success-text)" : "var(--ink)", whiteSpace: "nowrap" }}>{t.amount > 0 ? "+ " : "− "}{inr(Math.abs(t.amount))}</span>
        </div>
      ))}
    </InfoPage>
  );
}

/* ───────────────────────── Incentives ───────────────────────── */

export function IncentivesScreen({ progress }: { progress: Record<Incentive["kind"], number> }) {
  const total = INCENTIVES.reduce((s, i) => s + (progress[i.kind] >= i.target ? i.reward : 0), 0);
  return (
    <div>
      <PageHeader title="Incentives" sub="Hit targets, earn bonuses" />
      <div style={{ padding: "0 16px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ borderRadius: 20, padding: 18, background: "linear-gradient(135deg,var(--gold),var(--gold-dark))", color: "var(--blue-dark)", boxShadow: "0 10px 24px rgba(245,166,35,0.35)" }}>
          <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600 }}>Unlocked so far</p>
          <p style={{ margin: "2px 0 0", fontSize: 30, fontWeight: 800 }}>{inr(total)}</p>
          <p style={{ margin: "4px 0 0", fontSize: 12 }}>Bonuses are credited to your wallet when each target is met.</p>
        </div>
        {INCENTIVES.map((i) => {
          const done = Math.min(progress[i.kind], i.target);
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
                <span>{done} / {i.target} trips</span><span>{hit ? "✓ Unlocked" : i.ends}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ───────────────────────── Ratings & performance ───────────────────────── */

export function PerformancePage({ rider, stats, onBack }: {
  rider: Driver; stats: { acceptance: number; cancellation: number; accepted: number; declined: number; cancelled: number }; onBack: () => void;
}) {
  const dist = [[5, 78], [4, 15], [3, 4], [2, 2], [1, 1]];
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
          <p style={{ margin: 0, fontSize: 38, fontWeight: 800, lineHeight: 1 }}>{rider.rating || "—"}</p>
          <Stars value={Math.round(rider.rating)} size={14} />
          <p style={{ ...small, fontSize: 11 }}>{rider.trips.toLocaleString("en-IN")} trips</p>
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
      {meter("Acceptance rate", stats.acceptance, stats.acceptance >= 80, `${stats.accepted} accepted · ${stats.declined} declined or missed. Keep it above 80% for priority dispatch.`)}
      {meter("Cancellation rate", stats.cancellation, stats.cancellation <= 5, `${stats.cancelled} cancelled by you. Stay under 5% to keep incentives.`)}
      <p style={{ margin: "4px 2px 0", fontSize: 13.5, fontWeight: 700 }}>What customers say</p>
      {RIDER_FEEDBACK.map((f) => (
        <div key={f.who + f.at} style={{ ...card, padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13.5, fontWeight: 600 }}>{f.who}</span>
            <span style={{ fontSize: 12, color: "var(--gold-dark)", fontWeight: 700 }}>{"★".repeat(f.stars)}<span style={{ color: "var(--ink-mute)", fontWeight: 500 }}> · {f.at}</span></span>
          </div>
          <p style={{ ...small, marginTop: 4 }}>“{f.text}”</p>
        </div>
      ))}
    </InfoPage>
  );
}

/* ───────────────────────── Documents & vehicle ───────────────────────── */

const DOCS = [
  { id: "dl", label: "Driving Licence", expires: "14 Aug 2034" },
  { id: "rc", label: "Vehicle RC", expires: "02 Mar 2037" },
  { id: "ins", label: "Vehicle Insurance", expires: "18 Oct 2026", soon: true },
  { id: "puc", label: "Pollution (PUC)", expires: "05 Dec 2026" },
  { id: "aadhaar", label: "Aadhaar / ID Proof" },
];

export function DocumentsPage({ onBack, onUploaded }: { onBack: () => void; onUploaded: (doc: string) => void }) {
  const [pending, setPending] = useState<string[]>([]);
  return (
    <InfoPage title="Documents" onBack={onBack}>
      {DOCS.map((d) => {
        const re = pending.includes(d.id);
        return (
          <div key={d.id} style={row}>
            <span style={iconTile(d.soon && !re ? "var(--warning)" : "var(--blue-tint)")}>{d.soon && !re ? <AlertIcon s={20} c="var(--warning-text)" /> : <DocIcon s={20} c="var(--blue)" />}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{d.label}</p>
              <p style={{ ...small, margin: 0, color: d.soon && !re ? "var(--warning-text)" : "var(--ink-soft)" }}>
                {re ? "New copy uploaded · under review" : d.expires ? `${d.soon ? "Expires soon · " : "Valid till "}${d.expires}` : "Verified"}
              </p>
            </div>
            {re ? <StatusBadge status="Pending" /> : (
              <button onClick={() => { setPending((p) => [...p, d.id]); onUploaded(d.label); }} aria-label={`Re-upload ${d.label}`} className="press" style={{ border: "none", background: "var(--blue-tint)", borderRadius: 10, padding: "7px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: "var(--blue)" }}>
                <UploadIcon s={14} c="var(--blue)" /> Update
              </button>
            )}
          </div>
        );
      })}
      <p style={{ ...small, textAlign: "center" }}>You&apos;ll get a reminder 30 days before any document expires. Expired documents pause your account.</p>
    </InfoPage>
  );
}

export function VehiclePage({ rider, onBack }: { rider: Driver; onBack: () => void }) {
  const v = vehicleById(rider.vehicle);
  return (
    <InfoPage title="Vehicle Details" onBack={onBack}>
      <div style={{ ...card, padding: 18, textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center" }}><VehicleArt kind={rider.vehicle} size={110} /></div>
        <p style={{ margin: "8px 0 0", fontSize: 17, fontWeight: 700 }}>{rider.model}</p>
        <p style={{ margin: "4px auto 0", display: "inline-block", background: "var(--ink)", color: "white", borderRadius: 8, padding: "4px 12px", fontSize: 13, fontWeight: 700, letterSpacing: "0.06em" }}>{rider.plate}</p>
      </div>
      <div style={{ ...card, padding: "4px 14px" }}>
        {[["Category", v.name], ["Seats", String(v.seats)], ["Base fare", inr(v.base)], ["Per km", inr(v.perKm)], ["City", rider.city]].map(([l, val], i) => (
          <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "11px 0", borderTop: i ? "1px solid var(--line)" : "none", fontSize: 13.5 }}>
            <span style={{ color: "var(--ink-soft)" }}>{l}</span><span style={{ fontWeight: 600 }}>{val}</span>
          </div>
        ))}
      </div>
      <p style={{ ...small, textAlign: "center" }}>To change your vehicle, contact rider support — a new RC and insurance will need re-verification.</p>
    </InfoPage>
  );
}

/* ───────────────────────── Bank & UPI ───────────────────────── */

export function BankPage({ onBack, onSaved }: { onBack: () => void; onSaved: () => void }) {
  const [upi, setUpi] = useState("rohit.k@okhdfc");
  const [edit, setEdit] = useState(false);
  return (
    <InfoPage title="Bank & UPI" onBack={onBack}>
      <div style={row}>
        <span style={iconTile("var(--blue-tint)")}><WalletIcon s={20} c="var(--blue)" /></span>
        <div style={{ flex: 1 }}><p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>HDFC Bank ••4521</p><p style={{ ...small, margin: 0 }}>IFSC HDFC0001234 · Primary for weekly payouts</p></div>
        <StatusBadge status="Approved" />
      </div>
      <div style={{ ...card, padding: 14 }}>
        <label style={label} htmlFor="rupi">UPI ID for instant payouts</label>
        <input id="rupi" value={upi} disabled={!edit} onChange={(e) => setUpi(e.target.value.trim())} style={{ ...field, opacity: edit ? 1 : 0.75 }} />
        <div style={{ marginTop: 12 }}>
          {edit
            ? <PrimaryButton disabled={!upi.includes("@")} onClick={() => { setEdit(false); onSaved(); }}>Save UPI ID</PrimaryButton>
            : <PrimaryButton tone="ghost" onClick={() => setEdit(true)}>Change UPI ID</PrimaryButton>}
        </div>
      </div>
      <p style={{ ...small, textAlign: "center" }}>Bank account changes need a cancelled cheque and are verified within 24 hours.</p>
    </InfoPage>
  );
}

/* ───────────────────────── Preferences ───────────────────────── */

export interface RiderPrefs { autoAccept: boolean; goHome: string | null; cash: boolean; sound: boolean; nav: "Google Maps" | "In-app" }

export function PreferencesPage({ prefs, onChange, onBack }: { prefs: RiderPrefs; onChange: (p: Partial<RiderPrefs>) => void; onBack: () => void }) {
  const homes = PLACES.filter((p) => p.kind === "home" || p.kind === "work");
  const switchRow = (t: string, b: string, on: boolean, set: (v: boolean) => void) => (
    <div style={row}>
      <div style={{ flex: 1 }}><p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{t}</p><p style={{ ...small, margin: 0, fontSize: 12 }}>{b}</p></div>
      <Toggle on={on} onChange={set} label={t} />
    </div>
  );
  return (
    <InfoPage title="Ride Preferences" onBack={onBack}>
      {switchRow("Auto-accept rides", "Requests are accepted for you after 3 seconds.", prefs.autoAccept, (v) => onChange({ autoAccept: v }))}
      {switchRow("Accept cash rides", "Turn off to only get UPI / online-paid rides.", prefs.cash, (v) => onChange({ cash: v }))}
      {switchRow("Request sound", "Play a ringtone for new ride requests.", prefs.sound, (v) => onChange({ sound: v }))}
      <div style={{ ...card, padding: 14 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}><HomeIcon s={18} c="var(--blue)" /> Go Home mode</p>
        <p style={{ ...small, margin: "2px 0 10px", fontSize: 12 }}>Only get rides heading towards this place. Up to 2 times a day.</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {[null, ...homes.map((h) => h.address)].map((a) => {
            const on = prefs.goHome === a;
            return <button key={a ?? "off"} onClick={() => onChange({ goHome: a })} aria-pressed={on} style={{ padding: "8px 12px", borderRadius: 12, cursor: "pointer", fontSize: 12.5, fontWeight: 600, background: on ? "var(--blue-tint)" : "var(--surface)", color: on ? "var(--blue)" : "var(--text-secondary)", border: on ? "1.5px solid var(--blue)" : "1.5px solid var(--line)" }}>{a ?? "Off"}</button>;
          })}
        </div>
      </div>
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

/* ───────────────────────── Refer & earn ───────────────────────── */

export function ReferPage({ code, onShare, onBack }: { code: string; onShare: () => void; onBack: () => void }) {
  return (
    <InfoPage title="Refer & Earn" onBack={onBack}>
      <div style={{ borderRadius: 20, padding: 20, background: "linear-gradient(150deg,#04246b,#020b24)", color: "white", textAlign: "center" }}>
        <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.7)" }}>Invite a rider, you both earn</p>
        <p style={{ margin: "4px 0 0", fontSize: 30, fontWeight: 800, color: "var(--gold)" }}>{inr(1000)}</p>
        <p style={{ margin: "4px 0 14px", fontSize: 12.5, color: "rgba(255,255,255,0.7)" }}>when they complete 25 trips in their first 30 days</p>
        <div style={{ display: "inline-block", border: "1.5px dashed rgba(255,255,255,0.4)", borderRadius: 12, padding: "8px 18px", fontSize: 20, fontWeight: 800, letterSpacing: "0.12em" }}>{code}</div>
      </div>
      <PrimaryButton onClick={onShare}><ShareIcon s={18} c="white" /> Share invite link</PrimaryButton>
      <p style={{ margin: "4px 2px 0", fontSize: 13.5, fontWeight: 700 }}>Your referrals</p>
      {[["Sanjay Kumar", 25, "Paid"], ["Mohit Rana", 11, "Pending"]].map(([n, t, s]) => (
        <div key={n as string} style={row}>
          <div style={{ flex: 1 }}><p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{n as string}</p><p style={{ ...small, margin: 0 }}>{t as number} / 25 trips</p></div>
          <StatusBadge status={s as string} />
        </div>
      ))}
    </InfoPage>
  );
}

/* ───────────────────────── Hotspots ───────────────────────── */

export function HotspotsPage({ online, onNavigate, onGoOnline, onBack }: { online: boolean; onNavigate: (area: string) => void; onGoOnline: () => void; onBack: () => void }) {
  return (
    <InfoPage title="Demand Hotspots" onBack={onBack}>
      <p style={{ ...small, margin: 0 }}>Live demand around you. Surge fares apply to rides that start in these zones.</p>
      {!online && <PrimaryButton onClick={onGoOnline} style={{ background: "linear-gradient(135deg,#34c38f,var(--green))" }}>Go online to get these rides</PrimaryButton>}
      {HOTSPOTS.map((h) => (
        <div key={h.id} style={row}>
          <span style={iconTile(h.surge >= 1.4 ? "var(--error)" : h.surge >= 1.2 ? "var(--warning)" : "var(--gold-tint)")}><BoltIcon s={20} c={h.surge >= 1.4 ? "var(--red)" : "var(--gold-dark)"} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{h.area}</p>
            <p style={{ ...small, margin: 0 }}>{h.km} km away · {h.waiting} customers waiting</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: h.surge >= 1.4 ? "var(--red)" : "var(--gold-dark)" }}>{h.surge}x</p>
            <button onClick={() => onNavigate(h.area)} style={{ background: "none", border: "none", padding: 0, color: "var(--blue)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Navigate</button>
          </div>
        </div>
      ))}
    </InfoPage>
  );
}

/* ───────────────────────── Trip detail ───────────────────────── */

export function TripDetailPage({ ride, onHelp, onBack }: { ride: Ride; onHelp: () => void; onBack: () => void }) {
  const done = ride.status === "Completed";
  return (
    <InfoPage title={`Trip #${ride.id}`} onBack={onBack}>
      <div style={{ ...card, padding: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span style={{ fontSize: 13, color: "var(--ink-soft)", display: "flex", alignItems: "center", gap: 6 }}><ClockIcon s={16} c="var(--ink-soft)" /> {ride.date}, {ride.time}</span>
          <StatusBadge status={ride.status} />
        </div>
        <RouteLines from={ride.from} to={ride.to} />
      </div>
      <div style={{ ...card, padding: "12px 16px" }}>
        {[["Customer", ride.customer], ["Distance · time", `${ride.km} km · ${ride.min} min`], ["Payment", ride.pay], ...(done ? [["Trip fare", inr(ride.fare)], [`Commission (${COMMISSION * 100}%)`, "− " + inr(ride.fare * COMMISSION)]] : [["Reason", ride.cancelReason ?? "—"]])].map(([l, v]) => (
          <div key={l} style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, padding: "5px 0" }}><span style={{ color: "var(--ink-soft)" }}>{l}</span><span style={{ fontWeight: 600 }}>{v}</span></div>
        ))}
        {done && (
          <>
            <div style={{ borderTop: "1px dashed var(--line-strong)", margin: "6px 0" }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 700, padding: "4px 0" }}><span>You earned</span><span style={{ color: "var(--success-text)" }}>{inr(ride.fare * (1 - COMMISSION))}</span></div>
          </>
        )}
      </div>
      {ride.rating && <div style={{ ...card, padding: 14, textAlign: "center" }}><p style={{ margin: "0 0 6px", fontSize: 13, color: "var(--ink-soft)" }}>You rated {ride.customer.split(" ")[0]}</p><Stars value={ride.rating} size={22} /></div>}
      <PrimaryButton tone="ghost" onClick={onHelp}>Report an issue with this trip</PrimaryButton>
    </InfoPage>
  );
}

/* ───────────────────────── Sheets used during a trip ───────────────────────── */

const CANCEL_REASONS = ["Customer not reachable", "Customer asked me to cancel", "Pickup location is wrong", "Vehicle problem", "Too far from pickup"];

export function CancelTripSheet({ onClose, onConfirm }: { onClose: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState<string | null>(null);
  return (
    <Sheet onClose={onClose}>
      <p style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Cancel this ride?</p>
      <p style={{ ...small, margin: "4px 0 14px" }}>Frequent cancellations lower your priority and can pause incentives.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {CANCEL_REASONS.map((r) => {
          const on = r === reason;
          return <button key={r} onClick={() => setReason(r)} aria-pressed={on} style={{ ...card, textAlign: "left", cursor: "pointer", padding: "12px 14px", fontSize: 13.5, fontWeight: 500, color: "var(--ink)", border: on ? "1.5px solid var(--red)" : "1.5px solid transparent", background: on ? "var(--error)" : "var(--surface)" }}>{r}</button>;
        })}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
        <PrimaryButton tone="red" disabled={!reason} onClick={() => reason && onConfirm(reason)}>Cancel Ride</PrimaryButton>
        <PrimaryButton tone="ghost" onClick={onClose}>Keep the ride</PrimaryButton>
      </div>
    </Sheet>
  );
}

export function SosSheet({ onClose, onAction }: { onClose: () => void; onAction: (a: "police" | "safety" | "share") => void }) {
  const actions = [
    { a: "police" as const, t: "Call Police (112)", b: "Connects you to emergency services", Icon: PhoneIcon, c: "var(--red)", bg: "var(--error)" },
    { a: "safety" as const, t: "Alert DriveWay Safety", b: "Our 24×7 team will call you within a minute", Icon: ShieldIcon, c: "var(--blue)", bg: "var(--blue-tint)" },
    { a: "share" as const, t: "Share live location", b: "Send this trip to your emergency contacts", Icon: ShareIcon, c: "var(--green)", bg: "var(--success)" },
  ];
  return (
    <Sheet onClose={onClose}>
      <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "var(--red)" }}>Emergency help</p>
      <p style={{ ...small, margin: "4px 0 14px" }}>Your live location and trip details are shared with whoever you contact.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {actions.map(({ a, t, b, Icon, c, bg }) => (
          <button key={a} onClick={() => onAction(a)} className="press" style={{ ...row, border: "none", cursor: "pointer", textAlign: "left" }}>
            <span style={iconTile(bg)}><Icon s={20} c={c} /></span>
            <span style={{ flex: 1 }}><span style={{ display: "block", fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>{t}</span><span style={{ display: "block", fontSize: 12, color: "var(--ink-soft)" }}>{b}</span></span>
          </button>
        ))}
      </div>
      <div style={{ marginTop: 14, textAlign: "center" }}><DemoButton onClick={onClose}>close</DemoButton></div>
    </Sheet>
  );
}
