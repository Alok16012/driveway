"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, BellIcon, BriefcaseIcon, ChevronRight, ClockIcon, HomeIcon, SearchIcon, ShieldIcon, TargetIcon } from "../icons";
import { BrandMark, Wordmark } from "../Brand";
import MapView from "../MapView";
import VehicleArt, { AnyArt, ParcelArt, RentalArt } from "../VehicleArt";
import { iconBtn } from "../ui";
import { CURRENT_LOCATION, PLACES, vehicleById, type Place } from "../../lib/data";
import type { ActiveRide, RideOption } from "./types";

interface HomeProps {
  firstName: string;
  active: ActiveRide | null;
  unread: number;
  onSearch: (prefer?: RideOption) => void;
  ac: boolean;
  onAc: (ac: boolean) => void;
  onQuick: (to: Place) => void;
  onTrack: () => void;
  onOffers: () => void;
  onNotifications: () => void;
}

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
};

const STATUS_LINE: Record<string, string> = {
  Searching: "Finding a driver near you…",
  Assigned: "Driver assigned",
  Arriving: "Driver is on the way",
  Arrived: "Driver has arrived",
  Started: "Trip in progress",
  Completed: "Trip completed",
};

const SERVICES: RideOption[] = ["bike", "auto", "erick", "mini", "sedan", "suv", "any", "rental", "parcel"];

export default function HomeScreen(p: HomeProps) {
  const quick = PLACES.filter((x) => x.kind);
  return (
    <div style={{ paddingBottom: 24 }}>
      {/* ── Top bar ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px 10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <BrandMark size={34} />
          <Wordmark />
        </div>
        <button aria-label="Notifications" onClick={p.onNotifications} className="press" style={iconBtn}>
          <BellIcon s={25} c="var(--text-secondary)" w={1.7} />
          {p.unread > 0 && <span style={{ position: "absolute", top: 1, right: 2, width: 8, height: 8, borderRadius: "50%", background: "var(--red)", border: "1.5px solid var(--app-bg)" }} />}
        </button>
      </div>

      <div style={{ padding: "2px 16px 12px" }}>
        <p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-soft)", fontWeight: 500 }}>{greeting()}, {p.firstName} 👋</p>
        <p style={{ margin: 0, fontSize: 21, fontWeight: 700, color: "var(--ink)", letterSpacing: "-0.02em" }}>Where to today?</p>
      </div>

      {/* ── Map + where-to card ── */}
      <div style={{ padding: "0 16px" }}>
        <MapView height={190} radius={22}>
          <div style={{ position: "absolute", top: 12, left: 12, display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.95)", borderRadius: 999, padding: "6px 12px 6px 8px", boxShadow: "var(--shadow-md)" }}>
            <span style={{ width: 9, height: 9, borderRadius: "50%", background: "var(--green)", boxShadow: "0 0 0 3px rgba(47,158,118,0.2)" }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)" }}>{CURRENT_LOCATION.address}</span>
          </div>
          <span style={{ position: "absolute", right: 12, bottom: 12, width: 36, height: 36, borderRadius: "50%", background: "white", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "var(--shadow-md)" }}>
            <TargetIcon s={19} c="var(--blue)" />
          </span>
        </MapView>

        <div style={{ margin: "-26px 10px 0", position: "relative", background: "var(--surface)", borderRadius: 20, padding: 12, boxShadow: "var(--shadow-xl)" }}>
          <button onClick={() => p.onSearch()} className="press" style={{
            width: "100%", display: "flex", alignItems: "center", gap: 10, background: "var(--bg-secondary)", border: "none",
            borderRadius: 14, padding: "13px 14px", cursor: "pointer", textAlign: "left",
          }}>
            <SearchIcon s={20} c="var(--ink)" w={2} />
            <span style={{ flex: 1, fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>Where are you going?</span>
            <span style={{ display: "flex", alignItems: "center", gap: 4, background: "var(--surface)", borderRadius: 999, padding: "5px 10px", fontSize: 11.5, fontWeight: 600, color: "var(--ink-soft)" }}>
              <ClockIcon s={13} c="var(--ink-soft)" /> Now
            </span>
          </button>
          <div className="no-scroll" style={{ display: "flex", gap: 8, overflowX: "auto", marginTop: 10 }}>
            {quick.map((pl) => {
              const Icon = pl.kind === "home" ? HomeIcon : pl.kind === "work" ? BriefcaseIcon : ClockIcon;
              return (
                <button key={pl.id} onClick={() => p.onQuick(pl)} className="press" style={{
                  flexShrink: 0, display: "flex", alignItems: "center", gap: 8, border: "1.5px solid var(--line)", background: "var(--surface)",
                  borderRadius: 12, padding: "7px 11px", cursor: "pointer", textAlign: "left",
                }}>
                  <Icon s={16} c="var(--blue)" />
                  <span>
                    <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--ink)", whiteSpace: "nowrap" }}>{pl.name}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── AC / Non-AC preference ── */}
      <div style={{ padding: "14px 16px 0" }}>
        <div style={{ background: "var(--surface)", borderRadius: 18, padding: "12px 12px 12px 14px", boxShadow: "var(--shadow-card)", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: "var(--ink)" }}>Vehicle type</span>
            <span style={{ display: "block", fontSize: 11.5, color: "var(--ink-soft)" }}>{p.ac ? "AC cars for every ride" : "Non-AC · cheaper car fares"}</span>
          </span>
          <div role="radiogroup" aria-label="AC or Non-AC vehicle" style={{ display: "flex", background: "var(--bg-secondary)", borderRadius: 999, padding: 3 }}>
            {[true, false].map((v) => (
              <button key={String(v)} role="radio" aria-checked={p.ac === v} onClick={() => p.onAc(v)} style={{
                border: "none", cursor: "pointer", borderRadius: 999, padding: "8px 14px", fontSize: 13, fontWeight: 700,
                background: p.ac === v ? (v ? "var(--blue)" : "var(--ink)") : "transparent", color: p.ac === v ? "white" : "var(--ink-soft)",
              }}>{v ? "❄ AC" : "Non-AC"}</button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Active ride ── */}
      {p.active && (
        <div style={{ padding: "16px 16px 0" }}>
          <button onClick={p.onTrack} className="press fade-up" style={{
            width: "100%", border: "none", cursor: "pointer", textAlign: "left", borderRadius: 20, padding: "14px 16px",
            background: "linear-gradient(135deg,var(--blue-dark),var(--blue))", color: "white", display: "flex", alignItems: "center", gap: 12,
            boxShadow: "0 10px 24px rgba(11,92,255,0.28)",
          }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: "rgba(255,255,255,0.14)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <VehicleArt kind={p.active.vehicle} size={44} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: "var(--gold)", letterSpacing: "0.06em" }}>CURRENT RIDE</p>
              <p style={{ margin: "2px 0 0", fontSize: 14.5, fontWeight: 700 }}>{STATUS_LINE[p.active.status]}</p>
              <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.75)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>To {p.active.to.name}</p>
            </div>
            <span style={{ fontSize: 12.5, fontWeight: 700, display: "flex", alignItems: "center", gap: 3 }}>Track <ChevronRight s={15} c="white" /></span>
          </button>
        </div>
      )}

      {/* ── Ride categories ── */}
      <div style={{ padding: "22px 16px 0" }}>
        <p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-soft)", fontWeight: 500 }}>Pick your ride</p>
        <p style={{ margin: 0, fontSize: 19, fontWeight: 700, color: "var(--ink)", letterSpacing: "-0.02em" }}>Our Services</p>
      </div>
      <div style={{ padding: "12px 12px 0", display: "grid", gridTemplateColumns: "repeat(4,1fr)", rowGap: 14, columnGap: 6 }}>
        {SERVICES.map((o) => (
          <button key={o} onClick={() => p.onSearch(o)} className="press" style={{
            background: "none", border: "none", padding: 0, cursor: "pointer",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 7, position: "relative",
          }}>
            <div style={{
              width: "100%", maxWidth: 70, aspectRatio: "1 / 1", background: "var(--surface)", borderRadius: "28%",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 6px 10px -2px rgba(15,23,41,0.16), 0 2px 4px rgba(15,23,41,0.06)",
            }}>{o === "any" ? <AnyArt size={50} /> : o === "rental" ? <RentalArt size={48} /> : o === "parcel" ? <ParcelArt size={50} /> : <VehicleArt kind={o} size={50} />}</div>
            {o === "parcel" && <span style={{ position: "absolute", top: -6, right: 2, background: "var(--red)", color: "white", fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 6 }}>NEW</span>}
            <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--ink)" }}>{o === "any" ? "Book Any" : o === "rental" ? "Rental" : o === "parcel" ? "Parcel" : vehicleById(o).name}</span>
          </button>
        ))}
      </div>

      <div style={{ paddingTop: 24 }}><PromoCarousel onOffers={p.onOffers} onRide={() => p.onSearch()} /></div>

      {/* ── Safety strip ── */}
      <div style={{ padding: "18px 16px 0" }}>
        <div style={{ background: "var(--surface)", borderRadius: 18, padding: 14, border: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 12, boxShadow: "var(--shadow-card)" }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, flexShrink: 0, background: "linear-gradient(135deg,#34c38f,var(--green))", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(47,158,118,0.3)" }}>
            <ShieldIcon s={24} c="white" w={2} />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: "var(--ink)" }}>Safe &amp; secure rides</p>
            <p style={{ margin: "2px 0 0", fontSize: 11.5, color: "var(--ink-soft)" }}>Verified drivers · Ride OTP · Share live trip · 24/7 support</p>
          </div>
        </div>
      </div>
    </div>
  );
}

const SLIDE_MS = 4000;

function PromoCarousel({ onOffers, onRide }: { onOffers: () => void; onRide: () => void }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const held = useRef(0);

  useEffect(() => {
    const t = setInterval(() => {
      const el = trackRef.current;
      if (!el || Date.now() < held.current || document.hidden) return;
      const cur = Math.round(el.scrollLeft / el.clientWidth);
      el.scrollTo({ left: ((cur + 1) % 2) * el.clientWidth, behavior: "smooth" });
    }, SLIDE_MS);
    return () => clearInterval(t);
  }, []);

  const slide = (children: React.ReactNode, key: number) => (
    <div key={key} style={{ flex: "0 0 100%", scrollSnapAlign: "start", padding: "0 16px" }}>
      <div style={{
        height: "100%", borderRadius: 24, padding: "20px 18px", position: "relative", overflow: "hidden",
        background: "linear-gradient(150deg,var(--blue-dark) 0%,var(--blue-dark) 55%,var(--blue) 100%)",
        boxShadow: "0 10px 28px rgba(11,92,255,0.28)",
      }}>
        <div style={{ position: "absolute", right: -50, top: -60, width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, rgba(245,166,35,0.30), transparent 70%)" }} />
        <div style={{ position: "absolute", left: -40, bottom: -70, width: 170, height: 170, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,255,255,0.14), transparent 70%)" }} />
        {children}
      </div>
    </div>
  );

  return (
    <div>
      <div ref={trackRef} className="no-scroll"
        onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
        onPointerDown={() => { held.current = Date.now() + 7000; }}
        style={{ display: "flex", overflowX: "auto", scrollSnapType: "x mandatory", paddingBottom: 14, marginBottom: -14 }}>
        {slide(
          <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <span style={{ display: "inline-block", background: "#CFFB6B", color: "var(--blue-dark)", fontSize: 10.5, fontWeight: 700, padding: "4px 10px", borderRadius: 8 }}>Code: FIRST50</span>
              <p style={{ margin: "10px 0 0", fontSize: 22, fontWeight: 800, color: "white", lineHeight: 1.2 }}>
                50% off your<br /><span style={{ color: "var(--gold)" }}>first ride</span>
              </p>
              <p style={{ margin: "6px 0 14px", fontSize: 12.5, color: "rgba(255,255,255,0.72)" }}>Up to ₹100 · any vehicle</p>
              <button onClick={onOffers} className="press" style={{
                background: "linear-gradient(135deg,var(--gold),var(--gold-dark))", color: "var(--blue-dark)", border: "none",
                borderRadius: 12, padding: "10px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer",
                boxShadow: "0 6px 16px rgba(245,166,35,0.40)", display: "inline-flex", alignItems: "center", gap: 6,
              }}>View Offers <ArrowRight s={15} c="var(--blue-dark)" w={2.2} /></button>
            </div>
            <div style={{ flexShrink: 0, filter: "drop-shadow(0 10px 18px rgba(4,36,107,0.45))" }}><VehicleArt kind="sedan" size={124} /></div>
          </div>, 0,
        )}
        {slide(
          <div style={{ position: "relative", zIndex: 1 }}>
            <span style={{ display: "inline-block", background: "var(--gold)", color: "var(--blue-dark)", fontSize: 10.5, fontWeight: 700, padding: "4px 10px", borderRadius: 8 }}>BIKE RIDES</span>
            <p style={{ margin: "10px 0 0", fontSize: 22, fontWeight: 800, color: "white", lineHeight: 1.2 }}>
              Skip the traffic<br />from <span style={{ color: "var(--gold)" }}>₹30</span>
            </p>
            <div style={{ display: "flex", gap: 14, margin: "12px 0 14px", background: "rgba(255,255,255,0.09)", border: "1px solid rgba(255,255,255,0.16)", borderRadius: 14, padding: "10px 12px" }}>
              {[["2 min", "Pickup"], ["₹6", "per km"], ["4.8★", "Captains"]].map(([v, l]) => (
                <div key={l}><p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "var(--gold)" }}>{v}</p><p style={{ margin: 0, fontSize: 10.5, color: "rgba(255,255,255,0.7)" }}>{l}</p></div>
              ))}
            </div>
            <button onClick={onRide} className="press" style={{ background: "white", color: "var(--blue-dark)", border: "none", borderRadius: 12, padding: "10px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Book a Bike →</button>
          </div>, 1,
        )}
      </div>
      <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 12 }}>
        {[0, 1].map((i) => (
          <span key={i} style={{ width: i === index ? 20 : 7, height: 7, borderRadius: 999, background: i === index ? "var(--blue)" : "rgba(11,92,255,0.22)", transition: "width 0.3s" }} />
        ))}
      </div>
    </div>
  );
}
