"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlarmIcon, AlertIcon, BackIcon, BriefcaseIcon, CardIcon, CashIcon, ChatIcon, CheckIcon, ChevronRight, ClockIcon, ExpandIcon, HomeIcon, PhoneIcon,
  PinIcon, ShareIcon, ShieldIcon, SwapIcon, TagIcon, UpiIcon, UserIcon, WalletIcon,
} from "../icons";
import MapView from "../MapView";
import VehicleArt, { AnyArt, ParcelArt, RentalArt } from "../VehicleArt";
import { Avatar, DemoButton, Footer, PageHeader, PrimaryButton, Stars, StatusBadge, card, field, iconBtn } from "../ui";
import {
  COUPONS, CURRENT_LOCATION, NON_AC_FACTOR, PARCEL_TYPES, PARCEL_WEIGHTS, PLACES, RENTAL_PACKAGES, RIDE_STEPS, VEHICLES,
  discountFor, fareFor, inr, parcelFare, rentalPrice, tripEstimate, vehicleById,
  type Coupon, type ParcelWeight, type PayMethod, type Place, type RentalPackage, type VehicleKind,
} from "../../lib/data";
import { serviceLabel, type ActiveRide, type Booking, type RideOption } from "./types";

const VEHICLE_IDS = VEHICLES.map((v) => v.id);

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

/* ───────────────────────── 2. Choose ride (one screen: service, AC, payment, coupon, who, when) ───────────────────────── */

const PAYS: { id: PayMethod; label: string; sub: string; Icon: typeof CardIcon }[] = [
  { id: "Cash", label: "Cash", sub: "Pay the driver at drop", Icon: CashIcon },
  { id: "UPI", label: "UPI", sub: "GPay, PhonePe, Paytm", Icon: UpiIcon },
  { id: "Card", label: "Credit / Debit Card", sub: "Visa ending 4821", Icon: CardIcon },
  { id: "Wallet", label: "DriveWay Wallet", sub: "Balance ₹240", Icon: WalletIcon },
];

const ANY: VehicleKind[] = ["mini", "sedan", "suv"];
const RENTAL_CARS: VehicleKind[] = ["mini", "sedan", "suv"];
const ORDER: RideOption[] = ["any", "bike", "auto", "erick", "mini", "sedan", "rental", "taxi", "suv", "parcel"];

/** Next few half-hour slots for "schedule for later". */
function slots() {
  const out: string[] = [];
  const t = new Date();
  t.setMinutes(t.getMinutes() < 30 ? 30 : 60, 0, 0);
  t.setMinutes(t.getMinutes() + 30);
  for (let i = 0; i < 6; i++) { out.push(`Today, ${t.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}`); t.setMinutes(t.getMinutes() + 30); }
  return [...out, "Tomorrow, 8:00 am", "Tomorrow, 9:00 am"];
}

export type BookChoice = Omit<Booking, "from" | "to">;

export function ChooseRidePage({ from, to, prefer, initialCoupon, initialAc = true, onAcChange, onBack, onEditRoute, onBook, onParcel }: {
  from: Place; to: Place; prefer?: RideOption; initialCoupon: Coupon | null; initialAc?: boolean; onAcChange?: (ac: boolean) => void;
  onBack: () => void; onEditRoute: () => void; onBook: (b: BookChoice) => void;
  onParcel: (x: { km: number; min: number; pay: PayMethod; coupon: Coupon | null }) => void;
}) {
  const { km, min } = tripEstimate(from.id, to.id);
  const [sel, setSel] = useState<RideOption>(prefer ?? "any");
  const [ac, setAcState] = useState(initialAc);
  const setAc = (v: boolean) => { setAcState(v); onAcChange?.(v); };
  const [pay, setPay] = useState<PayMethod>("Cash");
  const [coupon, setCoupon] = useState<Coupon | null>(initialCoupon);
  const [when, setWhen] = useState<string | null>(null);
  const [passenger, setPassenger] = useState<{ name: string; phone: string } | null>(null);
  const [rental, setRental] = useState<{ pkg: RentalPackage; car: VehicleKind }>({ pkg: RENTAL_PACKAGES[1], car: "mini" });
  const [sheet, setSheet] = useState<null | "pay" | "coupon" | "who" | "when" | "rental" | "fare">(null);
  const [bigMap, setBigMap] = useState(false);

  const fareOf = (o: RideOption) => {
    if (o === "any") return Math.min(...ANY.map((k) => fareFor(vehicleById(k), km, min, 1, ac)));
    if (o === "rental") return rentalPrice(rental.pkg, rental.car, ac);
    if (o === "parcel") return parcelFare("light", km, min);
    return fareFor(vehicleById(o), km, min, 1, ac);
  };
  const etaOf = (o: RideOption) =>
    o === "any" ? Math.min(...ANY.map((k) => vehicleById(k).eta)) - 1
      : o === "rental" ? 2 : o === "parcel" ? vehicleById("bike").eta : vehicleById(o).eta;
  const available = (o: RideOption) => !VEHICLE_IDS.includes(o as VehicleKind) || vehicleById(o as VehicleKind).nearby > 0;

  const fare = fareOf(sel);
  const off = discountFor(coupon, fare);
  const isParcel = sel === "parcel";
  const nameOf = (o: RideOption) => (o === "any" ? "Book Any" : o === "rental" ? "Hourly Rental" : o === "parcel" ? "Parcel" : vehicleById(o).name);

  const book = () => {
    if (isParcel) { onParcel({ km, min, pay, coupon }); return; }
    const vehicle: VehicleKind = sel === "any" ? "mini" : sel === "rental" ? rental.car : sel;
    onBook({
      vehicle, service: sel === "any" ? "any" : sel === "rental" ? "rental" : "ride",
      ac: vehicleById(vehicle).ac ? ac : false,
      km: sel === "rental" ? rental.pkg.km : km, min: sel === "rental" ? rental.pkg.hours * 60 : min,
      fare, coupon, pay, when, passenger, rental: sel === "rental" ? rental.pkg : undefined,
    });
  };

  const art = (o: RideOption, size = 58) =>
    o === "any" ? <AnyArt size={size} /> : o === "rental" ? <RentalArt size={size} /> : o === "parcel" ? <ParcelArt size={size} /> : <VehicleArt kind={o} size={size} />;

  const barBtn: React.CSSProperties = { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "none", border: "none", cursor: "pointer", padding: "6px 4px", fontSize: 14.5, fontWeight: 500, color: "var(--ink)", minWidth: 0 };
  const PayIcon = PAYS.find((x) => x.id === pay)!.Icon;

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
        <span style={{ position: "absolute", left: 16, bottom: 18, background: "var(--ink)", color: "white", fontSize: 12, fontWeight: 600, padding: "5px 11px", borderRadius: 999 }}>{km} km · {min} min</span>
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
          <span style={{ fontSize: 13, fontWeight: 600, color: when ? "var(--blue)" : "var(--ink)", lineHeight: 1.15, textAlign: "center" }}>{when ? when.replace(/^(Today|Tomorrow), /, "") : "Now"}</span>
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
                  <span style={{ display: "block", fontSize: 11.5, color: "var(--ink-soft)" }}>{v ? "Cool & comfortable" : `Save ${Math.round((1 - NON_AC_FACTOR) * 100)}% on cars`}</span>
                </span>
                <span style={{ width: 18, height: 18, borderRadius: "50%", flexShrink: 0, border: on ? `5px solid ${v ? "var(--blue)" : "var(--ink)"}` : "2px solid var(--line-strong)" }} />
              </button>
            );
          })}
        </div>
      </div>

      {/* ── ride options ── */}
      <div style={{ flex: 1 }}>
        {ORDER.map((o) => {
          const on = o === sel;
          const ok = available(o);
          const v = VEHICLE_IDS.includes(o as VehicleKind) ? vehicleById(o as VehicleKind) : null;
          const tag = o === "any" ? `${ANY.map((k) => vehicleById(k).name).join(", ")}`
            : o === "rental" ? "Rides at hourly packages"
            : o === "parcel" ? "Same-day city delivery"
            : v!.tagline;
          const showAc = ok && o !== "parcel";
          const rowAc = (o === "any" || o === "rental" || v?.ac) ? ac : false;
          const row = (
            <button key={o} disabled={!ok} aria-pressed={on} onClick={() => { setSel(o); if (o === "rental") setSheet("rental"); }} style={{
              width: "100%", display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", border: "none", textAlign: "left",
              cursor: ok ? "pointer" : "not-allowed", opacity: ok ? 1 : 0.55,
              background: on ? "var(--blue-tint)" : "transparent", boxShadow: on ? "inset 4px 0 0 var(--blue)" : "none",
            }}>
              <span style={{ width: 70, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                {art(o)}
                <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>{ok ? `${etaOf(o)} min` : "no cabs"}</span>
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 17, fontWeight: 600, color: "var(--ink)" }}>
                  {nameOf(o)}
                  {showAc && <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 5, background: rowAc ? "var(--info-bg)" : "var(--surface-dim)", color: rowAc ? "var(--info-text)" : "var(--text-muted)" }}>{rowAc ? "❄ AC" : "NON-AC"}</span>}
                </span>
                {ok && <span style={{ display: "block", fontSize: 13, color: "var(--ink-soft)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{o === "rental" && on ? `${rental.pkg.hours} hr · ${rental.pkg.km} km · ${vehicleById(rental.car).name}` : tag}</span>}
              </span>
              {ok && (o === "rental"
                ? <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>{on ? inr(fareOf(o)) : ""}<ChevronRight s={18} c="var(--ink)" /></span>
                : <span style={{ textAlign: "right" }}>
                    <span style={{ display: "block", fontSize: 15.5, fontWeight: 700, color: "var(--ink)" }}>{o === "any" || o === "parcel" ? "from " : ""}{inr(fareOf(o))}</span>
                    {v?.ac
                      ? <span style={{ display: "block", fontSize: 11, color: "var(--ink-mute)" }}>{ac ? "Non-AC" : "AC"} {inr(fareFor(v, km, min, 1, !ac))}</span>
                      : v && <span style={{ display: "inline-flex", alignItems: "center", gap: 2, fontSize: 11.5, color: "var(--ink-mute)" }}><UserIcon s={11} c="var(--ink-mute)" />{v.seats}</span>}
                  </span>)}
            </button>
          );
          // Parcel sits in its own card, like a separate service.
          return o === "parcel"
            ? <div key={o} style={{ margin: "10px 14px 6px", borderRadius: 12, overflow: "hidden", border: "1px solid var(--line)", boxShadow: "var(--shadow-sm)" }}>{row}</div>
            : <div key={o} style={{ borderTop: "1px solid var(--line)" }}>{row}</div>;
        })}
        <button onClick={() => setSheet("fare")} style={{ display: "block", margin: "6px auto 14px", background: "none", border: "none", color: "var(--blue)", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>Fares are estimates · View fare details</button>
      </div>

      {/* ── payment · coupon · who + book ── */}
      <div style={{ position: "sticky", bottom: 0, zIndex: 20, background: "var(--surface)", borderTop: "1px solid var(--line)", padding: "8px 14px calc(12px + env(safe-area-inset-bottom))", boxShadow: "0 -6px 16px rgba(15,23,41,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
          <button onClick={() => setSheet("pay")} style={barBtn}><PayIcon s={22} c="#43a047" /> {pay === "Card" ? "Card" : pay}</button>
          <span style={{ width: 1, height: 26, background: "var(--line-strong)" }} />
          <button onClick={() => setSheet("coupon")} style={{ ...barBtn, color: coupon ? "var(--success-text)" : "var(--ink)" }}><TagIcon s={21} c="#43a047" /> <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{coupon ? coupon.code : "Coupon"}</span></button>
          <span style={{ width: 1, height: 26, background: "var(--line-strong)" }} />
          <button onClick={() => setSheet("who")} style={barBtn}><UserIcon s={21} c="var(--ink-soft)" /> <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{passenger ? passenger.name.split(" ")[0] : "Myself"}</span></button>
        </div>
        <PrimaryButton onClick={book}>
          {isParcel ? "Book Parcel" : `${when ? "Schedule" : "Book"} ${sel === "any" ? "Any" : sel === "rental" ? "Rental" : nameOf(sel)}`}{!isParcel && ` · ${inr(fare - off)}`}
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
      {sheet === "coupon" && <CouponSheet fare={fare} current={coupon} onClose={() => setSheet(null)} onApply={(c) => { setCoupon(c); setSheet(null); }} />}
      {sheet === "who" && <PassengerSheet current={passenger} onClose={() => setSheet(null)} onPick={(p) => { setPassenger(p); setSheet(null); }} />}
      {sheet === "when" && (
        <Sheet onClose={() => setSheet(null)}>
          <p style={sheetTitle}>When do you need a ride?</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[null, ...slots()].map((t) => {
              const on = t === when;
              return <button key={t ?? "now"} onClick={() => { setWhen(t); setSheet(null); }} aria-pressed={on} style={{ ...chip(on), padding: "11px 10px" }}>{t ?? "Now"}</button>;
            })}
          </div>
          <p style={{ margin: "12px 0 0", fontSize: 12, color: "var(--ink-soft)", textAlign: "center" }}>Scheduled rides are confirmed 15 minutes before pickup.</p>
        </Sheet>
      )}
      {sheet === "rental" && (
        <Sheet onClose={() => setSheet(null)}>
          <p style={sheetTitle}>Hourly Rental</p>
          <p style={{ margin: "-6px 0 12px", fontSize: 12.5, color: "var(--ink-soft)" }}>Keep the car with you for multiple stops. Extra km and time are charged at the package rate.</p>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            {RENTAL_CARS.map((c) => (
              <button key={c} onClick={() => setRental((r) => ({ ...r, car: c }))} aria-pressed={rental.car === c} style={{ ...chip(rental.car === c), flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "8px 4px" }}>
                <VehicleArt kind={c} size={46} />{vehicleById(c).name}
              </button>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {RENTAL_PACKAGES.map((pk) => {
              const on = pk.id === rental.pkg.id;
              return (
                <button key={pk.id} onClick={() => setRental((r) => ({ ...r, pkg: pk }))} aria-pressed={on} style={{ ...chip(on), textAlign: "left", padding: "12px" }}>
                  <span style={{ display: "block", fontSize: 15, fontWeight: 700 }}>{pk.hours} hr · {pk.km} km</span>
                  <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: "var(--ink)", marginTop: 2 }}>{inr(rentalPrice(pk, rental.car, ac))}</span>
                  <span style={{ display: "block", fontSize: 11, color: "var(--ink-soft)", fontWeight: 500 }}>+₹{pk.extraKm}/km · +₹{pk.extraHour}/hr</span>
                </button>
              );
            })}
          </div>
          <div style={{ marginTop: 14 }}><PrimaryButton onClick={() => setSheet(null)}>Select {rental.pkg.hours} hr package · {inr(rentalPrice(rental.pkg, rental.car, ac))}</PrimaryButton></div>
        </Sheet>
      )}
      {sheet === "fare" && (() => {
        const v = vehicleById(sel === "any" ? "mini" : sel === "rental" ? rental.car : sel === "parcel" ? "bike" : sel);
        const r = (l: string, val: string, strong = false) => <div key={l} style={{ display: "flex", justifyContent: "space-between", fontSize: strong ? 15 : 13.5, fontWeight: strong ? 700 : 500, color: strong ? "var(--ink)" : "var(--ink-soft)", padding: "4px 0" }}><span>{l}</span><span>{val}</span></div>;
        return (
          <Sheet onClose={() => setSheet(null)}>
            <p style={sheetTitle}>Fare details · {nameOf(sel)}</p>
            <div style={{ ...card, padding: "12px 16px" }}>
              {sel === "rental" ? r(`${rental.pkg.hours} hr / ${rental.pkg.km} km package`, inr(fare)) : <>
                {r("Base fare", inr(v.base))}
                {r(`Distance (${km} km × ₹${v.perKm})`, inr(v.perKm * km))}
                {r(`Ride time (~${min} min × ₹${v.perMin})`, inr(v.perMin * min))}
                {v.ac && !ac && r(`Non-AC discount (${Math.round((1 - NON_AC_FACTOR) * 100)}%)`, "applied")}
              </>}
              {off > 0 && r(`Coupon ${coupon!.code}`, "− " + inr(off))}
              <div style={{ borderTop: "1px dashed var(--line-strong)", margin: "6px 0" }} />
              {r("Estimated total", inr(fare - off), true)}
            </div>
            <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.5 }}>Tolls, parking and waiting time (after 3 free minutes) are added at the end. Cancellation after the driver starts: {inr(v.cancelFee)}.</p>
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

function CouponSheet({ fare, current, onClose, onApply }: { fare: number; current: Coupon | null; onClose: () => void; onApply: (c: Coupon | null) => void }) {
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const tryCode = () => {
    const hit = COUPONS.find((x) => x.code === code.trim().toUpperCase() && x.active);
    if (hit) onApply(hit); else setErr("That code isn't valid right now.");
  };
  return (
    <Sheet onClose={onClose}>
      <p style={sheetTitle}>Apply coupon</p>
      <form onSubmit={(e) => { e.preventDefault(); tryCode(); }} style={{ display: "flex", gap: 8 }}>
        <input value={code} onChange={(e) => { setCode(e.target.value.toUpperCase()); setErr(""); }} placeholder="Enter coupon code" aria-label="Coupon code" style={{ ...field, flex: 1, textTransform: "uppercase" }} />
        <button type="submit" disabled={!code.trim()} className="press" style={{ border: "none", borderRadius: 14, padding: "0 18px", fontWeight: 700, fontSize: 14, cursor: "pointer", background: code.trim() ? "var(--blue)" : "var(--line-strong)", color: code.trim() ? "white" : "var(--ink-mute)" }}>Apply</button>
      </form>
      {err && <p style={{ margin: "6px 2px 0", fontSize: 12, color: "var(--error-text)" }}>{err}</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
        {COUPONS.filter((c) => c.active).map((c) => {
          const on = current?.code === c.code;
          return (
            <button key={c.code} onClick={() => onApply(on ? null : c)} className="press" style={{ textAlign: "left", border: `1.5px dashed ${on ? "var(--success-text)" : "var(--gold)"}`, background: on ? "var(--success)" : "var(--gold-tint)", borderRadius: 12, padding: "10px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}>
              <TagIcon s={18} c={on ? "var(--success-text)" : "var(--gold-dark)"} />
              <span style={{ flex: 1 }}>
                <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: on ? "var(--success-text)" : "var(--gold-dark)" }}>{c.code}</span>
                <span style={{ display: "block", fontSize: 11.5, color: "var(--ink-soft)" }}>{c.title} · save {inr(discountFor(c, fare))}</span>
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
  return (
    <Sheet onClose={onClose}>
      <p style={sheetTitle}>Who is riding?</p>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => onPick(null)} aria-pressed={!other} style={{ ...chip(!other), flex: 1, padding: 12 }}>Myself</button>
        <button onClick={() => setOther(true)} aria-pressed={other} style={{ ...chip(other), flex: 1, padding: 12 }}>Someone else</button>
      </div>
      {other && (
        <form onSubmit={(e) => { e.preventDefault(); if (name.trim() && phone.length === 10) onPick({ name: name.trim(), phone }); }} style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Rider's name" aria-label="Rider's name" style={field} />
          <input value={phone} inputMode="numeric" onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="Rider's mobile number" aria-label="Rider's mobile number" style={field} />
          <p style={{ margin: 0, fontSize: 12, color: "var(--ink-soft)" }}>They'll get the driver details and ride OTP by SMS.</p>
          <PrimaryButton type="submit" disabled={!name.trim() || phone.length !== 10}>Book for {name.trim().split(" ")[0] || "them"}</PrimaryButton>
        </form>
      )}
    </Sheet>
  );
}

/* ───────────────────────── 3. Parcel details ───────────────────────── */

export function ParcelPage({ from, to, km, min, user, pay: initialPay, coupon, onBack, onConfirm }: {
  from: Place; to: Place; km: number; min: number; user: { name: string; phone: string };
  pay: PayMethod; coupon: Coupon | null; onBack: () => void;
  onConfirm: (b: BookChoice) => void;
}) {
  const [type, setType] = useState("Documents");
  const [weight, setWeight] = useState<ParcelWeight>("light");
  const [receiver, setReceiver] = useState({ name: "", phone: "" });
  const [note, setNote] = useState("");
  const [agree, setAgree] = useState(false);
  const [pay, setPay] = useState<PayMethod>(initialPay);
  const w = PARCEL_WEIGHTS.find((x) => x.id === weight)!;
  const fare = parcelFare(weight, km, min);
  const off = discountFor(coupon, fare);
  const ok = receiver.name.trim() && receiver.phone.length === 10 && agree;
  const sender = { name: user.name, phone: user.phone.replace(/\D/g, "").slice(-10) };

  return (
    <div style={{ minHeight: "100%", display: "flex", flexDirection: "column" }}>
      <PageHeader title="Send a Parcel" sub={`${km} km · delivered in ~${min + vehicleById(w.vehicle).eta} min`} onBack={onBack} />
      <div style={{ padding: "0 16px 8px", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ ...card, padding: 14, display: "flex", gap: 12 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, paddingTop: 5 }}>
            <span style={dot("var(--green)")} />
            <span style={{ width: 2, flex: 1, background: "repeating-linear-gradient(var(--line-strong) 0 4px, transparent 4px 7px)" }} />
            <span style={dot("var(--red)", true)} />
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
            <div><p style={capLabel}>PICK UP FROM · {sender.name}</p><p style={{ margin: 0, fontSize: 13.5, fontWeight: 600 }}>{from.name}, {from.address}</p></div>
            <div><p style={capLabel}>DELIVER TO</p><p style={{ margin: 0, fontSize: 13.5, fontWeight: 600 }}>{to.name}, {to.address}</p></div>
          </div>
        </div>

        <div>
          <p style={secLabel}>Receiver details</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <input value={receiver.name} onChange={(e) => setReceiver((r) => ({ ...r, name: e.target.value }))} placeholder="Receiver's name" aria-label="Receiver's name" style={field} />
            <input value={receiver.phone} inputMode="numeric" onChange={(e) => setReceiver((r) => ({ ...r, phone: e.target.value.replace(/\D/g, "").slice(0, 10) }))} placeholder="Receiver's mobile number" aria-label="Receiver's mobile number" style={field} />
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
            {PARCEL_WEIGHTS.map((x) => {
              const on = x.id === weight;
              return (
                <button key={x.id} onClick={() => setWeight(x.id)} aria-pressed={on} className="press" style={{ ...card, display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", cursor: "pointer", textAlign: "left", border: on ? "1.5px solid var(--blue)" : "1.5px solid transparent", background: on ? "var(--blue-tint)" : "var(--surface)" }}>
                  <VehicleArt kind={x.vehicle} size={48} />
                  <span style={{ flex: 1 }}>
                    <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>{x.label} <span style={{ fontWeight: 500, color: "var(--ink-soft)", fontSize: 12 }}>· by {vehicleById(x.vehicle).name}</span></span>
                    <span style={{ display: "block", fontSize: 12, color: "var(--ink-soft)" }}>{x.sub}</span>
                  </span>
                  <span style={{ fontSize: 15, fontWeight: 800, color: "var(--ink)" }}>{inr(parcelFare(x.id, km, min))}</span>
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
      </div>
      <Footer>
        <PrimaryButton disabled={!ok} onClick={() => onConfirm({
          vehicle: w.vehicle, service: "parcel", ac: false, km, min, fare, coupon, pay, when: null, passenger: null,
          parcel: { type, weight, sender, receiver: { name: receiver.name.trim(), phone: receiver.phone }, note: note.trim() },
        })}>Book Parcel · {inr(fare - off)}</PrimaryButton>
      </Footer>
    </div>
  );
}

const capLabel: React.CSSProperties = { margin: 0, fontSize: 11, color: "var(--ink-mute)", fontWeight: 600 };
const secLabel: React.CSSProperties = { margin: "0 2px 8px", fontSize: 13.5, fontWeight: 600, color: "var(--ink)" };

/* ───────────────────────── 4. Live tracking ───────────────────────── */

const LABEL: Record<string, string> = {
  Searching: "Finding your driver", Assigned: "Driver assigned", Arriving: "Driver is on the way",
  Arrived: "Driver has arrived", Started: "Enjoy your ride", Completed: "You've arrived",
};

const PARCEL_LABEL: Record<string, string> = {
  Searching: "Finding a delivery partner", Assigned: "Delivery partner assigned", Arriving: "Partner is coming for pickup",
  Arrived: "Partner is at pickup", Started: "Package is on the way", Completed: "Package delivered",
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
  const parcel = ride.service === "parcel";
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
          <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--ink)" }}>{(parcel ? PARCEL_LABEL : LABEL)[ride.status]}</p>
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
            <p style={{ margin: "12px 0 2px", fontSize: 14.5, fontWeight: 600 }}>{parcel ? `Connecting you to a ${v.name.toLowerCase()} delivery partner` : ride.service === "any" ? "Connecting you to the nearest Mini, Sedan or SUV" : `Connecting you to nearby ${v.name} drivers`}</p>
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
                  <span style={{ fontSize: 12.5, color: "var(--info-text)", fontWeight: 500 }}>{parcel ? "Share this OTP with the partner at pickup" : ride.passenger ? `OTP sent to ${ride.passenger.name.split(" ")[0]} by SMS` : "Share this OTP to start the ride"}</span>
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
              <div><p style={{ margin: 0, fontSize: 11, color: "var(--ink-mute)", fontWeight: 600 }}>{parcel ? `DELIVER TO · ${ride.parcel?.receiver.name}` : "DROP"}</p><p style={{ margin: 0, fontSize: 13.5, fontWeight: 600 }}>{ride.to.name}</p></div>
            </div>
          </div>
          {parcel && ride.parcel && (
            <p style={{ margin: "10px 0 0", fontSize: 12.5, color: "var(--ink-soft)", background: "var(--bg-secondary)", borderRadius: 10, padding: "8px 10px" }}>
              📦 {ride.parcel.type} · {PARCEL_WEIGHTS.find((w) => w.id === ride.parcel!.weight)!.label}{ride.parcel.note ? ` · “${ride.parcel.note}”` : ""}
            </p>
          )}
          <div style={{ borderTop: "1px solid var(--line)", marginTop: 12, paddingTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>{ride.pay} · {serviceLabel(ride, v.name)}</span>
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
const PARCEL_TAGS = ["On-time delivery", "Handled with care", "Polite partner", "Kept me updated"];

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
        <p style={{ margin: "14px 0 0", fontSize: 22, fontWeight: 800 }}>{ride.service === "parcel" ? "Package Delivered!" : "Trip Completed!"}</p>
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
