"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import { BackIcon, TargetIcon } from "../icons";
import { PrimaryButton, card, iconBtn } from "../ui";
import { distanceM, retryLocation, reverseGeocode, useDeviceLocation, type LatLng } from "../../lib/location";
import type { Place } from "../../lib/api";

/* "Confirm pickup", as in Uber/Rapido: GPS puts the pin close, the customer drags the map so the pin sits exactly
 * on their gate, and that point (with its street address) becomes the pickup the rider is sent to and the fare is
 * priced from. The pin stays in the middle of the screen; the map moves under it. */

const FAR_M = 300;   // warn when the pin is this far from where the phone is

export function ConfirmPickupPage({ from, onBack, onConfirm }: { from: Place; onBack: () => void; onConfirm: (p: Place) => void }) {
  const loc = useDeviceLocation();
  const gps = loc.status === "ok" ? loc.pos : null;
  const boxRef = useRef<HTMLDivElement>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const L = useRef<typeof Leaflet | null>(null);
  const meLayer = useRef<{ dot: Leaflet.CircleMarker; ring: Leaflet.Circle } | null>(null);
  const [center, setCenter] = useState<LatLng | null>(null);
  const [moving, setMoving] = useState(false);
  const [address, setAddress] = useState<string | null>(null);

  /* The map, centred on the first GPS fix and zoomed in to street level. */
  useEffect(() => {
    if (!gps || map.current) return;
    let dead = false;
    void import("leaflet").then((mod) => {
      if (dead || !boxRef.current || map.current) return;
      L.current = mod;
      const m = mod.map(boxRef.current, { zoomControl: false, attributionControl: false }).setView([gps.lat, gps.lng], 18);
      mod.control.attribution({ position: "topright", prefix: false }).addTo(m);
      mod.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(m);
      m.on("movestart", () => setMoving(true));
      m.on("moveend", () => { const c = m.getCenter(); setCenter({ lat: c.lat, lng: c.lng }); setMoving(false); });
      map.current = m;
      setCenter(gps);
    });
    return () => { dead = true; };
  }, [gps]);
  useEffect(() => () => { map.current?.remove(); map.current = null; }, []);

  /* Where the phone is (blue dot + accuracy ring), for reference while placing the pin. */
  useEffect(() => {
    const m = map.current, lf = L.current;
    if (!m || !lf || loc.status !== "ok") return;
    const ll: [number, number] = [loc.pos.lat, loc.pos.lng];
    if (!meLayer.current) {
      meLayer.current = {
        ring: lf.circle(ll, { radius: loc.accuracy, color: "#0b5cff", weight: 1, opacity: 0.35, fillOpacity: 0.08, interactive: false }).addTo(m),
        dot: lf.circleMarker(ll, { radius: 7, color: "white", weight: 3, fillColor: "#0b5cff", fillOpacity: 1, interactive: false }).addTo(m),
      };
    } else {
      meLayer.current.ring.setLatLng(ll).setRadius(loc.accuracy);
      meLayer.current.dot.setLatLng(ll);
    }
  }, [loc, center]);

  /* Street address under the pin, once the map stops moving. */
  useEffect(() => {
    if (!center || moving) return;
    let live = true;
    setAddress(null);
    const t = setTimeout(() => { void reverseGeocode(center).then((a) => { if (live) setAddress(a); }); }, 350);
    return () => { live = false; clearTimeout(t); };
  }, [center, moving]);

  const recenter = () => { if (gps && map.current) map.current.setView([gps.lat, gps.lng], 18); };
  const far = gps && center ? distanceM(gps, center) : 0;
  const off = loc.status === "denied" || loc.status === "unavailable" || loc.status === "insecure";

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 40, display: "flex", flexDirection: "column", background: "var(--app-bg)" }}>
      <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
        <div ref={boxRef} style={{ position: "absolute", inset: 0, background: "#e8eef5" }} />

        {/* The pin: fixed in the middle, lifted while the map is moving. */}
        {gps && (
          <div aria-hidden="true" style={{ position: "absolute", left: "50%", top: "50%", zIndex: 500, pointerEvents: "none", transform: `translate(-50%, -100%) translateY(${moving ? -10 : 0}px)`, transition: "transform 0.15s ease" }}>
            <svg width="38" height="50" viewBox="-19 -48 38 50" style={{ display: "block", filter: "drop-shadow(0 4px 6px rgba(15,23,41,0.35))" }}>
              <path d="M0 0 c-12 -16 -17 -23 -17 -31 a17 17 0 0 1 34 0 c0 8 -5 15 -17 31z" fill="#2f9e76" stroke="white" strokeWidth="2.5" />
              <circle cx="0" cy="-31" r="6" fill="white" />
            </svg>
            <span style={{ position: "absolute", left: "50%", bottom: -4, width: moving ? 6 : 10, height: 4, marginLeft: moving ? -3 : -5, borderRadius: "50%", background: "rgba(15,23,41,0.35)" }} />
          </div>
        )}

        <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 600, padding: "calc(14px + env(safe-area-inset-top)) 14px 0", display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={onBack} aria-label="Back" className="press" style={{ ...iconBtn, background: "white", boxShadow: "var(--shadow-md)" }}><BackIcon c="var(--ink)" /></button>
          <div style={{ background: "white", borderRadius: 14, padding: "8px 12px", boxShadow: "var(--shadow-md)" }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>Confirm pickup</p>
            <p style={{ margin: 0, fontSize: 11.5, color: "var(--ink-soft)" }}>Map khiska ke pin apne gate pe rakhein</p>
          </div>
        </div>

        {gps && (
          <button onClick={recenter} aria-label="My location" className="press" style={{ position: "absolute", right: 14, bottom: 16, zIndex: 600, width: 46, height: 46, borderRadius: "50%", border: "none", background: "white", boxShadow: "var(--shadow-md)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <TargetIcon s={22} c="var(--blue)" />
          </button>
        )}

        {!gps && (
          <div style={{ position: "absolute", inset: 0, zIndex: 600, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
            <div style={{ ...card, padding: 18, textAlign: "center", maxWidth: 320 }}>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{off ? "Location is off" : "Finding where you are…"}</p>
              <p style={{ margin: "6px 0 12px", fontSize: 13, color: "var(--ink-soft)" }}>
                {off ? "Allow precise location for DriveWay, or go back and pick a pickup point from the list." : "Keep GPS on — this takes a few seconds."}
              </p>
              {off && <PrimaryButton onClick={retryLocation}>Try again</PrimaryButton>}
            </div>
          </div>
        )}
      </div>

      <div style={{ background: "var(--surface)", borderRadius: "22px 22px 0 0", marginTop: -18, position: "relative", zIndex: 700, padding: "18px 16px calc(16px + env(safe-area-inset-bottom))", boxShadow: "0 -6px 20px rgba(15,23,41,0.12)" }}>
        <p style={{ margin: 0, fontSize: 11.5, fontWeight: 700, letterSpacing: "0.06em", color: "var(--green)" }}>PICKUP POINT</p>
        <p style={{ margin: "4px 0 0", fontSize: 16, fontWeight: 700, color: "var(--ink)", minHeight: 22 }}>
          {moving ? "Moving…" : address ?? (center ? "Finding address…" : "—")}
        </p>
        <p style={{ margin: "6px 0 0", fontSize: 12.5, color: far > FAR_M ? "var(--red)" : "var(--ink-soft)" }}>
          {far > FAR_M ? `Pin aapse ${far >= 1000 ? `${(far / 1000).toFixed(1)} km` : `${Math.round(far)} m`} door hai — rider yahin aayega.`
            : loc.status === "ok" && loc.accuracy > 50 ? `GPS ±${Math.round(loc.accuracy)} m hai — pin ko apne exact gate pe khiska dein.`
              : "Rider isi pin pe aayega."}
        </p>
        <PrimaryButton style={{ marginTop: 14 }} disabled={!center || moving}
          onClick={() => center && onConfirm({ ...from, lat: center.lat, lng: center.lng, address: address ?? `${center.lat.toFixed(5)}, ${center.lng.toFixed(5)}` })}>
          Confirm pickup
        </PrimaryButton>
      </div>
    </div>
  );
}
