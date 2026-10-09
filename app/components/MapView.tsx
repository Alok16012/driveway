"use client";

import { useLayoutEffect, useRef } from "react";

/* Illustrated city map — a stand-in until the third-party map SDK (PRD §9) is wired in.
 * One fixed street grid; the modes decide which route, pins and car are drawn on top. */

export type MapMode = "idle" | "route" | "approach" | "trip";
/* Simulated pace, in seconds to cover each leg on screen. Quick enough to see the car move; the ETA labels
 * count down with it. Replaced by the rider's real position once GPS tracking is wired in. */
export const SIM_APPROACH_SEC = 45;
export const SIM_TRIP_SEC = 90;
/** Car runs along the route from `since`, covering it in `seconds`, never past `max` (0–1). Simulated until real GPS lands. */
export type MapMotion = { since: string; seconds: number; max: number };

const TRIP = "M92 232 C 120 232, 132 196, 164 190 S 212 160, 236 136 S 290 92, 318 74";
const APPROACH = "M40 128 C 60 150, 58 196, 72 214 S 86 230, 92 232";

const NEARBY = [
  { x: 60, y: 70, r: 20 }, { x: 180, y: 60, r: 110 }, { x: 300, y: 190, r: 200 },
  { x: 130, y: 150, r: 70 }, { x: 350, y: 250, r: 300 }, { x: 250, y: 250, r: 160 },
];

function Car({ x, y, angle, size = 1 }: { x: number; y: number; angle: number; size?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle}) scale(${size})`}>
      <rect x="-11" y="-6.5" width="22" height="13" rx="4.5" fill="#0f1729" />
      <rect x="-9.5" y="-5.2" width="19" height="10.4" rx="3.6" fill="#f5a623" />
      <rect x="1.5" y="-4.4" width="4.5" height="8.8" rx="1.4" fill="#0f1729" opacity="0.75" />
      <rect x="-7" y="-4.4" width="3.2" height="8.8" rx="1.2" fill="#0f1729" opacity="0.55" />
    </g>
  );
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export default function MapView({ mode = "idle", progress = 0, motion, height = 220, radius = 20, nearby = mode === "idle", style, children }: {
  mode?: MapMode; progress?: number; motion?: MapMotion; height?: number | string; radius?: number; nearby?: boolean; style?: React.CSSProperties; children?: React.ReactNode;
}) {
  const tripRef = useRef<SVGPathElement>(null);
  const apprRef = useRef<SVGPathElement>(null);
  const carRef = useRef<SVGGElement>(null);
  const shown = useRef<{ mode: MapMode; t: number } | null>(null);
  const moving = mode === "approach" || mode === "trip";

  /* Drawn every animation frame straight onto the SVG (no React re-render): the car eases toward where it
   * should be now, so it glides and turns with the road instead of jumping once a second. */
  const since = motion?.since, seconds = motion?.seconds, max = motion?.max;
  useLayoutEffect(() => {
    const trip = tripRef.current;
    const path = mode === "approach" ? apprRef.current : mode === "trip" ? trip : null;
    const car = carRef.current;
    if (trip) trip.style.strokeDashoffset = "0";
    if (!path || !car) { shown.current = null; return; }
    const len = path.getTotalLength();
    const start = since ? new Date(since).getTime() : NaN;
    const target = () => clamp01(seconds && !Number.isNaN(start) ? Math.min(max ?? 1, (Date.now() - start) / 1000 / seconds) : progress);
    let t = shown.current?.mode === mode ? shown.current.t : target();
    const draw = () => {
      const p = path.getPointAtLength(len * t);
      const q = path.getPointAtLength(Math.min(len, len * t + 1));
      const r = path.getPointAtLength(Math.max(0, len * t - 1));
      car.setAttribute("transform", `translate(${p.x} ${p.y}) rotate(${(Math.atan2(q.y - r.y, q.x - r.x) * 180) / Math.PI})`);
      if (mode === "trip" && trip) trip.style.strokeDashoffset = String(-t);
      shown.current = { mode, t };
    };
    let last = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      t += (target() - t) * Math.min(1, dt * 3);
      draw();
      raf = requestAnimationFrame(frame);
    };
    draw();
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [mode, progress, since, seconds, max]);

  const showRoute = mode !== "idle";

  return (
    <div style={{ position: "relative", height, borderRadius: radius, overflow: "hidden", background: "#e9eef6", ...style }}>
      <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} aria-hidden="true">
        {/* blocks */}
        <rect width="400" height="300" fill="#e9eef6" />
        <path d="M0 0h120v40H0zM160 0h90v44h-90zM290 0h110v30H290z" fill="#dfe6f1" />
        {/* parks + water */}
        <path d="M250 190 q30 -20 70 -6 q30 12 28 40 q-4 26 -44 26 q-44 -2 -58 -26 q-8 -20 4 -34z" fill="#cdebd6" />
        <path d="M14 20 q40 -8 64 10 q14 18 -8 30 q-30 12 -52 -6 q-14 -16 -4 -34z" fill="#cdebd6" />
        <path d="M0 268 C 80 250, 150 290, 230 272 S 360 250, 400 262 V300 H0z" fill="#c7ddf7" />
        {/* streets */}
        <g stroke="#ffffff" strokeLinecap="round" fill="none">
          <path d="M-10 110 H410" strokeWidth="14" />
          <path d="M-10 200 C 120 196, 200 210, 410 180" strokeWidth="12" />
          <path d="M140 -10 V310" strokeWidth="12" />
          <path d="M270 -10 C 262 100, 280 200, 262 310" strokeWidth="12" />
          <path d="M-10 50 H410 M-10 160 H410 M60 -10 V310 M210 -10 V310 M340 -10 V310" strokeWidth="6" />
          <path d="M20 300 L 380 20" strokeWidth="9" />
        </g>
        <g stroke="#f6d77b" strokeWidth="1.4" strokeDasharray="6 7" fill="none" opacity="0.8">
          <path d="M-10 110 H410" />
          <path d="M20 300 L 380 20" />
        </g>

        {nearby && NEARBY.map((c, i) => <Car key={i} x={c.x} y={c.y} angle={c.r} size={0.8} />)}

        {showRoute && (
          <>
            {mode === "approach" && <path ref={apprRef} d={APPROACH} stroke="var(--ink)" strokeWidth="3.5" strokeDasharray="2 6" strokeLinecap="round" fill="none" opacity="0.6" />}
            <path d={TRIP} stroke="#0847c7" strokeWidth="8" strokeLinecap="round" fill="none" opacity="0.18" />
            <path ref={tripRef} d={TRIP} stroke="var(--blue)" strokeWidth="5" strokeLinecap="round" fill="none" pathLength={1}
              strokeDasharray="1 1" />
            {/* pickup */}
            <circle cx="92" cy="232" r="11" fill="rgba(47,158,118,0.22)" />
            <circle cx="92" cy="232" r="6.5" fill="#2f9e76" stroke="white" strokeWidth="2.5" />
            {/* drop */}
            <g transform="translate(318 74)">
              <path d="M0 0 c-9 -12 -13 -17 -13 -24 a13 13 0 0 1 26 0 c0 7 -4 12 -13 24z" fill="#e03131" stroke="white" strokeWidth="2" />
              <circle cx="0" cy="-24" r="4.5" fill="white" />
            </g>
          </>
        )}

        {mode === "idle" && (
          <g transform="translate(200 150)">
            <circle r="30" fill="rgba(11,92,255,0.12)" className="map-pulse" />
            <circle r="10" fill="var(--blue)" stroke="white" strokeWidth="3.5" />
          </g>
        )}

        {moving && <g ref={carRef}><Car x={0} y={0} angle={0} size={1.15} /></g>}
      </svg>
      {children}
    </div>
  );
}
