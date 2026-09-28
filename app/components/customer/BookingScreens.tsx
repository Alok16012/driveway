"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertIcon, BackIcon, BriefcaseIcon, CardIcon, CashIcon, ChatIcon, CheckIcon, ClockIcon, HomeIcon, PhoneIcon,
  PinIcon, ShareIcon, ShieldIcon, SwapIcon, TagIcon, UpiIcon, UserIcon, WalletIcon, XIcon,
} from "../icons";
import MapView from "../MapView";
import VehicleArt from "../VehicleArt";
import { Avatar, DemoButton, Footer, PageHeader, PrimaryButton, Stars, StatusBadge, card, field, iconBtn } from "../ui";
import {
  COUPONS, CURRENT_LOCATION, PLACES, RIDE_STEPS, VEHICLES, discountFor, fareFor, inr, tripEstimate, vehicleById,
  type Coupon, type PayMethod, type Place, type VehicleKind,
} from "../../lib/data";
import type { ActiveRide, Booking } from "./types";

const dot = (color: string, square = false): React.CSSProperties => ({
  width: 10, height: 10, borderRadius: square ? 2 : "50%", background: color, flexShrink: 0,
  boxShadow: `0 0 0 3px ${color === "var(--green)" ? "rgba(47,158,118,0.18)" : "rgba(224,49,49,0.18)"}`,
});

/* ───────────────────────── 1. Set location ───────────────────────── */

export function SearchPage({ initialTo, onBack, onDone }: { initialTo?: Place; onBack: () => void; onDone: (from: Place, to: Place) => void }) {
  const [from, setFrom] = useState<Place>(CURRENT_LOCATION);
  const [to, setTo] = useState<Place | null>(initialTo ?? null);
  const [focus, setFocus] = useState<"from" | "to">("to");
  const [q, setQ] = useState("");

  const list = useMemo(() => {
    const all = focus === "from" ? [CURRENT_LOCATION, ...PLACES] : PLACES;
    const t = q.trim().toLowerCase();
    return t ? all.filter((p) => (p.name + p.address).toLowerCase().includes(t)) : all;
  }, [q, focus]);

  const pick = (p: Place) => {
    if (focus === "from") { setFrom(p); setFocus("to"); setQ(""); if (to) onDone(p, to); }
    else { setTo(p); setQ(""); onDone(from, p); }
  };

  const input = (which: "from" | "to") => {
    const on = focus === which;
    const val = which === "from" ? from : to;
    return (
      <input
        value={on ? q : val?.name ?? ""}
        onFocus={() => { setFocus(which); setQ(""); }}
        onChange={(e) => setQ(e.target.value)}
        autoFocus={which === "to"}
        placeholder={on ? (which === "from" ? "Search pickup location" : "Where are you going?") : val?.name ?? "Where are you going?"}
        aria-label={which === "from" ? "Pickup location" : "Drop location"}
        style={{ flex: 1, border: "none", outline: "none", background: on ? "var(--blue-tint)" : "var(--bg-secondary)", borderRadius: 12, padding: "11px 12px", fontSize: 14, fontWeight: 500, color: "var(--ink)", minWidth: 0 }}
      />
    );
  };

  return (
    <div>
      <PageHeader title="Set Location" onBack={onBack} />
      <div style={{ padding: "0 16px" }}>
        <div style={{ ...card, padding: 12, display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "0 2px" }}>
            <span style={dot("var(--green)")} />
            <span style={{ width: 2, height: 30, background: "repeating-linear-gradient(var(--line-strong) 0 4px, transparent 4px 7px)" }} />
            <span style={dot("var(--red)", true)} />
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
            {input("from")}
            {input("to")}
          </div>
          <button aria-label="Swap pickup and drop" disabled={!to} onClick={() => { if (to) { setFrom(to); setTo(from); } }} className="press"
            style={{ ...iconBtn, width: 36, height: 36, borderRadius: "50%", background: "var(--bg-secondary)", justifyContent: "center" }}>
            <SwapIcon s={18} c="var(--ink-soft)" />
          </button>
        </div>

        <p style={{ margin: "20px 2px 6px", fontSize: 12, fontWeight: 600, color: "var(--ink-mute)", letterSpacing: "0.06em" }}>
          {q ? "RESULTS" : focus === "from" ? "CHOOSE PICKUP" : "SAVED & RECENT"}
        </p>
        <div style={{ ...card, padding: "4px 14px" }}>
          {list.map((p, i) => {
            const Icon = p.id === "cur" ? PinIcon : p.kind === "home" ? HomeIcon : p.kind === "work" ? BriefcaseIcon : p.kind === "recent" ? ClockIcon : PinIcon;
            return (
              <button key={p.id} onClick={() => pick(p)} className="press" style={{
                width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "13px 0", background: "none", border: "none",
                borderTop: i ? "1px solid var(--line)" : "none", cursor: "pointer", textAlign: "left",
              }}>
                <span style={{ width: 36, height: 36, borderRadius: "50%", background: p.id === "cur" ? "var(--blue-tint)" : "var(--bg-secondary)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon s={17} c={p.id === "cur" ? "var(--blue)" : "var(--ink-soft)"} />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{p.name}</span>
                  <span style={{ display: "block", fontSize: 12, color: "var(--ink-soft)" }}>{p.address}</span>
                </span>
              </button>
            );
          })}
          {list.length === 0 && <p style={{ textAlign: "center", color: "var(--ink-soft)", fontSize: 13.5, padding: "24px 0" }}>No places match “{q}”.</p>}
        </div>
        <div style={{ ...card, marginTop: 12, marginBottom: 24, padding: 14, display: "flex", alignItems: "center", gap: 12 }}>
          <PinIcon s={20} c="var(--blue)" />
          <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>Set location on map</span>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── 2. Choose vehicle ───────────────────────── */

export function ChooseRidePage({ from, to, prefer, onBack, onNext }: {
  from: Place; to: Place; prefer?: VehicleKind; onBack: () => void; onNext: (b: Pick<Booking, "vehicle" | "km" | "min" | "fare">) => void;
}) {
  const { km, min } = tripEstimate(from.id, to.id);
  const [sel, setSel] = useState<VehicleKind>(prefer ?? "mini");
  const v = vehicleById(sel);
  const fare = fareFor(v, km, min);

  return (
    <div style={{ minHeight: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ position: "relative" }}>
        <MapView mode="route" height={270} radius={0} />
        <button onClick={onBack} aria-label="Back" className="press" style={{ ...iconBtn, position: "absolute", top: 16, left: 16, width: 40, height: 40, borderRadius: "50%", background: "white", justifyContent: "center", boxShadow: "var(--shadow-md)" }}>
          <BackIcon c="var(--ink)" />
        </button>
        <div style={{ position: "absolute", top: 16, left: 66, right: 16, background: "white", borderRadius: 14, padding: "8px 12px", boxShadow: "var(--shadow-md)" }}>
          <p style={{ margin: 0, fontSize: 12, color: "var(--ink-soft)", display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", overflow: "hidden" }}><span style={{ ...dot("var(--green)"), width: 7, height: 7, boxShadow: "none" }} />{from.name}</p>
          <p style={{ margin: "2px 0 0", fontSize: 12.5, fontWeight: 600, color: "var(--ink)", display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", overflow: "hidden" }}><span style={{ ...dot("var(--red)", true), width: 7, height: 7, boxShadow: "none" }} />{to.name}</p>
        </div>
        <span style={{ position: "absolute", bottom: 32, left: 16, background: "var(--ink)", color: "white", fontSize: 12, fontWeight: 600, padding: "5px 11px", borderRadius: 999 }}>{km} km · {min} min</span>
      </div>

      <div style={{ flex: 1, marginTop: -20, position: "relative", background: "var(--app-bg)", borderRadius: "22px 22px 0 0", padding: "8px 16px 0" }}>
        <div style={{ width: 40, height: 4, borderRadius: 4, background: "var(--line-strong)", margin: "0 auto 12px" }} />
        <p style={{ margin: "0 2px 10px", fontSize: 17, fontWeight: 700, color: "var(--ink)" }}>Select a ride</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {VEHICLES.filter((x) => x.enabled).map((x) => {
            const on = x.id === sel;
            return (
              <button key={x.id} onClick={() => setSel(x.id)} aria-pressed={on} className="press" style={{
                ...card, display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", cursor: "pointer", textAlign: "left",
                border: on ? "1.5px solid var(--blue)" : "1.5px solid transparent", background: on ? "var(--blue-tint)" : "var(--surface)",
              }}>
                <VehicleArt kind={x.id} size={58} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: "var(--ink)", display: "flex", alignItems: "center", gap: 6 }}>
                    {x.name}
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 2, fontSize: 11.5, fontWeight: 500, color: "var(--ink-soft)" }}><UserIcon s={12} c="var(--ink-soft)" />{x.seats}</span>
                  </p>
                  <p style={{ margin: "1px 0 0", fontSize: 11.5, color: "var(--ink-soft)" }}>{x.eta} min away · {x.tagline}</p>
                </div>
                <span style={{ fontSize: 16, fontWeight: 800, color: "var(--ink)" }}>{inr(fareFor(x, km, min))}</span>
              </button>
            );
          })}
        </div>
        <p style={{ margin: "12px 2px 0", fontSize: 11.5, color: "var(--ink-mute)", textAlign: "center" }}>Fares are estimates · final fare depends on actual route and time</p>
      </div>
      <Footer><PrimaryButton onClick={() => onNext({ vehicle: sel, km, min, fare })}>Choose {v.name} · {inr(fare)}</PrimaryButton></Footer>
    </div>
  );
}

/* ───────────────────────── 3. Offers + payment ───────────────────────── */

const PAYS: { id: PayMethod; label: string; sub: string; Icon: typeof CardIcon }[] = [
  { id: "UPI", label: "UPI", sub: "GPay, PhonePe, Paytm", Icon: UpiIcon },
  { id: "Card", label: "Credit / Debit Card", sub: "Visa ending 4821", Icon: CardIcon },
  { id: "Wallet", label: "DriveWay Wallet", sub: "Balance ₹240", Icon: WalletIcon },
  { id: "Cash", label: "Cash", sub: "Pay the driver at drop", Icon: CashIcon },
];

export function ConfirmPage({ booking, onBack, onConfirm }: { booking: Booking; onBack: () => void; onConfirm: (coupon: Coupon | null, pay: PayMethod) => void }) {
  const [pay, setPay] = useState<PayMethod>(booking.pay);
  const [coupon, setCoupon] = useState<Coupon | null>(booking.coupon);
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const v = vehicleById(booking.vehicle);
  const off = discountFor(coupon, booking.fare);
  const total = booking.fare - off;
  const distanceFare = Math.round(v.perKm * booking.km);
  const timeFare = Math.max(0, booking.fare - v.base - distanceFare);

  const apply = (c?: Coupon) => {
    const hit = c ?? COUPONS.find((x) => x.code === code.trim().toUpperCase() && x.active);
    if (!hit) { setErr("That code isn't valid right now."); return; }
    setCoupon(hit); setErr(""); setCode("");
  };

  const row = (l: string, r: string, strong = false, color?: string) => (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: strong ? 15 : 13.5, fontWeight: strong ? 700 : 500, color: color ?? (strong ? "var(--ink)" : "var(--ink-soft)"), padding: "4px 0" }}>
      <span>{l}</span><span>{r}</span>
    </div>
  );

  return (
    <div style={{ minHeight: "100%", display: "flex", flexDirection: "column" }}>
      <PageHeader title="Confirm & Pay" onBack={onBack} />
      <div style={{ padding: "0 16px", flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
        {/* trip */}
        <div style={{ ...card, padding: 14, display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ width: 68, height: 58, borderRadius: 14, background: "var(--bg-secondary)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><VehicleArt kind={v.id} size={56} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 14.5, fontWeight: 700 }}>{v.name} · {booking.km} km</p>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--ink-soft)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{booking.from.name} → {booking.to.name}</p>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--ink-soft)" }}>~{booking.min} min · pickup in {v.eta} min</p>
          </div>
        </div>

        {/* coupon */}
        <div>
          <p style={{ margin: "0 2px 8px", fontSize: 13.5, fontWeight: 600 }}>Apply Coupon</p>
          {coupon ? (
            <div style={{ borderRadius: 16, padding: "12px 14px", background: "var(--success)", border: "1.5px dashed var(--success-text)", display: "flex", alignItems: "center", gap: 10 }}>
              <TagIcon s={20} c="var(--success-text)" />
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: "var(--success-text)" }}>{coupon.code} applied</p>
                <p style={{ margin: 0, fontSize: 12, color: "var(--success-text)" }}>You save {inr(off)} on this ride</p>
              </div>
              <button onClick={() => setCoupon(null)} aria-label="Remove coupon" style={iconBtn}><XIcon s={18} c="var(--success-text)" /></button>
            </div>
          ) : (
            <>
              <form onSubmit={(e) => { e.preventDefault(); apply(); }} style={{ display: "flex", gap: 8 }}>
                <input value={code} onChange={(e) => { setCode(e.target.value.toUpperCase()); setErr(""); }} placeholder="Enter coupon code" aria-label="Coupon code" style={{ ...field, flex: 1, textTransform: "uppercase" }} />
                <button type="submit" disabled={!code.trim()} className="press" style={{ border: "none", borderRadius: 14, padding: "0 18px", fontWeight: 700, fontSize: 14, cursor: "pointer", background: code.trim() ? "var(--blue)" : "var(--line-strong)", color: code.trim() ? "white" : "var(--ink-mute)" }}>Apply</button>
              </form>
              {err && <p style={{ margin: "6px 2px 0", fontSize: 12, color: "var(--error-text)" }}>{err}</p>}
              <div className="no-scroll" style={{ display: "flex", gap: 8, overflowX: "auto", marginTop: 10 }}>
                {COUPONS.filter((c) => c.active).map((c) => (
                  <button key={c.code} onClick={() => apply(c)} className="press" style={{ flexShrink: 0, textAlign: "left", border: "1.5px dashed var(--gold)", background: "var(--gold-tint)", borderRadius: 12, padding: "8px 12px", cursor: "pointer" }}>
                    <span style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "var(--gold-dark)" }}>{c.code}</span>
                    <span style={{ display: "block", fontSize: 11, color: "var(--ink-soft)" }}>{c.title}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* payment */}
        <div>
          <p style={{ margin: "0 2px 8px", fontSize: 13.5, fontWeight: 600 }}>Payment Method</p>
          <div style={{ ...card, padding: "4px 14px" }}>
            {PAYS.map(({ id, label: l, sub, Icon }, i) => {
              const on = id === pay;
              return (
                <button key={id} onClick={() => setPay(id)} aria-pressed={on} style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px 0", background: "none", border: "none",
                  borderTop: i ? "1px solid var(--line)" : "none", cursor: "pointer", textAlign: "left",
                }}>
                  <span style={{ width: 38, height: 38, borderRadius: 12, background: on ? "var(--blue-tint)" : "var(--bg-secondary)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon s={19} c={on ? "var(--blue)" : "var(--ink-soft)"} /></span>
                  <span style={{ flex: 1 }}>
                    <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{l}</span>
                    <span style={{ display: "block", fontSize: 11.5, color: "var(--ink-soft)" }}>{sub}</span>
                  </span>
                  <span style={{ width: 20, height: 20, borderRadius: "50%", border: on ? "6px solid var(--blue)" : "2px solid var(--line-strong)", transition: "border 0.15s" }} />
                </button>
              );
            })}
          </div>
        </div>

        {/* fare */}
        <div style={{ ...card, padding: "12px 16px", marginBottom: 8 }}>
          {row("Base fare", inr(v.base))}
          {row(`Distance (${booking.km} km × ₹${v.perKm})`, inr(distanceFare))}
          {row(`Time (~${booking.min} min)`, inr(timeFare))}
          {off > 0 && row(`Coupon ${coupon!.code}`, "− " + inr(off), false, "var(--success-text)")}
          <div style={{ borderTop: "1px dashed var(--line-strong)", margin: "6px 0" }} />
          {row("Total Fare", inr(total), true)}
        </div>
      </div>
      <Footer><PrimaryButton onClick={() => onConfirm(coupon, pay)}>Confirm Ride · {inr(total)}</PrimaryButton></Footer>
    </div>
  );
}

/* ───────────────────────── 4. Live tracking ───────────────────────── */

const LABEL: Record<string, string> = {
  Searching: "Finding your driver", Assigned: "Driver assigned", Arriving: "Driver is on the way",
  Arrived: "Driver has arrived", Started: "Enjoy your ride", Completed: "You've arrived",
};

const CANCEL_REASONS = ["Driver taking too long", "Changed my plans", "Booked by mistake", "Driver asked me to cancel", "Other"];

export function LiveRidePage({ ride, onBack, onCancel, onChat, onDemoNext, onShare }: {
  ride: ActiveRide; onBack: () => void; onCancel: (reason: string) => void; onChat: () => void; onDemoNext: () => void; onShare: () => void;
}) {
  const [asking, setAsking] = useState(false);
  const step = RIDE_STEPS.indexOf(ride.status);
  const v = vehicleById(ride.vehicle);
  const total = ride.fare - discountFor(ride.coupon, ride.fare);
  const searching = ride.status === "Searching";
  const mode = searching ? "route" : ride.status === "Started" || ride.status === "Completed" ? "trip" : "approach";
  const progress = ride.status === "Arrived" ? 1 : ride.progress;
  const eta = ride.status === "Started" ? Math.max(1, Math.round(ride.min * (1 - ride.progress))) : Math.max(1, Math.round(ride.eta * (1 - ride.progress)));

  return (
    <div style={{ minHeight: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ position: "relative" }}>
        <MapView mode={mode} progress={progress} height={searching ? 330 : 300} radius={0} nearby={searching}>
          {searching && (
            <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: 1, height: 1 }}>
              {[0, 0.6, 1.2].map((d) => <span key={d} className="ripple" style={{ position: "absolute", left: -60, top: -60, width: 120, height: 120, borderRadius: "50%", background: "rgba(11,92,255,0.22)", animationDelay: `${d}s` }} />)}
            </div>
          )}
        </MapView>
        <button onClick={onBack} aria-label="Back" className="press" style={{ ...iconBtn, position: "absolute", top: 16, left: 16, width: 40, height: 40, borderRadius: "50%", background: "white", justifyContent: "center", boxShadow: "var(--shadow-md)" }}>
          <BackIcon c="var(--ink)" />
        </button>
        {!searching && (
          <span style={{ position: "absolute", top: 20, right: 16, background: "white", borderRadius: 999, padding: "6px 12px", fontSize: 12, fontWeight: 700, color: "var(--ink)", boxShadow: "var(--shadow-md)" }}>
            {ride.status === "Arrived" ? "At pickup" : `${eta} min · ${ride.status === "Started" ? "to drop" : "away"}`}
          </span>
        )}
        <button onClick={onShare} className="press" aria-label="SOS" style={{ position: "absolute", right: 16, bottom: 32, border: "none", borderRadius: 999, background: "var(--red)", color: "white", fontSize: 12, fontWeight: 800, padding: "7px 13px", cursor: "pointer", boxShadow: "0 4px 12px rgba(224,49,49,0.35)", display: "flex", alignItems: "center", gap: 5 }}>
          <ShieldIcon s={14} c="white" w={2.2} /> SOS
        </button>
      </div>

      <div style={{ flex: 1, marginTop: -20, position: "relative", background: "var(--app-bg)", borderRadius: "22px 22px 0 0", padding: "8px 16px 24px" }}>
        <div style={{ width: 40, height: 4, borderRadius: 4, background: "var(--line-strong)", margin: "0 auto 12px" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--ink)" }}>{LABEL[ride.status]}</p>
          <StatusBadge status={ride.status} />
        </div>

        {/* progress bar across the 6 lifecycle steps */}
        <div style={{ display: "flex", gap: 4, margin: "10px 0 14px" }}>
          {RIDE_STEPS.slice(0, 5).map((s, i) => (
            <span key={s} style={{ flex: 1, height: 4, borderRadius: 4, background: i < step ? "var(--blue)" : i === step ? "var(--blue-soft)" : "var(--line-strong)" }} />
          ))}
        </div>

        {searching ? (
          <div style={{ ...card, padding: 16, textAlign: "center" }}>
            <div className="spin" style={{ width: 34, height: 34, margin: "0 auto", borderRadius: "50%", border: "3.5px solid var(--blue-tint)", borderTopColor: "var(--blue)" }} />
            <p style={{ margin: "12px 0 2px", fontSize: 14.5, fontWeight: 600 }}>Connecting you to nearby {v.name} drivers</p>
            <p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-soft)" }}>This usually takes under a minute</p>
          </div>
        ) : (
          <>
            {/* driver */}
            <div style={{ ...card, padding: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Avatar initials={ride.driver.initials} size={50} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{ride.driver.name}</p>
                  <p style={{ margin: "1px 0 0", fontSize: 12, color: "var(--ink-soft)" }}>★ {ride.driver.rating} · {ride.driver.trips.toLocaleString("en-IN")} trips</p>
                  <p style={{ margin: "1px 0 0", fontSize: 12, color: "var(--ink-soft)" }}>{ride.driver.model}</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <VehicleArt kind={ride.vehicle} size={60} />
                  <p style={{ margin: "2px 0 0", fontSize: 12, fontWeight: 800, color: "var(--ink)", background: "var(--gold-tint)", border: "1px solid var(--gold-100)", borderRadius: 6, padding: "2px 6px", letterSpacing: "0.03em", whiteSpace: "nowrap" }}>{ride.driver.plate}</p>
                </div>
              </div>
              {(ride.status === "Assigned" || ride.status === "Arriving" || ride.status === "Arrived") && (
                <div style={{ marginTop: 12, borderRadius: 12, background: "var(--blue-tint)", padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12.5, color: "var(--info-text)", fontWeight: 500 }}>Share this OTP to start the ride</span>
                  <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: "0.25em", color: "var(--blue-dark)" }}>{ride.otp}</span>
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginTop: 12 }}>
                {[
                  { l: "Call", I: PhoneIcon, on: () => { window.location.href = "tel:" + ride.driver.phone.replace(/\s/g, ""); } },
                  { l: "Message", I: ChatIcon, on: onChat },
                  { l: "Share Trip", I: ShareIcon, on: onShare },
                ].map(({ l, I, on }) => (
                  <button key={l} onClick={on} className="press" style={{ border: "none", background: "var(--bg-secondary)", borderRadius: 12, padding: "10px 0", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <I s={19} c="var(--blue)" />
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--ink)" }}>{l}</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* route + fare */}
        <div style={{ ...card, padding: 14, marginTop: 12 }}>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, paddingTop: 5 }}>
              <span style={dot("var(--green)")} />
              <span style={{ width: 2, flex: 1, background: "repeating-linear-gradient(var(--line-strong) 0 4px, transparent 4px 7px)" }} />
              <span style={dot("var(--red)", true)} />
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
              <div><p style={{ margin: 0, fontSize: 11, color: "var(--ink-mute)", fontWeight: 600 }}>PICKUP</p><p style={{ margin: 0, fontSize: 13.5, fontWeight: 600 }}>{ride.from.name}</p></div>
              <div><p style={{ margin: 0, fontSize: 11, color: "var(--ink-mute)", fontWeight: 600 }}>DROP</p><p style={{ margin: 0, fontSize: 13.5, fontWeight: 600 }}>{ride.to.name}</p></div>
            </div>
          </div>
          <div style={{ borderTop: "1px solid var(--line)", marginTop: 12, paddingTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>{ride.pay} · {v.name}</span>
            <span style={{ fontSize: 17, fontWeight: 800 }}>{inr(total)}</span>
          </div>
        </div>

        {step < 4 && (
          <button onClick={() => setAsking(true)} className="press" style={{ width: "100%", marginTop: 12, background: "var(--surface)", color: "var(--red)", border: "none", borderRadius: 16, padding: 14, fontSize: 14.5, fontWeight: 600, cursor: "pointer" }}>
            Cancel Ride
          </button>
        )}
        <div style={{ textAlign: "center", marginTop: 14 }}><DemoButton onClick={onDemoNext}>skip to next step</DemoButton></div>
      </div>

      {asking && (
        <Sheet onClose={() => setAsking(false)}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <AlertIcon s={22} c="var(--red)" />
            <p style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Cancel this ride?</p>
          </div>
          <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "var(--ink-soft)" }}>
            {step >= 2 ? `A cancellation fee of ${inr(v.cancelFee)} may apply as the driver is already on the way.` : "No cancellation fee — no driver has started towards you yet."}
          </p>
          {CANCEL_REASONS.map((r) => (
            <button key={r} onClick={() => onCancel(r)} className="press" style={{ width: "100%", textAlign: "left", background: "var(--bg-secondary)", border: "none", borderRadius: 12, padding: "12px 14px", marginBottom: 8, fontSize: 14, fontWeight: 500, color: "var(--ink)", cursor: "pointer" }}>{r}</button>
          ))}
          <PrimaryButton tone="ghost" onClick={() => setAsking(false)}>Keep my ride</PrimaryButton>
        </Sheet>
      )}
    </div>
  );
}

/** Bottom sheet over a dimmed backdrop. */
export function Sheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 150, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <div onClick={onClose} className="fade-up" style={{ position: "absolute", inset: 0, background: "rgba(15,23,41,0.45)" }} />
      <div className="slide-up" style={{ position: "relative", background: "var(--app-bg)", borderRadius: "24px 24px 0 0", padding: "10px 18px calc(20px + env(safe-area-inset-bottom))", maxHeight: "85%", overflowY: "auto" }}>
        <div style={{ width: 40, height: 4, borderRadius: 4, background: "var(--line-strong)", margin: "0 auto 14px" }} />
        {children}
      </div>
    </div>
  );
}

/* ───────────────────────── 5. Payment + rating ───────────────────────── */

const TAGS = ["Clean vehicle", "Polite driver", "Safe driving", "On time", "Good music", "Smooth route"];

export function TripDonePage({ ride, onDone, onReceipt }: { ride: ActiveRide; onDone: (stars: number) => void; onReceipt: () => void }) {
  const total = ride.fare - discountFor(ride.coupon, ride.fare);
  const cash = ride.pay === "Cash";
  const [paid, setPaid] = useState<"no" | "busy" | "yes">(ride.pay === "Wallet" ? "yes" : "no");
  const [stars, setStars] = useState(0);
  const [tags, setTags] = useState<string[]>([]);

  // Cash: the driver confirms collection on their side a moment later.
  useEffect(() => {
    if (!cash || paid !== "no") return;
    const t = setTimeout(() => setPaid("yes"), 3500);
    return () => clearTimeout(t);
  }, [cash, paid]);

  const payNow = () => { setPaid("busy"); setTimeout(() => setPaid("yes"), 1500); };

  return (
    <div style={{ minHeight: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "30px 16px 0", textAlign: "center" }}>
        <div className="fade-up" style={{ width: 76, height: 76, margin: "0 auto", borderRadius: "50%", background: "linear-gradient(135deg,#34c38f,var(--green))", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 10px 24px rgba(47,158,118,0.35)" }}>
          <CheckIcon s={38} c="white" w={3} />
        </div>
        <p style={{ margin: "14px 0 0", fontSize: 22, fontWeight: 800 }}>Trip Completed!</p>
        <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--ink-soft)" }}>{ride.from.name} → {ride.to.name}</p>
        <p style={{ margin: "14px 0 0", fontSize: 38, fontWeight: 800, letterSpacing: "-0.02em" }}>{inr(total)}</p>
        <p style={{ margin: "4px 0 0", fontSize: 13, fontWeight: 600, color: paid === "yes" ? "var(--success-text)" : "var(--warning-text)" }}>
          {paid === "yes" ? `✓ Paid Successfully · ${ride.pay}` : cash ? `Please pay ${inr(total)} in cash to your driver` : paid === "busy" ? "Processing payment…" : `Payment pending · ${ride.pay}`}
        </p>
      </div>

      <div style={{ padding: "18px 16px 0", flex: 1 }}>
        <div style={{ ...card, padding: "16px 14px", textAlign: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", marginBottom: 10 }}>
            <Avatar initials={ride.driver.initials} size={38} />
            <div style={{ textAlign: "left" }}><p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Rate {ride.driver.name}</p><p style={{ margin: 0, fontSize: 11.5, color: "var(--ink-soft)" }}>{ride.driver.model} · {ride.driver.plate}</p></div>
          </div>
          <Stars value={stars} onChange={setStars} size={34} />
          {stars > 0 && (
            <div className="fade-up" style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 14 }}>
              {TAGS.map((t) => {
                const on = tags.includes(t);
                return (
                  <button key={t} onClick={() => setTags((x) => (on ? x.filter((y) => y !== t) : [...x, t]))} aria-pressed={on} style={{
                    padding: "7px 12px", borderRadius: 999, cursor: "pointer", fontSize: 12, fontWeight: 600,
                    background: on ? "var(--blue-tint)" : "var(--surface)", color: on ? "var(--blue)" : "var(--text-secondary)",
                    border: on ? "1.5px solid var(--blue)" : "1.5px solid var(--line)",
                  }}>{t}</button>
                );
              })}
            </div>
          )}
        </div>
        <button onClick={onReceipt} style={{ display: "block", margin: "14px auto 0", background: "none", border: "none", color: "var(--blue)", fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}>View Receipt</button>
      </div>

      <Footer>
        {paid !== "yes" && !cash
          ? <PrimaryButton onClick={payNow} disabled={paid === "busy"}>{paid === "busy" ? "Processing…" : `Pay ${inr(total)} with ${ride.pay}`}</PrimaryButton>
          : <PrimaryButton onClick={() => onDone(stars)} disabled={paid !== "yes"}>{stars ? "Submit Rating" : "Done"}</PrimaryButton>}
      </Footer>
    </div>
  );
}
