"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlarmIcon, AlertIcon, BackIcon, BriefcaseIcon, CardIcon, CashIcon, ChatIcon, CheckIcon, ChevronRight, ClockIcon, ExpandIcon, HomeIcon, PhoneIcon,
  PinIcon, ShareIcon, ShieldIcon, SwapIcon, TagIcon, UpiIcon, UserIcon, WalletIcon,
} from "../icons";
import MapView from "../MapView";
import VehicleArt, { AnyArt, ParcelArt, RentalArt } from "../VehicleArt";
import { Avatar, ErrorText, Footer, LoadState, PageHeader, PrimaryButton, Stars, StatusBadge, card, field, iconBtn } from "../ui";
import { PARCEL_TYPES, RIDE_STEPS, inr, vehicleById, type PayMethod, type VehicleKind } from "../../lib/data";
import {
  activeCoupons, bookRide, cancelRide, closeRide, isIndianMobile, newKey, payRide, quote as fetchQuote, rateRide, rideLabel,
  type CouponRow, type FareLine, type Place, type Quote, type QuoteOption, type RideView,
} from "../../lib/api";
import type { RideOption } from "./types";

const dot = (color: string, square = false): React.CSSProperties => ({
  width: 10, height: 10, borderRadius: square ? 2 : "50%", background: color, flexShrink: 0,
  boxShadow: `0 0 0 3px ${color === "var(--green)" ? "rgba(47,158,118,0.18)" : "rgba(224,49,49,0.18)"}`,
});

/* ───────────────────────── 1. Set location ───────────────────────── */

export function SearchPage({ places, initialTo, onBack, onDone }: { places: Place[]; initialTo?: Place; onBack: () => void; onDone: (from: Place, to: Place) => void }) {
  const current = places.find((p) => p.kind === "current") ?? places[0];
  const [from, setFrom] = useState<Place>(current);
  const [to, setTo] = useState<Place | null>(initialTo ?? null);
  const [focus, setFocus] = useState<"from" | "to">("to");
  const [q, setQ] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const list = useMemo(() => {
    const all = focus === "from" ? places : places.filter((p) => p.kind !== "current");
    const t = q.trim().toLowerCase();
    return t ? all.filter((p) => (p.name + p.address).toLowerCase().includes(t)) : all;
  }, [q, focus, places]);

  const pick = (p: Place) => {
    setErr(null);
    if (focus === "from") {
      if (to && p.id === to.id) { setErr("Pickup and drop can't be the same place."); return; }
      setFrom(p); setFocus("to"); setQ(""); if (to) onDone(p, to);
    } else {
      if (p.id === from.id) { setErr("Pickup and drop can't be the same place."); return; }
      setTo(p); setQ(""); onDone(from, p);
    }
  };

  const input = (which: "from" | "to") => {
    const on = focus === which;
    const val = which === "from" ? from : to;
    return (
      <input
        value={on ? q : val?.name ?? ""}
        onFocus={() => { setFocus(which); setQ(""); }}
        onChange={(e) => setQ(e.target.value.slice(0, 60))}
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
        <ErrorText msg={err} />

        <p style={{ margin: "20px 2px 6px", fontSize: 12, fontWeight: 600, color: "var(--ink-mute)", letterSpacing: "0.06em" }}>
          {q ? "RESULTS" : focus === "from" ? "CHOOSE PICKUP" : "SAVED & RECENT"}
        </p>
        <div style={{ ...card, padding: "4px 14px", marginBottom: 24 }}>
          {list.map((p, i) => {
            const Icon = p.kind === "current" ? PinIcon : p.kind === "home" ? HomeIcon : p.kind === "work" ? BriefcaseIcon : p.kind === "recent" ? ClockIcon : PinIcon;
            return (
              <button key={p.id} onClick={() => pick(p)} className="press" style={{
                width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "13px 0", background: "none", border: "none",
                borderTop: i ? "1px solid var(--line)" : "none", cursor: "pointer", textAlign: "left",
              }}>
                <span style={{ width: 36, height: 36, borderRadius: "50%", background: p.kind === "current" ? "var(--blue-tint)" : "var(--bg-secondary)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon s={17} c={p.kind === "current" ? "var(--blue)" : "var(--ink-soft)"} />
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
      </div>
    </div>
  );
}

/* ───────────────────────── 2. Choose ride ───────────────────────── */

const PAYS: { id: PayMethod; label: string; sub: string; Icon: typeof CardIcon }[] = [
  { id: "Cash", label: "Cash", sub: "Pay the driver at drop", Icon: CashIcon },
  { id: "UPI", label: "UPI", sub: "GPay, PhonePe, Paytm", Icon: UpiIcon },
  { id: "Card", label: "Credit / Debit Card", sub: "Pay after the trip", Icon: CardIcon },
  { id: "Wallet", label: "DriveWay Wallet", sub: "Uses your wallet balance", Icon: WalletIcon },
];

const RENTAL_CARS: VehicleKind[] = ["mini", "sedan", "suv"];
const ORDER: RideOption[] = ["any", "bike", "auto", "erick", "mini", "sedan", "rental", "taxi", "suv", "parcel"];

/** Next few half-hour slots (≥ 30 min ahead) for "schedule for later", as [label, ISO]. */
function slots(): [string, string][] {
  const out: [string, string][] = [];
  const t = new Date();
  t.setMinutes(t.getMinutes() < 30 ? 30 : 60, 0, 0);
  t.setMinutes(t.getMinutes() + 30);
  const fmt = (d: Date) => d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  for (let i = 0; i < 6; i++) { out.push([`${t.toDateString() === new Date().toDateString() ? "Today" : "Tomorrow"}, ${fmt(t)}`, t.toISOString()]); t.setMinutes(t.getMinutes() + 30); }
  for (const h of [8, 9]) { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(h, 0, 0, 0); out.push([`Tomorrow, ${fmt(d)}`, d.toISOString()]); }
  return out;
}

export function ChooseRidePage({ from, to, prefer, initialCoupon, initialAc = true, onAcChange, onBack, onEditRoute, onBooked, onParcel }: {
  from: Place; to: Place; prefer?: RideOption; initialCoupon: string | null; initialAc?: boolean; onAcChange?: (ac: boolean) => void;
  onBack: () => void; onEditRoute: () => void; onBooked: (scheduled: boolean) => void;
  onParcel: (x: { quote: Quote; pay: PayMethod; coupon: string | null }) => void;
}) {
  const [sel, setSel] = useState<RideOption>(prefer ?? "any");
  const [ac, setAcState] = useState(initialAc);
  const setAc = (v: boolean) => { setAcState(v); onAcChange?.(v); };
  const [pay, setPay] = useState<PayMethod>("Cash");
  const [coupon, setCoupon] = useState<string | null>(initialCoupon);
  const [when, setWhen] = useState<[string, string] | null>(null);
  const [passenger, setPassenger] = useState<{ name: string; phone: string } | null>(null);
  const [rental, setRental] = useState<{ pkg: string; car: VehicleKind }>({ pkg: "r2", car: "mini" });
  const [sheet, setSheet] = useState<null | "pay" | "coupon" | "who" | "when" | "rental" | "fare">(null);
  const [bigMap, setBigMap] = useState(false);
  const [q, setQ] = useState<Quote | null>(null);
  const [qErr, setQErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [bookErr, setBookErr] = useState<string | null>(null);
  const idem = useRef(newKey());                         // one key per booking attempt → retries never double-book
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let live = true;
    setQErr(null);
    fetchQuote(from.id, to.id, ac, coupon).then((x) => { if (live) setQ(x); }, (e) => { if (live) setQErr((e as Error).message); });
    return () => { live = false; };
  }, [from.id, to.id, ac, coupon, reload]);

  if (!q) return <><PageHeader title="Choose a ride" onBack={onBack} /><LoadState error={qErr} onRetry={() => setReload((n) => n + 1)} label="Getting prices…" /></>;

  const opt = (id: VehicleKind) => q.options.find((o) => o.id === id);
  const rentalQ = q.rentals.find((r) => r.pkg === rental.pkg && r.car === rental.car);
  const pick = (o: RideOption): { fare: number; discount: number; available: boolean; eta: number; lines: FareLine[] | null; coupon: QuoteOption["coupon"]; cancel: number } => {
    if (o === "any") return { fare: q.any?.fare ?? 0, discount: q.any?.discount ?? 0, available: q.any_available > 0 && !!q.any, eta: Math.min(...(["mini", "sedan", "suv"] as const).map((k) => opt(k)?.eta ?? 9)), lines: q.any?.lines ?? null, coupon: q.any?.coupon ?? null, cancel: q.any?.cancel_fee ?? 0 };
    if (o === "rental") return { fare: rentalQ?.fare ?? 0, discount: rentalQ?.discount ?? 0, available: (rentalQ?.available ?? 0) > 0, eta: opt(rental.car)?.eta ?? 5, lines: null, coupon: rentalQ?.coupon ?? null, cancel: opt(rental.car)?.cancel_fee ?? 0 };
    if (o === "parcel") { const p = q.parcels[0]; return { fare: p?.fare ?? 0, discount: p?.discount ?? 0, available: (p?.available ?? 0) > 0, eta: opt("bike")?.eta ?? 3, lines: null, coupon: p?.coupon ?? null, cancel: 0 }; }
    const x = opt(o);
    return { fare: x?.fare ?? 0, discount: x?.discount ?? 0, available: (x?.available ?? 0) > 0, eta: x?.eta ?? 5, lines: x?.lines ?? null, coupon: x?.coupon ?? null, cancel: x?.cancel_fee ?? 0 };
  };
  const cur = pick(sel);
  const isParcel = sel === "parcel";
  const nameOf = (o: RideOption) => (o === "any" ? "Book Any" : o === "rental" ? "Hourly Rental" : o === "parcel" ? "Parcel" : vehicleById(o).name);
  const visible = ORDER.filter((o) => o === "any" || o === "rental" || o === "parcel" || !!opt(o as VehicleKind));

  const book = async () => {
    if (busy) return;
    if (isParcel) { onParcel({ quote: q, pay: pay === "Card" ? "UPI" : pay, coupon }); return; }
    setBusy(true); setBookErr(null);
    try {
      await bookRide({
        option: sel, from: from.id, to: to.id, ac, pay, coupon, when: when?.[1] ?? null, passenger,
        rental: sel === "rental" ? rental : undefined, idem: idem.current,
      });
      onBooked(!!when);
    } catch (e) {
      setBookErr((e as Error).message);
      idem.current = newKey();
    } finally { setBusy(false); }
  };

  const art = (o: RideOption, size = 58) =>
    o === "any" ? <AnyArt size={size} /> : o === "rental" ? <RentalArt size={size} /> : o === "parcel" ? <ParcelArt size={size} /> : <VehicleArt kind={o} size={size} />;

  const barBtn: React.CSSProperties = { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "none", border: "none", cursor: "pointer", padding: "6px 4px", fontSize: 14.5, fontWeight: 500, color: "var(--ink)", minWidth: 0 };
  const PayIcon = PAYS.find((x) => x.id === pay)!.Icon;
  const couponState = coupon ? cur.coupon : null;

  return (
    <div style={{ minHeight: "100%", display: "flex", flexDirection: "column", background: "var(--surface)" }}>
      {/* ── map ── */}
      <div style={{ position: "relative" }}>
        <MapView mode="route" height={bigMap ? 520 : 290} radius={0} />
        <button onClick={onBack} aria-label="Back" className="press" style={{ ...iconBtn, position: "absolute", top: 16, left: 16, width: 46, height: 46, borderRadius: "50%", background: "white", justifyContent: "center", boxShadow: "var(--shadow-lg)" }}>
          <BackIcon c="var(--ink)" />
        </button>
        <button onClick={() => setBigMap((x) => !x)} aria-label={bigMap ? "Shrink map" : "Expand map"} className="press" style={{ ...iconBtn, position: "absolute", right: 16, bottom: 18, width: 44, height: 44, borderRadius: "50%", background: "white", justifyContent: "center", boxShadow: "var(--shadow-lg)" }}>
          <ExpandIcon s={18} c="var(--ink)" />
        </button>
        <span style={{ position: "absolute", left: 16, bottom: 18, background: "var(--ink)", color: "white", fontSize: 12, fontWeight: 600, padding: "5px 11px", borderRadius: 999 }}>{q.km} km · {q.mins} min</span>
      </div>

      {/* ── pickup / drop + when ── */}
      <div style={{ position: "relative", background: "var(--surface)", borderRadius: "14px 14px 0 0", marginTop: -8, boxShadow: "0 -4px 14px rgba(15,23,41,0.08)", borderBottom: "1px solid var(--line)" }}>
        <button onClick={onEditRoute} style={{ width: "100%", display: "flex", gap: 14, padding: "14px 96px 14px 18px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
          <span style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 6 }}>
            <span style={{ width: 11, height: 11, borderRadius: "50%", background: "#43a047" }} />
            <span style={{ width: 2, flex: 1, background: "var(--line-strong)", margin: "4px 0" }} />
            <span style={{ width: 11, height: 11, borderRadius: "50%", background: "var(--red)" }} />
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 15, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", padding: "2px 0 12px", borderBottom: "1px solid var(--line)" }}>{from.name}, {from.address}</span>
            <span style={{ display: "block", fontSize: 15, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", paddingTop: 12 }}>{to.name}, {to.address}</span>
          </span>
        </button>
        <button onClick={() => setSheet("when")} className="press" style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", width: 72, padding: "10px 4px", borderRadius: 12, border: "none", background: "white", boxShadow: "0 2px 10px rgba(15,23,41,0.14)", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <AlarmIcon s={24} c={when ? "var(--blue)" : "var(--ink)"} />
          <span style={{ fontSize: 13, fontWeight: 600, color: when ? "var(--blue)" : "var(--ink)", lineHeight: 1.15, textAlign: "center" }}>{when ? when[0].replace(/^(Today|Tomorrow), /, "") : "Now"}</span>
        </button>
      </div>

      {/* ── AC / Non-AC ── */}
      <div style={{ padding: "12px 14px 10px" }}>
        <p style={{ margin: "0 2px 8px", fontSize: 13, fontWeight: 600, color: "var(--ink-soft)" }}>Choose AC or Non-AC vehicle</p>
        <div role="radiogroup" aria-label="AC or Non-AC vehicle" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[true, false].map((v) => {
            const on = ac === v;
            return (
              <button key={String(v)} role="radio" aria-checked={on} onClick={() => setAc(v)} className="press" style={{
                display: "flex", alignItems: "center", gap: 10, padding: "11px 12px", borderRadius: 14, cursor: "pointer", textAlign: "left",
                border: on ? `2px solid ${v ? "var(--blue)" : "var(--ink)"}` : "2px solid var(--line)",
                background: on ? (v ? "var(--blue-tint)" : "var(--bg-secondary)") : "var(--surface)",
              }}>
                <span style={{ width: 34, height: 34, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, background: v ? "#dbeafe" : "#fde68a" }}>{v ? "❄️" : "🌬️"}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 15, fontWeight: 700, color: on ? (v ? "var(--blue)" : "var(--ink)") : "var(--ink)" }}>{v ? "AC" : "Non-AC"}</span>
                  <span style={{ display: "block", fontSize: 11.5, color: "var(--ink-soft)" }}>{v ? "Cool & comfortable" : "Cheaper car fares"}</span>
                </span>
                <span style={{ width: 18, height: 18, borderRadius: "50%", flexShrink: 0, border: on ? `5px solid ${v ? "var(--blue)" : "var(--ink)"}` : "2px solid var(--line-strong)" }} />
              </button>
            );
          })}
        </div>
      </div>

      {/* ── ride options ── */}
      <div style={{ flex: 1 }}>
        {visible.map((o) => {
          const on = o === sel;
          const p = pick(o);
          const ok = p.available;
          const v = o === "any" || o === "rental" || o === "parcel" ? null : opt(o);
          const tag = o === "any" ? "Mini, Sedan or XL — whichever is nearest"
            : o === "rental" ? "Rides at hourly packages"
            : o === "parcel" ? "Same-day city delivery"
            : v!.tagline;
          const rowAc = (o === "any" || o === "rental" || v?.ac) ? ac : false;
          const row = (
            <button key={o} disabled={!ok} aria-pressed={on} onClick={() => { setSel(o); if (o === "rental") setSheet("rental"); }} style={{
              width: "100%", display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", border: "none", textAlign: "left",
              cursor: ok ? "pointer" : "not-allowed", opacity: ok ? 1 : 0.55,
              background: on ? "var(--blue-tint)" : "transparent", boxShadow: on ? "inset 4px 0 0 var(--blue)" : "none",
            }}>
              <span style={{ width: 70, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                {art(o)}
                <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>{ok ? `${p.eta} min` : "no drivers"}</span>
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 17, fontWeight: 600, color: "var(--ink)" }}>
                  {nameOf(o)}
                  {o !== "parcel" && <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 5, background: rowAc ? "var(--info-bg)" : "var(--surface-dim)", color: rowAc ? "var(--info-text)" : "var(--text-muted)" }}>{rowAc ? "❄ AC" : "NON-AC"}</span>}
                </span>
                <span style={{ display: "block", fontSize: 13, color: "var(--ink-soft)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {!ok ? "No drivers nearby right now" : o === "rental" && on && rentalQ ? `${rentalQ.hours} hr · ${rentalQ.km} km · ${vehicleById(rental.car).name}` : tag}
                </span>
              </span>
              {ok && (o === "rental"
                ? <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>{on ? inr(p.fare - p.discount) : ""}<ChevronRight s={18} c="var(--ink)" /></span>
                : <span style={{ textAlign: "right" }}>
                    <span style={{ display: "block", fontSize: 15.5, fontWeight: 700, color: "var(--ink)" }}>{o === "parcel" ? "from " : ""}{inr(p.fare - p.discount)}</span>
                    {p.discount > 0 && <span style={{ display: "block", fontSize: 11, color: "var(--ink-mute)", textDecoration: "line-through" }}>{inr(p.fare)}</span>}
                    {v?.ac && !p.discount && <span style={{ display: "block", fontSize: 11, color: "var(--ink-mute)" }}>{ac ? "Non-AC" : "AC"} {inr(v.alt_fare)}</span>}
                    {v && !v.ac && <span style={{ display: "inline-flex", alignItems: "center", gap: 2, fontSize: 11.5, color: "var(--ink-mute)" }}><UserIcon s={11} c="var(--ink-mute)" />{v.seats}</span>}
                  </span>)}
            </button>
          );
          return o === "parcel"
            ? <div key={o} style={{ margin: "10px 14px 6px", borderRadius: 12, overflow: "hidden", border: "1px solid var(--line)", boxShadow: "var(--shadow-sm)" }}>{row}</div>
            : <div key={o} style={{ borderTop: "1px solid var(--line)" }}>{row}</div>;
        })}
        <button onClick={() => setSheet("fare")} style={{ display: "block", margin: "6px auto 14px", background: "none", border: "none", color: "var(--blue)", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>Fares are estimates · View fare details</button>
      </div>

      {/* ── payment · coupon · who + book ── */}
      <div style={{ position: "sticky", bottom: 0, zIndex: 20, background: "var(--surface)", borderTop: "1px solid var(--line)", padding: "8px 14px calc(12px + env(safe-area-inset-bottom))", boxShadow: "0 -6px 16px rgba(15,23,41,0.06)" }}>
        {couponState && !couponState.ok && <p style={{ margin: "0 2px 6px", fontSize: 12, color: "var(--error-text)" }}>{coupon}: {couponState.reason} <button onClick={() => setCoupon(null)} style={{ border: "none", background: "none", color: "var(--blue)", fontWeight: 700, cursor: "pointer" }}>Remove</button></p>}
        <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
          <button onClick={() => setSheet("pay")} style={barBtn}><PayIcon s={22} c="#43a047" /> {pay}</button>
          <span style={{ width: 1, height: 26, background: "var(--line-strong)" }} />
          <button onClick={() => setSheet("coupon")} style={{ ...barBtn, color: couponState?.ok ? "var(--success-text)" : "var(--ink)" }}><TagIcon s={21} c="#43a047" /> <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{coupon ?? "Coupon"}</span></button>
          <span style={{ width: 1, height: 26, background: "var(--line-strong)" }} />
          <button onClick={() => setSheet("who")} style={barBtn}><UserIcon s={21} c="var(--ink-soft)" /> <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{passenger ? passenger.name.split(" ")[0] : "Myself"}</span></button>
        </div>
        <ErrorText msg={bookErr} />
        <PrimaryButton onClick={() => void book()} disabled={busy || !cur.available || (!!couponState && !couponState.ok)}>
          {busy ? "Booking…" : isParcel ? "Continue to Parcel details" : `${when ? "Schedule" : "Book"} ${sel === "any" ? "Any" : sel === "rental" ? "Rental" : nameOf(sel)} · ${inr(cur.fare - cur.discount)}`}
        </PrimaryButton>
      </div>

      {/* ── sheets ── */}
      {sheet === "pay" && (
        <Sheet onClose={() => setSheet(null)}>
          <p style={sheetTitle}>Payment method</p>
          <div style={{ ...card, padding: "4px 14px" }}>
            {PAYS.map(({ id, label: l, sub, Icon }, i) => {
              const on = id === pay;
              return (
                <button key={id} onClick={() => { setPay(id); setSheet(null); }} aria-pressed={on} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px 0", background: "none", border: "none", borderTop: i ? "1px solid var(--line)" : "none", cursor: "pointer", textAlign: "left" }}>
                  <span style={{ width: 38, height: 38, borderRadius: 12, background: on ? "var(--blue-tint)" : "var(--bg-secondary)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon s={19} c={on ? "var(--blue)" : "var(--ink-soft)"} /></span>
                  <span style={{ flex: 1 }}><span style={{ display: "block", fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{l}</span><span style={{ display: "block", fontSize: 11.5, color: "var(--ink-soft)" }}>{sub}</span></span>
                  <span style={{ width: 20, height: 20, borderRadius: "50%", border: on ? "6px solid var(--blue)" : "2px solid var(--line-strong)" }} />
                </button>
              );
            })}
          </div>
        </Sheet>
      )}
      {sheet === "coupon" && <CouponSheet current={coupon} onClose={() => setSheet(null)} onApply={(c) => { setCoupon(c); setSheet(null); }} />}
      {sheet === "who" && <PassengerSheet current={passenger} onClose={() => setSheet(null)} onPick={(p) => { setPassenger(p); setSheet(null); }} />}
      {sheet === "when" && (
        <Sheet onClose={() => setSheet(null)}>
          <p style={sheetTitle}>When do you need a ride?</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[null, ...slots()].map((t) => {
              const on = (t?.[1] ?? null) === (when?.[1] ?? null);
              return <button key={t?.[1] ?? "now"} onClick={() => { setWhen(t); setSheet(null); }} aria-pressed={on} style={{ ...chip(on), padding: "11px 10px" }}>{t?.[0] ?? "Now"}</button>;
            })}
          </div>
          <p style={{ margin: "12px 0 0", fontSize: 12, color: "var(--ink-soft)", textAlign: "center" }}>Scheduled rides start looking for a driver 15 minutes before pickup.</p>
        </Sheet>
      )}
      {sheet === "rental" && (
        <Sheet onClose={() => setSheet(null)}>
          <p style={sheetTitle}>Hourly Rental</p>
          <p style={{ margin: "-6px 0 12px", fontSize: 12.5, color: "var(--ink-soft)" }}>Keep the car with you for multiple stops. Extra km and time are charged at the package rate.</p>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            {RENTAL_CARS.filter((c) => opt(c)).map((c) => (
              <button key={c} onClick={() => setRental((r) => ({ ...r, car: c }))} aria-pressed={rental.car === c} style={{ ...chip(rental.car === c), flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "8px 4px" }}>
                <VehicleArt kind={c} size={46} />{vehicleById(c).name}
              </button>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {q.rentals.filter((r) => r.car === rental.car).map((pk) => {
              const on = pk.pkg === rental.pkg;
              return (
                <button key={pk.pkg} onClick={() => setRental((r) => ({ ...r, pkg: pk.pkg }))} aria-pressed={on} style={{ ...chip(on), textAlign: "left", padding: "12px" }}>
                  <span style={{ display: "block", fontSize: 15, fontWeight: 700 }}>{pk.hours} hr · {pk.km} km</span>
                  <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: "var(--ink)", marginTop: 2 }}>{inr(pk.fare)}</span>
                  <span style={{ display: "block", fontSize: 11, color: "var(--ink-soft)", fontWeight: 500 }}>+₹{pk.extra_km}/km · +₹{pk.extra_hour}/hr</span>
                </button>
              );
            })}
          </div>
          <div style={{ marginTop: 14 }}><PrimaryButton onClick={() => setSheet(null)}>Select {rentalQ?.hours} hr package · {inr(rentalQ?.fare ?? 0)}</PrimaryButton></div>
        </Sheet>
      )}
      {sheet === "fare" && (() => {
        const r = (l: string, val: string, strong = false) => <div key={l} style={{ display: "flex", justifyContent: "space-between", fontSize: strong ? 15 : 13.5, fontWeight: strong ? 700 : 500, color: strong ? "var(--ink)" : "var(--ink-soft)", padding: "4px 0" }}><span>{l}</span><span>{val}</span></div>;
        const money = (n: number) => (n < 0 ? "− " + inr(-n) : inr(n));
        return (
          <Sheet onClose={() => setSheet(null)}>
            <p style={sheetTitle}>Fare details · {nameOf(sel)}</p>
            <div style={{ ...card, padding: "12px 16px" }}>
              {sel === "rental" ? r(`${rentalQ?.hours} hr / ${rentalQ?.km} km package`, inr(cur.fare))
                : sel === "parcel" ? r("Bike delivery, up to 1 kg", inr(cur.fare))
                : cur.lines?.map((l) => r(l.label, money(l.amount)))}
              {cur.discount > 0 && r(`Coupon ${coupon}`, "− " + inr(cur.discount))}
              <div style={{ borderTop: "1px dashed var(--line-strong)", margin: "6px 0" }} />
              {r("Estimated total", inr(cur.fare - cur.discount), true)}
            </div>
            <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.5 }}>Waiting time after 3 free minutes is added at the end. Cancelling after a driver is on the way: {inr(cur.cancel)}.</p>
          </Sheet>
        );
      })()}
    </div>
  );
}

const sheetTitle: React.CSSProperties = { margin: "0 0 12px", fontSize: 18, fontWeight: 700, color: "var(--ink)" };
const chip = (on: boolean): React.CSSProperties => ({
  borderRadius: 12, cursor: "pointer", fontSize: 13, fontWeight: 600,
  background: on ? "var(--blue-tint)" : "var(--surface)", color: on ? "var(--blue)" : "var(--text-secondary)",
  border: on ? "1.5px solid var(--blue)" : "1.5px solid var(--line)",
});

/** Pick or type a coupon. Eligibility (vehicle, fare, day, expiry, limits) is checked by the server's quote. */
function CouponSheet({ current, onClose, onApply }: { current: string | null; onClose: () => void; onApply: (c: string | null) => void }) {
  const [code, setCode] = useState("");
  const [list, setList] = useState<CouponRow[]>([]);
  useEffect(() => { activeCoupons().then(setList, () => setList([])); }, []);
  const valid = /^[A-Z0-9]{3,20}$/.test(code.trim());
  return (
    <Sheet onClose={onClose}>
      <p style={sheetTitle}>Apply coupon</p>
      <form onSubmit={(e) => { e.preventDefault(); if (valid) onApply(code.trim()); }} style={{ display: "flex", gap: 8 }}>
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20))} placeholder="Enter coupon code" aria-label="Coupon code" style={{ ...field, flex: 1, textTransform: "uppercase" }} />
        <button type="submit" disabled={!valid} className="press" style={{ border: "none", borderRadius: 14, padding: "0 18px", fontWeight: 700, fontSize: 14, cursor: "pointer", background: valid ? "var(--blue)" : "var(--line-strong)", color: valid ? "white" : "var(--ink-mute)" }}>Apply</button>
      </form>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
        {list.map((c) => {
          const on = current === c.code;
          return (
            <button key={c.code} onClick={() => onApply(on ? null : c.code)} className="press" style={{ textAlign: "left", border: `1.5px dashed ${on ? "var(--success-text)" : "var(--gold)"}`, background: on ? "var(--success)" : "var(--gold-tint)", borderRadius: 12, padding: "10px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}>
              <TagIcon s={18} c={on ? "var(--success-text)" : "var(--gold-dark)"} />
              <span style={{ flex: 1 }}>
                <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: on ? "var(--success-text)" : "var(--gold-dark)" }}>{c.code}</span>
                <span style={{ display: "block", fontSize: 11.5, color: "var(--ink-soft)" }}>{c.title} · {c.body}</span>
              </span>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: on ? "var(--red)" : "var(--blue)" }}>{on ? "Remove" : "Apply"}</span>
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}

function PassengerSheet({ current, onClose, onPick }: { current: { name: string; phone: string } | null; onClose: () => void; onPick: (p: { name: string; phone: string } | null) => void }) {
  const [other, setOther] = useState(!!current);
  const [name, setName] = useState(current?.name ?? "");
  const [phone, setPhone] = useState(current?.phone ?? "");
  const ok = name.trim().length > 0 && isIndianMobile(phone);
  return (
    <Sheet onClose={onClose}>
      <p style={sheetTitle}>Who is riding?</p>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => onPick(null)} aria-pressed={!other} style={{ ...chip(!other), flex: 1, padding: 12 }}>Myself</button>
        <button onClick={() => setOther(true)} aria-pressed={other} style={{ ...chip(other), flex: 1, padding: 12 }}>Someone else</button>
      </div>
      {other && (
        <form onSubmit={(e) => { e.preventDefault(); if (ok) onPick({ name: name.trim(), phone }); }} style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
          <input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="Rider's name" aria-label="Rider's name" style={field} />
          <input value={phone} inputMode="numeric" onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="Rider's mobile number" aria-label="Rider's mobile number" style={field} />
          {phone.length === 10 && !isIndianMobile(phone) && <ErrorText msg="Indian mobile numbers start with 6, 7, 8 or 9." />}
          <p style={{ margin: 0, fontSize: 12, color: "var(--ink-soft)" }}>Share the driver details and ride OTP with them once the driver is assigned.</p>
          <PrimaryButton type="submit" disabled={!ok}>Book for {name.trim().split(" ")[0] || "them"}</PrimaryButton>
        </form>
      )}
    </Sheet>
  );
}

/* ───────────────────────── 3. Parcel details ───────────────────────── */

export function ParcelPage({ from, to, quote: q, pay: initialPay, coupon, onBack, onBooked }: {
  from: Place; to: Place; quote: Quote; pay: PayMethod; coupon: string | null; onBack: () => void; onBooked: () => void;
}) {
  const [type, setType] = useState("Documents");
  const [weight, setWeight] = useState<"light" | "medium" | "heavy">("light");
  const [receiver, setReceiver] = useState({ name: "", phone: "" });
  const [note, setNote] = useState("");
  const [agree, setAgree] = useState(false);
  const [pay, setPay] = useState<PayMethod>(initialPay);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const idem = useRef(newKey());
  const w = q.parcels.find((x) => x.id === weight)!;
  const ok = receiver.name.trim() && isIndianMobile(receiver.phone) && agree && w.available > 0;
  const confirm = async () => {
    if (!ok || busy) return;
    setBusy(true); setErr(null);
    try {
      await bookRide({ option: "parcel", from: from.id, to: to.id, ac: false, pay, coupon, when: null,
        parcel: { type, weight, receiver: { name: receiver.name.trim(), phone: receiver.phone }, note: note.trim() }, idem: idem.current });
      onBooked();
    } catch (e) { setErr((e as Error).message); idem.current = newKey(); } finally { setBusy(false); }
  };
  return (
    <div style={{ minHeight: "100%", display: "flex", flexDirection: "column" }}>
      <PageHeader title="Send a Parcel" sub={`${q.km} km · delivered in ~${q.mins + 5} min`} onBack={onBack} />
      <div style={{ padding: "0 16px 8px", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ ...card, padding: 14, display: "flex", gap: 12 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, paddingTop: 5 }}>
            <span style={dot("var(--green)")} />
            <span style={{ width: 2, flex: 1, background: "repeating-linear-gradient(var(--line-strong) 0 4px, transparent 4px 7px)" }} />
            <span style={dot("var(--red)", true)} />
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
            <div><p style={capLabel}>PICK UP FROM</p><p style={{ margin: 0, fontSize: 13.5, fontWeight: 600 }}>{from.name}, {from.address}</p></div>
            <div><p style={capLabel}>DELIVER TO</p><p style={{ margin: 0, fontSize: 13.5, fontWeight: 600 }}>{to.name}, {to.address}</p></div>
          </div>
        </div>

        <div>
          <p style={secLabel}>Receiver details</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <input value={receiver.name} maxLength={80} onChange={(e) => setReceiver((r) => ({ ...r, name: e.target.value }))} placeholder="Receiver's name" aria-label="Receiver's name" style={field} />
            <input value={receiver.phone} inputMode="numeric" onChange={(e) => setReceiver((r) => ({ ...r, phone: e.target.value.replace(/\D/g, "").slice(0, 10) }))} placeholder="Receiver's mobile number" aria-label="Receiver's mobile number" style={field} />
            {receiver.phone.length === 10 && !isIndianMobile(receiver.phone) && <ErrorText msg="Indian mobile numbers start with 6, 7, 8 or 9." />}
          </div>
        </div>

        <div>
          <p style={secLabel}>What are you sending?</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {PARCEL_TYPES.map((t) => <button key={t} onClick={() => setType(t)} aria-pressed={type === t} style={{ ...chip(type === t), padding: "8px 13px" }}>{t}</button>)}
          </div>
        </div>

        <div>
          <p style={secLabel}>Package weight</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {q.parcels.map((x) => {
              const on = x.id === weight;
              return (
                <button key={x.id} onClick={() => setWeight(x.id)} aria-pressed={on} disabled={x.available === 0} className="press" style={{ ...card, display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", cursor: x.available ? "pointer" : "not-allowed", opacity: x.available ? 1 : 0.55, textAlign: "left", border: on ? "1.5px solid var(--blue)" : "1.5px solid transparent", background: on ? "var(--blue-tint)" : "var(--surface)" }}>
                  <VehicleArt kind={x.vehicle} size={48} />
                  <span style={{ flex: 1 }}>
                    <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>{x.label} <span style={{ fontWeight: 500, color: "var(--ink-soft)", fontSize: 12 }}>· by {vehicleById(x.vehicle).name}</span></span>
                    <span style={{ display: "block", fontSize: 12, color: "var(--ink-soft)" }}>{x.available ? x.sub : "No partners nearby right now"}</span>
                  </span>
                  <span style={{ fontSize: 15, fontWeight: 800, color: "var(--ink)" }}>{inr(x.fare - x.discount)}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p style={secLabel}>Instructions for the delivery partner <span style={{ fontWeight: 400, color: "var(--ink-mute)" }}>(optional)</span></p>
          <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 160))} rows={2} placeholder="e.g. Hand over at the security desk, call on arrival" aria-label="Instructions" style={{ ...field, resize: "none" }} />
        </div>

        <div>
          <p style={secLabel}>Payment</p>
          <div style={{ display: "flex", gap: 8 }}>
            {(["Cash", "UPI", "Wallet"] as PayMethod[]).map((m) => <button key={m} onClick={() => setPay(m)} aria-pressed={pay === m} style={{ ...chip(pay === m), flex: 1, padding: 11 }}>{m === "Cash" ? "Cash at pickup" : m}</button>)}
          </div>
        </div>

        <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 12.5, color: "var(--ink-soft)", lineHeight: 1.5, cursor: "pointer" }}>
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} style={{ marginTop: 3, width: 18, height: 18, accentColor: "var(--blue)" }} />
          <span>The package doesn&apos;t contain prohibited items — alcohol, drugs, cash, jewellery, weapons or hazardous goods — and is packed safely.</span>
        </label>
        <ErrorText msg={err} />
      </div>
      <Footer>
        <PrimaryButton disabled={!ok || busy} onClick={() => void confirm()}>{busy ? "Booking…" : `Book Parcel · ${inr(w.fare - w.discount)}`}</PrimaryButton>
      </Footer>
    </div>
  );
}

const capLabel: React.CSSProperties = { margin: 0, fontSize: 11, color: "var(--ink-mute)", fontWeight: 600 };
const secLabel: React.CSSProperties = { margin: "0 2px 8px", fontSize: 13.5, fontWeight: 600, color: "var(--ink)" };

/* ───────────────────────── 4. Live tracking ───────────────────────── */

const LABEL: Record<string, string> = {
  Searching: "Finding your driver", Arriving: "Driver is on the way",
  Arrived: "Driver has arrived", Started: "Enjoy your ride", Completed: "You've arrived", NoDrivers: "No drivers available",
};

const PARCEL_LABEL: Record<string, string> = {
  Searching: "Finding a delivery partner", Arriving: "Partner is coming for pickup",
  Arrived: "Partner is at pickup", Started: "Package is on the way", Completed: "Package delivered", NoDrivers: "No delivery partners available",
};

const CANCEL_REASONS = ["Driver taking too long", "Changed my plans", "Booked by mistake", "Driver asked me to cancel", "Other"];

const initials = (n: string) => n.split(/\s+/).map((s) => s[0]).join("").slice(0, 2).toUpperCase();

/** Seconds since an ISO time, ticking every second. */
function useSince(iso: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  return iso ? Math.max(0, (now - new Date(iso).getTime()) / 1000) : 0;
}

export function LiveRidePage({ ride, onBack, onCancelled, onChat, onShare, onRetry, onDismiss }: {
  ride: RideView; onBack: () => void; onCancelled: () => void; onChat: () => void; onShare: () => void; onRetry: () => void; onDismiss: () => void;
}) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const step = RIDE_STEPS.indexOf(ride.status);
  const v = vehicleById(ride.vehicle);
  const searching = ride.status === "Searching";
  const none = ride.status === "NoDrivers";
  const parcel = ride.service === "parcel";
  const sinceAssign = useSince(ride.assigned_at);
  const sinceStart = useSince(ride.started_at);
  const sinceSearch = useSince(ride.created_at);
  const approachSec = 5 * 60;
  const progress = ride.status === "Arrived" ? 1 : ride.status === "Started" ? Math.min(0.97, sinceStart / (ride.mins * 60)) : Math.min(0.95, sinceAssign / approachSec);
  const motion = ride.status === "Started" && ride.started_at ? { since: ride.started_at, seconds: ride.mins * 60, max: 0.97 }
    : ride.status === "Arriving" && ride.assigned_at ? { since: ride.assigned_at, seconds: approachSec, max: 0.95 } : undefined;
  const mode = searching || none ? "route" : ride.status === "Started" || ride.status === "Completed" ? "trip" : "approach";
  const eta = ride.status === "Started" ? Math.max(1, Math.round((ride.mins * 60 - sinceStart) / 60)) : Math.max(1, Math.round((approachSec - sinceAssign) / 60));

  const cancel = async (reason: string) => {
    if (busy) return;
    setBusy(true); setErr(null);
    try { await cancelRide(ride.id, reason); onCancelled(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <div style={{ minHeight: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ position: "relative" }}>
        <MapView mode={mode} progress={progress} motion={motion} height={searching ? 330 : 300} radius={0} nearby={searching}>
          {searching && (
            <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: 1, height: 1 }}>
              {[0, 0.6, 1.2].map((d) => <span key={d} className="ripple" style={{ position: "absolute", left: -60, top: -60, width: 120, height: 120, borderRadius: "50%", background: "rgba(11,92,255,0.22)", animationDelay: `${d}s` }} />)}
            </div>
          )}
        </MapView>
        <button onClick={onBack} aria-label="Back" className="press" style={{ ...iconBtn, position: "absolute", top: 16, left: 16, width: 40, height: 40, borderRadius: "50%", background: "white", justifyContent: "center", boxShadow: "var(--shadow-md)" }}>
          <BackIcon c="var(--ink)" />
        </button>
        {!searching && !none && ride.status !== "Completed" && (
          <span style={{ position: "absolute", top: 20, right: 16, background: "white", borderRadius: 999, padding: "6px 12px", fontSize: 12, fontWeight: 700, color: "var(--ink)", boxShadow: "var(--shadow-md)" }}>
            {ride.status === "Arrived" ? "At pickup" : `~${eta} min · ${ride.status === "Started" ? "to drop" : "away"}`}
          </span>
        )}
        <button onClick={onShare} className="press" aria-label="SOS" style={{ position: "absolute", right: 16, bottom: 32, border: "none", borderRadius: 999, background: "var(--red)", color: "white", fontSize: 12, fontWeight: 800, padding: "7px 13px", cursor: "pointer", boxShadow: "0 4px 12px rgba(224,49,49,0.4)", display: "flex", alignItems: "center", gap: 5 }}>
          <ShieldIcon s={14} c="white" w={2.2} /> SOS
        </button>
      </div>

      <div style={{ flex: 1, marginTop: -20, position: "relative", background: "var(--app-bg)", borderRadius: "22px 22px 0 0", padding: "8px 16px 24px" }}>
        <div style={{ width: 40, height: 4, borderRadius: 4, background: "var(--line-strong)", margin: "0 auto 12px" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--ink)" }}>{(parcel ? PARCEL_LABEL : LABEL)[ride.status]}</p>
          <StatusBadge status={ride.status} />
        </div>

        {!none && (
          <div style={{ display: "flex", gap: 4, margin: "10px 0 14px" }}>
            {RIDE_STEPS.slice(0, 4).map((s, i) => (
              <span key={s} style={{ flex: 1, height: 4, borderRadius: 4, background: i < step ? "var(--blue)" : i === step ? "var(--blue-soft)" : "var(--line-strong)" }} />
            ))}
          </div>
        )}

        {none ? (
          <div style={{ ...card, padding: 18, textAlign: "center", marginTop: 12 }}>
            <AlertIcon s={30} c="var(--warning-text)" />
            <p style={{ margin: "10px 0 4px", fontSize: 15, fontWeight: 700 }}>No {parcel ? "delivery partners" : `${ride.service === "any" ? "cars" : v.name + " drivers"}`} accepted in time</p>
            <p style={{ margin: "0 0 14px", fontSize: 12.5, color: "var(--ink-soft)" }}>You haven&apos;t been charged. Try again, or pick another vehicle type.</p>
            <div style={{ display: "flex", gap: 8 }}>
              <PrimaryButton tone="ghost" onClick={onDismiss}>Close</PrimaryButton>
              <PrimaryButton onClick={onRetry}>Try again</PrimaryButton>
            </div>
          </div>
        ) : searching ? (
          <div style={{ ...card, padding: 16, textAlign: "center" }}>
            <div className="spin" style={{ width: 34, height: 34, margin: "0 auto", borderRadius: "50%", border: "3.5px solid var(--blue-tint)", borderTopColor: "var(--blue)" }} />
            <p style={{ margin: "12px 0 2px", fontSize: 14.5, fontWeight: 600 }}>{parcel ? `Connecting you to a ${v.name.toLowerCase()} delivery partner` : ride.service === "any" ? "Connecting you to the nearest Mini, Sedan or XL" : `Connecting you to nearby ${v.name} drivers`}</p>
            <p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-soft)" }}>Searching for {Math.floor(sinceSearch / 60)}:{String(Math.floor(sinceSearch % 60)).padStart(2, "0")} · we&apos;ll stop after {Math.round(ride.search_timeout_sec / 60 * 10) / 10} min</p>
            {ride.otp && <p style={{ margin: "10px 0 0", fontSize: 12.5, color: "var(--info-text)" }}>Your ride OTP: <b style={{ letterSpacing: "0.2em" }}>{ride.otp}</b></p>}
          </div>
        ) : ride.driver && (
          <div style={{ ...card, padding: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Avatar initials={initials(ride.driver.name)} size={50} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{ride.driver.name}</p>
                <p style={{ margin: "1px 0 0", fontSize: 12, color: "var(--ink-soft)" }}>{ride.driver.rating ? `★ ${ride.driver.rating}` : "New driver"} · {ride.driver.trips.toLocaleString("en-IN")} trips</p>
                <p style={{ margin: "1px 0 0", fontSize: 12, color: "var(--ink-soft)" }}>{ride.driver.model}</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <VehicleArt kind={ride.vehicle} size={60} />
                <p style={{ margin: "2px 0 0", fontSize: 12, fontWeight: 800, color: "var(--ink)", background: "var(--gold-tint)", border: "1px solid var(--gold-100)", borderRadius: 6, padding: "2px 6px", letterSpacing: "0.03em", whiteSpace: "nowrap" }}>{ride.driver.plate}</p>
              </div>
            </div>
            {ride.otp && (ride.status === "Arriving" || ride.status === "Arrived") && (
              <div style={{ marginTop: 12, borderRadius: 12, background: "var(--blue-tint)", padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12.5, color: "var(--info-text)", fontWeight: 500 }}>{parcel ? "Share this OTP with the partner at pickup" : ride.passenger ? `Share this OTP with ${ride.passenger.name.split(" ")[0]}` : "Share this OTP to start the ride"}</span>
                <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: "0.25em", color: "var(--blue-dark)" }}>{ride.otp}</span>
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginTop: 12 }}>
              {[
                { l: "Call", I: PhoneIcon, on: () => { if (ride.driver?.phone) window.location.href = "tel:+" + ride.driver.phone.replace(/\D/g, ""); } },
                { l: "Message", I: ChatIcon, on: onChat },
                { l: "Share Trip", I: ShareIcon, on: onShare },
              ].map(({ l, I, on }) => (
                <button key={l} onClick={on} disabled={l === "Call" && !ride.driver?.phone} className="press" style={{ border: "none", background: "var(--bg-secondary)", borderRadius: 12, padding: "10px 0", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <I s={19} c="var(--blue)" />
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--ink)" }}>{l}</span>
                </button>
              ))}
            </div>
          </div>
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
              <div><p style={capLabel}>PICKUP</p><p style={{ margin: 0, fontSize: 13.5, fontWeight: 600 }}>{ride.from.name}</p></div>
              <div><p style={capLabel}>{parcel ? `DELIVER TO · ${ride.parcel?.receiver.name}` : "DROP"}</p><p style={{ margin: 0, fontSize: 13.5, fontWeight: 600 }}>{ride.to.name}</p></div>
            </div>
          </div>
          {parcel && ride.parcel && (
            <p style={{ margin: "10px 0 0", fontSize: 12.5, color: "var(--ink-soft)", background: "var(--bg-secondary)", borderRadius: 10, padding: "8px 10px" }}>
              📦 {ride.parcel.type} · {ride.parcel.weight_label}{ride.parcel.note ? ` · “${ride.parcel.note}”` : ""}
            </p>
          )}
          <div style={{ borderTop: "1px solid var(--line)", marginTop: 12, paddingTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>{ride.pay} · {rideLabel(ride, v.name)}</span>
            <span style={{ fontSize: 17, fontWeight: 800 }}>{inr(ride.fare - ride.discount)}</span>
          </div>
        </div>

        {(searching || ride.status === "Arriving" || ride.status === "Arrived") && (
          <button onClick={() => setAsking(true)} className="press" style={{ width: "100%", marginTop: 12, background: "var(--surface)", color: "var(--red)", border: "none", borderRadius: 16, padding: 14, fontSize: 14.5, fontWeight: 600, cursor: "pointer", boxShadow: "var(--shadow-card)" }}>
            Cancel Ride
          </button>
        )}
      </div>

      {asking && (
        <Sheet onClose={() => setAsking(false)}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <AlertIcon s={22} c="var(--red)" />
            <p style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Cancel this ride?</p>
          </div>
          <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "var(--ink-soft)" }}>
            {ride.cancel_fee_now > 0 ? `A cancellation fee of ${inr(ride.cancel_fee_now)} will be charged — the driver is already on the way.` : "No cancellation fee — no driver has started towards you yet."}
          </p>
          {CANCEL_REASONS.map((r) => (
            <button key={r} disabled={busy} onClick={() => void cancel(r)} className="press" style={{ width: "100%", textAlign: "left", background: "var(--bg-secondary)", border: "none", borderRadius: 12, padding: "12px 14px", marginBottom: 8, fontSize: 14, fontWeight: 500, color: "var(--ink)", cursor: busy ? "wait" : "pointer" }}>{r}</button>
          ))}
          <ErrorText msg={err} />
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
const PARCEL_TAGS = ["On-time delivery", "Handled with care", "Polite partner", "Kept me updated"];
const ONLINE: Exclude<PayMethod, "Cash">[] = ["UPI", "Card", "Wallet"];

export function TripDonePage({ ride, walletBalance, onDone, onReceipt }: { ride: RideView; walletBalance: number; onDone: () => void; onReceipt: () => void }) {
  const cash = ride.pay === "Cash";
  const paid = ride.payment_status === "paid";
  const [method, setMethod] = useState<Exclude<PayMethod, "Cash">>(cash ? "UPI" : (ride.pay as Exclude<PayMethod, "Cash">));
  const [stars, setStars] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const pay = async () => {
    if (busy) return;
    setBusy(true); setErr(null);
    try { await payRide(ride.id, method); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const finish = async () => {
    if (busy) return;
    setBusy(true); setErr(null);
    try { if (stars) await rateRide(ride.id, stars, tags); else await closeRide(ride.id); onDone(); } catch (e) { setErr((e as Error).message); setBusy(false); }
  };
  const line = (l: string, v: string, strong = false) => <div style={{ display: "flex", justifyContent: "space-between", fontSize: strong ? 14.5 : 13, fontWeight: strong ? 700 : 500, color: strong ? "var(--ink)" : "var(--ink-soft)", padding: "2px 0" }}><span>{l}</span><span>{v}</span></div>;

  return (
    <div style={{ minHeight: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "30px 16px 0", textAlign: "center" }}>
        <div className="fade-up" style={{ width: 76, height: 76, margin: "0 auto", borderRadius: "50%", background: "linear-gradient(135deg,#34c38f,var(--green))", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 10px 24px rgba(47,158,118,0.35)" }}>
          <CheckIcon s={38} c="white" w={3} />
        </div>
        <p style={{ margin: "14px 0 0", fontSize: 22, fontWeight: 800 }}>{ride.service === "parcel" ? "Package Delivered!" : "Trip Completed!"}</p>
        <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--ink-soft)" }}>{ride.from.name} → {ride.to.name}</p>
        <p style={{ margin: "14px 0 0", fontSize: 38, fontWeight: 800, letterSpacing: "-0.02em" }}>{inr(ride.total)}</p>
        <p style={{ margin: "4px 0 0", fontSize: 13, fontWeight: 600, color: paid ? "var(--success-text)" : "var(--warning-text)" }}>
          {paid ? `✓ Paid · ${ride.pay}` : cash ? `Please pay ${inr(ride.total)} in cash — your driver will confirm` : `Payment due · ${inr(ride.total)}`}
        </p>
      </div>

      <div style={{ padding: "18px 16px 0", flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ ...card, padding: "12px 16px" }}>
          {line("Trip fare", inr(ride.fare))}
          {ride.wait_fee > 0 && line("Waiting charge", inr(ride.wait_fee))}
          {ride.discount > 0 && line(`Coupon ${ride.coupon ?? ""}`, "− " + inr(ride.discount))}
          {line("Total", inr(ride.total), true)}
        </div>

        {!paid && !cash && (
          <div style={{ ...card, padding: 14 }}>
            <p style={{ margin: "0 0 8px", fontSize: 13.5, fontWeight: 700 }}>Pay with</p>
            <div style={{ display: "flex", gap: 8 }}>
              {ONLINE.map((m) => <button key={m} onClick={() => { setMethod(m); setErr(null); }} aria-pressed={method === m} style={{ ...chip(method === m), flex: 1, padding: 10 }}>{m === "Wallet" ? `Wallet · ${inr(walletBalance)}` : m}</button>)}
            </div>
            <ErrorText msg={err} />
          </div>
        )}

        {paid && (
          <div style={{ ...card, padding: "16px 14px", textAlign: "center" }}>
            {ride.driver && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", marginBottom: 10 }}>
                <Avatar initials={initials(ride.driver.name)} size={38} />
                <div style={{ textAlign: "left" }}><p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Rate {ride.driver.name}</p><p style={{ margin: 0, fontSize: 11.5, color: "var(--ink-soft)" }}>{ride.driver.model} · {ride.driver.plate}</p></div>
              </div>
            )}
            <Stars value={stars} onChange={setStars} size={34} />
            {stars > 0 && (
              <div className="fade-up" style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 14 }}>
                {(ride.service === "parcel" ? PARCEL_TAGS : TAGS).map((t) => {
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
            <ErrorText msg={err} />
          </div>
        )}
        <button onClick={onReceipt} style={{ display: "block", margin: "0 auto", background: "none", border: "none", color: "var(--blue)", fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}>View Receipt</button>
      </div>

      <Footer>
        {!paid && !cash
          ? <PrimaryButton onClick={() => void pay()} disabled={busy}>{busy ? "Processing…" : `Pay ${inr(ride.total)} with ${method}`}</PrimaryButton>
          : <PrimaryButton onClick={() => void finish()} disabled={!paid || busy}>{!paid ? "Waiting for the driver to confirm cash…" : stars ? "Submit Rating" : "Done"}</PrimaryButton>}
      </Footer>
    </div>
  );
}
