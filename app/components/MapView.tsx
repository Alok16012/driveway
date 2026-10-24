"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import { TargetIcon } from "./icons";
import { INDIA_CENTER, distanceM, placeCoords, useDeviceLocation, type LatLng } from "../lib/location";
import { GOOGLE_LOGO, googleRoute, tileCopyright, tileSession, tileUrl } from "../lib/google";

/* Real street map (Leaflet) centred on the device's GPS position: Google Maps tiles and road routes when a Maps key
 * is set, else OpenStreetMap tiles and the OSRM router. The modes decide which route, pins and car are drawn on top;
 * if no router can be reached the route is drawn as a straight line. */

export type MapMode = "idle" | "route" | "approach" | "trip";
/* Simulated pace, in seconds to cover each leg on screen, for a car whose real position this device doesn't
 * know yet. With `live` the car is this device's own GPS position (rider app); with `car` it is the position
 * the driver's phone last reported (customer app). */
export const SIM_APPROACH_SEC = 45;
export const SIM_TRIP_SEC = 90;
/** Car runs along the route from `since`, covering it in `seconds`, never past `max` (0–1). */
export type MapMotion = { since: string; seconds: number; max: number };

const CAR_SVG = `<svg width="30" height="20" viewBox="-12 -8 24 16" style="display:block"><rect x="-11" y="-6.5" width="22" height="13" rx="4.5" fill="#0f1729"/><rect x="-9.5" y="-5.2" width="19" height="10.4" rx="3.6" fill="#f5a623"/><rect x="1.5" y="-4.4" width="4.5" height="8.8" rx="1.4" fill="#0f1729" opacity="0.75"/><rect x="-7" y="-4.4" width="3.2" height="8.8" rx="1.2" fill="#0f1729" opacity="0.55"/></svg>`;
// Seen from above, pointing east (0°) like CAR_SVG, so the same rotation applies.
const BIKE_SVG = `<svg width="36" height="19" viewBox="-12 -6.5 24 13" style="display:block"><rect x="-11.5" y="-1.8" width="5.5" height="3.6" rx="1.8" fill="#0f1729"/><rect x="6" y="-1.8" width="5.5" height="3.6" rx="1.8" fill="#0f1729"/><rect x="-7.5" y="-2.4" width="14" height="4.8" rx="2.4" fill="#f5a623"/><rect x="3.6" y="-5.6" width="1.8" height="11.2" rx="0.9" fill="#0f1729"/><circle cx="-1.8" cy="0" r="3.4" fill="#0f1729"/><circle cx="-1.8" cy="0" r="2" fill="#ea580c"/></svg>`;
const AUTO_SVG = `<svg width="30" height="20" viewBox="-12 -8 24 16" style="display:block"><path d="M-10 -6.5 H4 Q11 -6.5 11 0 Q11 6.5 4 6.5 H-10 Q-11 6.5 -11 5.5 V-5.5 Q-11 -6.5 -10 -6.5Z" fill="#0f1729"/><path d="M-9.4 -5.2 H3.6 Q9.6 -5.2 9.6 0 Q9.6 5.2 3.6 5.2 H-9.4Z" fill="#facc15"/><rect x="-8.6" y="-5.2" width="10.4" height="10.4" rx="1.6" fill="#15803d"/></svg>`;
/** The marker for a vehicle category: a bike, a three-wheeler or a car. */
const vehicleIcon = (v?: string): { html: string; size: [number, number] } =>
  v === "bike" ? { html: BIKE_SVG, size: [36, 19] } : v === "auto" || v === "erick" ? { html: AUTO_SVG, size: [30, 20] } : { html: CAR_SVG, size: [30, 20] };

const PICKUP_HTML = `<span style="display:block;width:22px;height:22px;border-radius:50%;background:rgba(47,158,118,0.22);position:relative"><span style="position:absolute;inset:4px;border-radius:50%;background:#2f9e76;border:2.5px solid white;box-sizing:border-box"></span></span>`;
const DROP_HTML = `<svg width="28" height="36" viewBox="-14 -34 28 36" style="display:block"><path d="M0 0 c-9 -12 -13 -17 -13 -24 a13 13 0 0 1 26 0 c0 7 -4 12 -13 24z" fill="#e03131" stroke="white" stroke-width="2"/><circle cx="0" cy="-24" r="4.5" fill="white"/></svg>`;
const ME_HTML = `<span style="display:block;position:relative;width:20px;height:20px"><span class="map-pulse" style="position:absolute;inset:-10px;border-radius:50%;background:rgba(11,92,255,0.18)"></span><span style="position:absolute;inset:0;border-radius:50%;background:var(--blue);border:3.5px solid white;box-sizing:border-box;box-shadow:0 1px 4px rgba(0,0,0,0.3)"></span></span>`;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const toLL = (p: LatLng): [number, number] => [p.lat, p.lng];

/* Road route between two points, cached per pair. */
const routeCache = new Map<string, LatLng[]>();
async function roadRoute(a: LatLng, b: LatLng): Promise<LatLng[]> {
  const key = `${a.lat.toFixed(4)},${a.lng.toFixed(4)};${b.lat.toFixed(4)},${b.lng.toFixed(4)}`;
  const hit = routeCache.get(key);
  if (hit) return hit;
  const g = await googleRoute(a, b);
  if (g && g.length > 1) { routeCache.set(key, g); return g; }
  try {
    const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`);
    const j = await res.json();
    const coords: [number, number][] | undefined = j.routes?.[0]?.geometry?.coordinates;
    if (!coords?.length) return [a, b];
    const line = coords.map(([lng, lat]) => ({ lat, lng }));
    routeCache.set(key, line);
    return line;
  } catch { return [a, b]; }
}

/** Point and heading (degrees, 0 = east, clockwise) at fraction `t` along a polyline. */
function along(line: LatLng[], t: number): { pos: LatLng; angle: number } {
  if (line.length < 2) return { pos: line[0], angle: 0 };
  const seg = line.slice(1).map((p, i) => distanceM(line[i], p));
  let left = seg.reduce((s, d) => s + d, 0) * clamp01(t);
  let i = 0;
  while (i < seg.length - 1 && left > seg[i]) { left -= seg[i]; i++; }
  const a = line[i], b = line[i + 1], f = seg[i] ? left / seg[i] : 0;
  return { pos: { lat: a.lat + (b.lat - a.lat) * f, lng: a.lng + (b.lng - a.lng) * f }, angle: bearing(a, b) };
}
const bearing = (a: LatLng, b: LatLng) => (Math.atan2(-(b.lat - a.lat), (b.lng - a.lng) * Math.cos((a.lat * Math.PI) / 180)) * 180) / Math.PI;

export default function MapView({ mode = "idle", progress = 0, motion, from, to, pickupAt, dropAt, live = false, car, vehicle, height = 220, radius = 20, style, children }: {
  mode?: MapMode; progress?: number; motion?: MapMotion;
  /** Place ids (`public.places`) for the pickup and drop. */
  from?: string; to?: string;
  /** Real positions of the pickup and drop when they aren't fixed places (GPS or searched on Google Maps). */
  pickupAt?: LatLng | null; dropAt?: LatLng | null;
  /** This device is the car (rider app): draw it at the real GPS position instead of simulating it. */
  live?: boolean;
  /** Where the driver's phone last reported being; omitted while unknown, and the car is simulated. */
  car?: LatLng | null;
  /** Vehicle category, for the moving marker (bike, auto/e-rickshaw, or a car). */
  vehicle?: string;
  height?: number | string; radius?: number; style?: React.CSSProperties; children?: React.ReactNode;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const L = useRef<typeof Leaflet | null>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const [ready, setReady] = useState(false);
  const loc = useDeviceLocation();
  const me = loc.status === "ok" ? loc.pos : null;

  /* Create the map once; Leaflet touches `window`, so it's loaded on the client only. */
  useEffect(() => {
    let dead = false;
    void import("leaflet").then((mod) => {
      if (dead || !boxRef.current) return;
      L.current = mod;
      const m = mod.map(boxRef.current, { zoomControl: false, attributionControl: false }).setView(toLL(INDIA_CENTER), 5);
      const credit = mod.control.attribution({ position: "topright", prefix: false }).addTo(m);
      const osm = () => mod.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(m);
      // Google tiles need the Google logo on the map and the copyright for the area on screen.
      void tileSession().then((sess) => {
        if (dead) return;
        if (!sess) { osm(); return; }
        mod.tileLayer(tileUrl(sess), { maxZoom: 21, maxNativeZoom: 21 }).addTo(m);
        const logo = new (mod.Control.extend({ onAdd: () => Object.assign(document.createElement("img"), { src: GOOGLE_LOGO, alt: "Google", height: 18, style: "display:block;height:18px;margin:0 0 4px 6px;pointer-events:none" }) }))({ position: "bottomleft" });
        logo.addTo(m);
        let shown = "";
        let t: ReturnType<typeof setTimeout> | undefined;
        const refresh = () => {
          clearTimeout(t);
          t = setTimeout(() => {
            const b = m.getBounds();
            void tileCopyright(sess, m.getZoom(), { north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() }).then((c) => {
              if (dead || c === null || c === shown) return;
              if (shown) credit.removeAttribution(shown);
              credit.addAttribution(c); shown = c;
            });
          }, 400);
        };
        m.on("moveend", refresh);
        refresh();
      });
      m.on("dragstart zoomstart", (e) => { if ((e as Leaflet.LeafletEvent & { originalEvent?: Event }).originalEvent) userMoved.current = true; });
      map.current = m;
      setReady(true);
    });
    return () => { dead = true; map.current?.remove(); map.current = null; };
  }, []);

  /* Keep tiles filling the box when its height changes (e.g. the expand-map button). */
  useEffect(() => { map.current?.invalidateSize(); }, [height, ready]);

  /* ── device dot (hidden when this device is the car) ── */
  const meLayer = useRef<{ dot: Leaflet.Marker; ring: Leaflet.Circle } | null>(null);
  const centredAcc = useRef(Infinity);   // accuracy of the fix the map last centred on
  const userMoved = useRef(false);
  const showMe = !!me && !(live && mode !== "idle");
  useEffect(() => {
    const m = map.current, lf = L.current;
    if (!m || !lf) return;
    if (!showMe || !me || loc.status !== "ok") { meLayer.current?.dot.remove(); meLayer.current?.ring.remove(); meLayer.current = null; return; }
    if (!meLayer.current) {
      meLayer.current = {
        ring: lf.circle(toLL(me), { radius: loc.accuracy, color: "#0b5cff", weight: 1, opacity: 0.3, fillOpacity: 0.08, interactive: false }).addTo(m),
        dot: lf.marker(toLL(me), { icon: lf.divIcon({ html: ME_HTML, className: "", iconSize: [20, 20], iconAnchor: [10, 10] }), interactive: false, zIndexOffset: 500 }).addTo(m),
      };
    } else {
      meLayer.current.dot.setLatLng(toLL(me));
      meLayer.current.ring.setLatLng(toLL(me)).setRadius(loc.accuracy);
    }
    // The first fix is often coarse (Wi-Fi / cell); follow it until a sharp one lands or the person moves the map.
    if (mode === "idle" && !userMoved.current && loc.accuracy < centredAcc.current / 2) {
      m.setView(toLL(me), loc.accuracy > 1000 ? 14 : 16);
      centredAcc.current = loc.accuracy;
    }
  }, [ready, showMe, me?.lat, me?.lng, loc, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── route legs ── */
  const pickup = pickupAt ?? placeCoords(from), drop = dropAt ?? placeCoords(to);
  const pickupKey = pickup ? `${pickup.lat.toFixed(4)},${pickup.lng.toFixed(4)}` : "";
  const dropKey = drop ? `${drop.lat.toFixed(4)},${drop.lng.toFixed(4)}` : "";
  const [tripLine, setTripLine] = useState<LatLng[] | null>(null);
  const [apprLine, setApprLine] = useState<LatLng[] | null>(null);
  useEffect(() => {
    setTripLine(null);
    if (mode === "idle" || !pickup || !drop) return;
    let alive = true;
    void roadRoute(pickup, drop).then((l) => { if (alive) setTripLine(l); });
    return () => { alive = false; };
  }, [mode, pickupKey, dropKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // The driver's leg to pickup: from this device when it's the driver, else from a simulated start ~1.5 km away.
  const realCar = live ? me : car ?? null;
  const apprStart = live || car ? realCar : pickup ? { lat: pickup.lat + 0.009, lng: pickup.lng - 0.011 } : null;
  const apprKey = apprStart ? `${apprStart.lat.toFixed(3)},${apprStart.lng.toFixed(3)}` : "";
  useEffect(() => {
    setApprLine(null);
    if (mode !== "approach" || !pickup || !apprStart) return;
    let alive = true;
    void roadRoute(apprStart, pickup).then((l) => { if (alive) setApprLine(l); });
    return () => { alive = false; };
  }, [mode, pickupKey, apprKey]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Pins and lines, redrawn when the route changes; the map frames the whole route. */
  useEffect(() => {
    const m = map.current, lf = L.current;
    if (!m || !lf || mode === "idle" || !pickup) return;
    const g = lf.layerGroup().addTo(m);
    if (apprLine && mode === "approach") lf.polyline(apprLine.map(toLL), { color: "#0f1729", weight: 3.5, opacity: 0.6, dashArray: "2 8", lineCap: "round" }).addTo(g);
    if (tripLine) {
      lf.polyline(tripLine.map(toLL), { color: "#0847c7", weight: 9, opacity: 0.18 }).addTo(g);
      lf.polyline(tripLine.map(toLL), { color: "#0b5cff", weight: 5, lineCap: "round" }).addTo(g);
    }
    lf.marker(toLL(pickup), { icon: lf.divIcon({ html: PICKUP_HTML, className: "", iconSize: [22, 22], iconAnchor: [11, 11] }), interactive: false }).addTo(g);
    if (drop) lf.marker(toLL(drop), { icon: lf.divIcon({ html: DROP_HTML, className: "", iconSize: [28, 36], iconAnchor: [14, 34] }), interactive: false }).addTo(g);
    const pts = [...(tripLine ?? [pickup, ...(drop ? [drop] : [])]), ...(mode === "approach" && apprLine ? apprLine : [])];
    m.fitBounds(lf.latLngBounds(pts.map(toLL)), { padding: [36, 36], maxZoom: 16 });
    return () => { g.remove(); };
  }, [ready, mode, tripLine, apprLine]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── the car ── */
  const moving = mode === "approach" || mode === "trip";
  const carLine = mode === "approach" ? apprLine : mode === "trip" ? tripLine : null;
  const carMk = useRef<Leaflet.Marker | null>(null);
  const lastMe = useRef<LatLng | null>(null);
  const heading = useRef(0);
  const carKind = useRef<string | undefined>(undefined);
  const shown = useRef<{ mode: MapMode; t: number } | null>(null);
  const since = motion?.since, seconds = motion?.seconds, max = motion?.max;

  useEffect(() => {
    const m = map.current, lf = L.current;
    if (!m || !lf || !moving) { carMk.current?.remove(); carMk.current = null; shown.current = null; return; }
    if (carMk.current && carKind.current !== vehicle) { carMk.current.remove(); carMk.current = null; }   // "Book Any" learns its vehicle late
    if (!carMk.current) {
      carKind.current = vehicle;
      const ic = vehicleIcon(vehicle);
      carMk.current = lf.marker(toLL(pickup ?? INDIA_CENTER), { icon: lf.divIcon({ html: `<div>${ic.html}</div>`, className: "", iconSize: ic.size, iconAnchor: [ic.size[0] / 2, ic.size[1] / 2] }), interactive: false, zIndexOffset: 1000 }).addTo(m);
    }
    const mk = carMk.current;
    const place = (pos: LatLng, angle: number) => {
      mk.setLatLng(toLL(pos));
      const el = mk.getElement()?.firstElementChild as HTMLElement | null;
      if (el) el.style.transform = `rotate(${angle}deg)`;
    };

    // Real position known (this phone, or the driver's last report): draw the car there.
    if (live || car) {
      if (realCar) {
        if (lastMe.current && distanceM(lastMe.current, realCar) > 3) heading.current = bearing(lastMe.current, realCar);
        lastMe.current = realCar;
        place(realCar, heading.current);
      }
      return;
    }

    // Not known yet: ease along the route toward where the car should be by now, every animation frame.
    if (!carLine) return;
    const start = since ? new Date(since).getTime() : NaN;
    const target = () => clamp01(seconds && !Number.isNaN(start) ? Math.min(max ?? 1, (Date.now() - start) / 1000 / seconds) : progress);
    let t = shown.current?.mode === mode ? shown.current.t : target();
    let last = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      t += (target() - t) * Math.min(1, dt * 3);
      const p = along(carLine, t);
      place(p.pos, p.angle);
      shown.current = { mode, t };
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [ready, moving, mode, carLine, live, realCar?.lat, realCar?.lng, progress, since, seconds, max, vehicle]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { carMk.current?.remove(); }, []);

  const recentre = () => { if (me) map.current?.flyTo(toLL(me), 16, { duration: 0.6 }); };

  return (
    <div style={{ position: "relative", height, borderRadius: radius, overflow: "hidden", background: "#e9eef6", ...style }}>
      {/* z-index 0 keeps Leaflet's own stacking inside this box, so overlays passed as children sit on top. */}
      <div ref={boxRef} style={{ position: "absolute", inset: 0, zIndex: 0, background: "#e9eef6" }} />
      {children}
      {mode === "idle" && me && (
        <button onClick={recentre} aria-label="Show my location" className="press" style={{
          position: "absolute", right: 12, top: 30, width: 36, height: 36, borderRadius: "50%", background: "white", border: "none",
          display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "var(--shadow-md)", cursor: "pointer",
        }}>
          <TargetIcon s={19} c="var(--blue)" />
        </button>
      )}
    </div>
  );
}
