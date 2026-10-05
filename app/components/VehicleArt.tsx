"use client";

import { useId } from "react";
import type { VehicleKind } from "../lib/data";

/* Glossy three-quarter vehicle illustrations (front-left view), like the ride-hailing reference art. */

const GLASS_TOP = "#3a4658";
const GLASS_BOT = "#111827";

/** Shared gradients; ids are scoped per instance so many icons can live on one page. */
function Defs({ id, body }: { id: string; body: [string, string, string] }) {
  return (
    <defs>
      <linearGradient id={`${id}b`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={body[0]} /><stop offset="0.55" stopColor={body[1]} /><stop offset="1" stopColor={body[2]} />
      </linearGradient>
      <linearGradient id={`${id}g`} x1="0" y1="0" x2="0.3" y2="1">
        <stop offset="0" stopColor={GLASS_TOP} /><stop offset="1" stopColor={GLASS_BOT} />
      </linearGradient>
      <radialGradient id={`${id}r`} cx="0.4" cy="0.35" r="0.7">
        <stop offset="0" stopColor="#f4f6fa" /><stop offset="1" stopColor="#8a94a6" />
      </radialGradient>
    </defs>
  );
}

const useGid = () => "v" + useId().replace(/[^a-zA-Z0-9]/g, "");

/** Wheel seen at an angle: dark tyre ellipse with a metallic rim. */
function Wheel({ id, x, y = 38, r = 5.6 }: { id: string; x: number; y?: number; r?: number }) {
  return (
    <g>
      <ellipse cx={x} cy={y} rx={r * 0.82} ry={r} fill="#161b26" />
      <ellipse cx={x + 0.4} cy={y} rx={r * 0.48} ry={r * 0.6} fill={`url(#${id}r)`} />
      <ellipse cx={x + 0.4} cy={y} rx={r * 0.16} ry={r * 0.2} fill="#4b5563" />
    </g>
  );
}

type CarSpec = {
  rear: number;     // x of rear bumper
  cabin: number;    // x where the cabin starts at the back
  roof: number;     // y of roof line
  body: [string, string, string];
  accent?: [string, string, string];  // rear-quarter colour band
  wheelR?: number;
};

const WHITE: [string, string, string] = ["#ffffff", "#f1f3f7", "#cdd3dd"];
const YELLOW: [string, string, string] = ["#ffe066", "#f7c600", "#d9a400"];

const CARS: Record<"mini" | "sedan" | "suv" | "taxi", CarSpec> = {
  mini:  { rear: 9, cabin: 14, roof: 11,  body: WHITE, accent: YELLOW },
  sedan: { rear: 4, cabin: 21, roof: 11.5, body: WHITE, accent: YELLOW },
  suv:   { rear: 6, cabin: 8,  roof: 8,   body: WHITE, accent: YELLOW, wheelR: 6.2 },
  taxi:  { rear: 7, cabin: 15, roof: 11,  body: YELLOW },
};

/** Rounded compact car, three-quarter view facing right (front at right). */
function Car({ kind }: { kind: keyof typeof CARS }) {
  const id = useGid();
  const s = CARS[kind];
  const { rear: R, cabin: C, roof: Y } = s;
  const wr = s.wheelR ?? 5.6;
  const B = 37.8;
  const side = `M${R} 35.6 Q${R - 1} 27.4 ${R + 6} 25.6 L56 23.2 Q62.6 23.2 63 28 V${B} H${R + 3} Q${R} ${B} ${R} 35.6 Z`;
  const face = `M63 28 Q63 23.4 58 23.2 L66 23.6 Q73 25 74 30 V35.6 Q74 ${B} 71.4 ${B} H63 Z`;
  const mid = (R + 56) / 2 - 2;
  return (
    <>
      <Defs id={id} body={s.body} />
      {s.accent && (
        <linearGradient id={`${id}a`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={s.accent[0]} /><stop offset="0.55" stopColor={s.accent[1]} /><stop offset="1" stopColor={s.accent[2]} />
        </linearGradient>
      )}
      {/* far-side front wheel */}
      <ellipse cx="71" cy={B - 0.6} rx="2.6" ry="4" fill="#161b26" />
      {/* cabin dome */}
      <path d={`M${C} 25.4 Q${C + 2} ${Y + 1.4} ${C + 14} ${Y} L45 ${Y - 0.2} Q51.5 ${Y} 56 ${Y + 4.6} L63 23.4 L${C} 25.4 Z`} fill={`url(#${id}b)`} />
      {/* side windows + pillar */}
      <path d={`M${C + 4} 24.6 Q${C + 5.4} ${Y + 3.2} ${C + 14} ${Y + 2.4} L44 ${Y + 2.1} Q48 ${Y + 2.1} 50.4 ${Y + 4.8} L54.4 23.3 Z`} fill={`url(#${id}g)`} />
      <path d={`M${(C + 58) / 2} ${Y + 2.3} L${(C + 58) / 2 + 0.8} 24`} stroke={s.body[1]} strokeWidth="1.8" />
      {/* windscreen */}
      <path d={`M51.6 ${Y + 2} Q55 ${Y + 1.6} 58 ${Y + 5} L64.6 23.4 L57.6 23.2 Z`} fill={`url(#${id}g)`} />
      <path d={`M56 ${Y + 3} L60.6 21`} stroke="white" strokeOpacity="0.3" strokeWidth="1.1" strokeLinecap="round" />
      {/* roof highlight */}
      <path d={`M${C + 8} ${Y + 0.8} Q${C + 12} ${Y - 0.1} ${C + 16} ${Y}  L44 ${Y - 0.1}`} stroke="white" strokeWidth="1.1" strokeLinecap="round" fill="none" />
      {/* body */}
      <path d={side} fill={`url(#${id}b)`} />
      {s.accent && <path d={`M${R} 35.6 Q${R - 1} 27.4 ${R + 6} 25.6 L${mid} 24.4 L${mid - 2.4} ${B} H${R + 3} Q${R} ${B} ${R} 35.6 Z`} fill={`url(#${id}a)`} />}
      {kind === "taxi" && (
        <>
          <path d={`M${R + 1} 30.4 L63 29.4`} stroke="#111827" strokeWidth="2" strokeDasharray="2 2" />
          <path d={`M${C + 12} ${Y + 0.2} l2 -3.4 h8 l1.6 3.2 z`} fill="#111827" />
          <rect x={C + 15.2} y={Y - 2.6} width="5.8" height="1.4" rx="0.5" fill="#f7c600" />
        </>
      )}
      {kind === "suv" && <path d={`M${C + 7} ${Y - 1} L44 ${Y - 1.3}`} stroke="#1f2937" strokeWidth="1.3" strokeLinecap="round" />}
      <path d={`M${R + 5} 27.2 L62 25.6`} stroke="white" strokeOpacity="0.8" strokeWidth="0.9" strokeLinecap="round" />
      {/* door seam + handle */}
      <path d={`M${(C + 58) / 2 + 0.8} 24.2 V${B - 1.6}`} stroke="#0f1729" strokeOpacity="0.16" strokeWidth="0.7" />
      <rect x={(C + 58) / 2 + 2.4} y="27.2" width="3.2" height="0.9" rx="0.45" fill="#0f1729" opacity="0.3" />
      <path d={`M${R + 0.6} 28.2 V31`} stroke="#e23d3d" strokeWidth="1.5" strokeLinecap="round" />
      {/* front face */}
      <path d={face} fill={`url(#${id}b)`} />
      <path d={face} fill="#0f1729" opacity="0.07" />
      <ellipse cx="65.6" cy="28" rx="1.7" ry="1.25" fill="#fff7d6" stroke="#9aa3b2" strokeWidth="0.4" />
      <ellipse cx="72.4" cy="29.4" rx="1.2" ry="1.15" fill="#fff7d6" stroke="#9aa3b2" strokeWidth="0.4" />
      <rect x="66.4" y="31.6" width="6" height="2.2" rx="1" fill="#1f2937" />
      {/* sill shade */}
      <path d={`M${R + 1} ${B - 3} L74 ${B - 3.4} V35.6 Q74 ${B} 71.4 ${B} H${R + 3} Q${R} ${B} ${R} 35.6 Z`} fill="#0f1729" opacity="0.12" />
      {/* wheels */}
      <ellipse cx={R + 12} cy={B - 0.6} rx={wr * 1.04} ry={wr * 1.14} fill="#0f1729" opacity="0.5" />
      <ellipse cx="55" cy={B - 0.6} rx={wr * 1.04} ry={wr * 1.14} fill="#0f1729" opacity="0.5" />
      <Wheel id={id} x={R + 12} y={B} r={wr} />
      <Wheel id={id} x={55} y={B} r={wr} />
    </>
  );
}

/** Commuter motorcycle, glossy white with black seat — no rider. */
function Bike() {
  const id = useGid();
  return (
    <>
      <Defs id={id} body={["#ffffff", "#eef1f6", "#bfc7d4"]} />
      {/* rear wheel */}
      <ellipse cx="59" cy="36" rx="7.4" ry="8.4" fill="#161b26" />
      <ellipse cx="59.4" cy="36" rx="4.2" ry="5" fill={`url(#${id}r)`} />
      <ellipse cx="59.4" cy="36" rx="1.4" ry="1.7" fill="#4b5563" />
      {/* swing arm + chain guard */}
      <path d="M44 33 L59 36" stroke="#1f2937" strokeWidth="2.6" strokeLinecap="round" />
      {/* engine block */}
      <path d="M33 27 L45 27.5 L46 35 Q40 37.5 34 35 Z" fill="#2b3240" />
      <path d="M35 29 H43 M35 31.5 H43" stroke="#6b7280" strokeWidth="0.8" />
      {/* exhaust */}
      <path d="M38 36.5 L62 33.2" stroke="#d1d5db" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M50 35 L62 33.2" stroke="#9aa3b2" strokeWidth="1" strokeLinecap="round" />
      {/* tail / side panel */}
      <path d="M44 22 L62 19.5 Q67 19.5 68 22 L66 23.5 L56 27 L45 28 Z" fill={`url(#${id}b)`} />
      <path d="M45 27.5 L56 27 L66 23.5" stroke="#0f1729" strokeOpacity="0.15" strokeWidth="0.7" fill="none" />
      <path d="M66.6 21.2 L68.6 21.6" stroke="#e23d3d" strokeWidth="1.6" strokeLinecap="round" />
      {/* seat */}
      <path d="M40 19.5 Q48 16.8 60 17.6 Q64 18 63 19.8 L45 22.2 Q41 22.4 40 19.5 Z" fill="#1a1f2b" />
      <path d="M44 18.6 Q51 17.4 59 17.9" stroke="white" strokeOpacity="0.25" strokeWidth="0.8" strokeLinecap="round" />
      {/* fuel tank */}
      <path d="M26 21 Q27 15 35 14.6 L41 15 Q44 16 44 20 L43 24 Q34 26.5 27 24.5 Z" fill={`url(#${id}b)`} />
      <path d="M28.5 17.8 Q32 15.6 38 15.6" stroke="white" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M29 22.5 Q35 23.8 42 22" stroke="#f5b400" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M27 24.5 Q34 26.5 43 24 L44 27.6 L33 27.4 Z" fill="#1f2937" />
      {/* front fork + mudguard */}
      <path d="M23.5 16 L17 36" stroke="#c7cdd8" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M21.5 15.5 L15.5 35.5" stroke="#9aa3b2" strokeWidth="1.6" strokeLinecap="round" />
      {/* front wheel */}
      <ellipse cx="16" cy="36.5" rx="6.6" ry="7.8" fill="#161b26" />
      <ellipse cx="16.4" cy="36.5" rx="3.7" ry="4.6" fill={`url(#${id}r)`} />
      <ellipse cx="16.4" cy="36.5" rx="1.2" ry="1.5" fill="#4b5563" />
      <path d="M9.5 30 Q15 24.8 22 28.4" stroke="#f3f4f6" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      {/* headlight cowl */}
      <path d="M18 14 Q20 9.6 25.5 10.4 L27 16.8 Q22.5 19 19 18 Z" fill={`url(#${id}b)`} />
      <ellipse cx="20.6" cy="15.2" rx="2.7" ry="3.1" fill="#fff7d6" stroke="#9aa3b2" strokeWidth="0.9" />
      <ellipse cx="20" cy="14.4" rx="0.9" ry="1" fill="white" />
      {/* handlebars + mirrors */}
      <path d="M24 11 L31 9 M24 11 L19 9.6" stroke="#1f2937" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M29.5 9.4 L30.2 6.6 M20.4 10 L19.6 7.4" stroke="#1f2937" strokeWidth="0.8" />
      <ellipse cx="30.5" cy="6" rx="1.6" ry="1.1" fill="#1f2937" />
      <ellipse cx="19.4" cy="6.8" rx="1.5" ry="1.05" fill="#1f2937" />
    </>
  );
}

/** Classic Indian auto-rickshaw, three-quarter view facing right: yellow canopy, green body. */
function Auto() {
  const id = useGid();
  return (
    <>
      <Defs id={id} body={["#4ade80", "#16a34a", "#0f7a3a"]} />
      <linearGradient id={`${id}y`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ffe066" /><stop offset="1" stopColor="#e9b500" />
      </linearGradient>
      <g transform="translate(16 0) scale(0.78 1)">
      {/* canopy side with open doorway */}
      <path d="M11 26 V14.5 Q11 8 18.5 7.6 L51 7 Q56 7 57.6 10.4 L58.6 26 Z" fill={`url(#${id}y)`} />
      <path d="M17 25.6 V15.4 Q17 12.6 20.6 12.4 L54 12 L54.6 25.6 Z" fill="#111827" />
      <rect x="36" y="17" width="15" height="8.6" rx="1.4" fill="#2b3240" />
      <path d="M17 18.6 H54.2" stroke="#3a4658" strokeWidth="0.8" />
      <path d="M18.5 8.6 L51 8" stroke="white" strokeOpacity="0.7" strokeWidth="1" strokeLinecap="round" />
      {/* canopy front + windscreen */}
      <path d="M57.6 10.4 Q60 7.2 64.4 7.8 Q70.6 9.4 71 16.6 L71 25.2 L58.6 26 Z" fill={`url(#${id}y)`} />
      <path d="M57.6 10.4 Q60 7.2 64.4 7.8 Q70.6 9.4 71 16.6 L71 25.2 L58.6 26 Z" fill="#0f1729" opacity="0.08" />
      <path d="M60.2 12.4 Q64 10.4 68.2 12.6 L68.8 21.6 L60.6 22.2 Z" fill={`url(#${id}g)`} />
      <path d="M62 13 L63 20.6" stroke="white" strokeOpacity="0.3" strokeWidth="1" strokeLinecap="round" />
      {/* lower body */}
      <path d="M9 30.6 Q9 25.6 13 25.6 L58.6 25.2 L71 24.6 Q73.4 25.4 73.4 28.4 L72.6 34.4 Q72 36.4 69 36.4 L13 37.2 Q9 37 9 34.6 Z" fill={`url(#${id}b)`} />
      <path d="M58.6 25.2 L71 24.6 Q73.4 25.4 73.4 28.4 L72.6 34.4 Q72 36.4 69 36.4 L58.6 36.6 Z" fill="#0f1729" opacity="0.1" />
      <path d="M10 28.6 L72.6 27.6" stroke="#f7c600" strokeWidth="1.3" />
      <path d="M10 34.6 L72 33.8" stroke="#111827" strokeWidth="1.6" opacity="0.7" />
      <path d="M9.6 27 V30" stroke="#e23d3d" strokeWidth="1.5" strokeLinecap="round" />
      {/* headlight on the nose */}
      <circle cx="66.4" cy="30.8" r="1.7" fill="#fff7d6" stroke="#4b5563" strokeWidth="0.5" />
      {/* wheels: rear on the visible side, single front wheel under the nose */}
      <ellipse cx="23" cy="37.2" rx="5.8" ry="6.4" fill="#0f1729" opacity="0.5" />
      <Wheel id={id} x={23} y={38} r={5.4} />
      <Wheel id={id} x={65.4} y={39} r={4.6} />
      </g>
    </>
  );
}

/** Battery e-rickshaw, side view: flat roof on poles, front handlebar, open bench, rear seat over the back wheel. */
function ERick() {
  const id = useGid();
  const wheel = (x: number, r: number) => (
    <g>
      <circle cx={x} cy={37.5} r={r} fill="#161b26" />
      <circle cx={x} cy={37.5} r={r * 0.62} fill={`url(#${id}r)`} />
      <circle cx={x} cy={37.5} r={r * 0.2} fill="#4b5563" />
    </g>
  );
  return (
    <>
      <Defs id={id} body={["#4f8ff7", "#1d5fe0", "#0b3aa8"]} />
      {/* roof */}
      <path d="M17.5 5.4 H72 Q75 5.4 75 7.2 Q75 9 72 9 H17.5 Q16 9 16 7.2 Q16 5.4 17.5 5.4 Z" fill={`url(#${id}b)`} />
      <path d="M19 6.3 H71" stroke="white" strokeOpacity="0.55" strokeWidth="0.8" strokeLinecap="round" />
      {/* poles */}
      <path d="M37.5 9 V27 M70.5 9 V25" stroke="#1d5fe0" strokeWidth="1.3" />
      <rect x="36.3" y="16.5" width="2.4" height="8" rx="0.8" fill="#0b3aa8" />
      <rect x="69.4" y="14.5" width="2.2" height="9" rx="0.8" fill="#0b3aa8" />
      {/* rear body */}
      <path d="M46 36 L48 30.5 Q49 28.4 52 28.2 L71 27.6 Q72.6 27.6 72.6 29.4 V36.4 Q72.6 37.6 71.4 37.6 H69 A7.6 7.6 0 0 0 54 37.6 Z" fill={`url(#${id}b)`} />
      <path d="M49 30.4 L71.6 29.8" stroke="white" strokeOpacity="0.5" strokeWidth="0.8" />
      <path d="M71.8 31 V33.6" stroke="#e23d3d" strokeWidth="1.4" strokeLinecap="round" />
      {/* rear seat */}
      <rect x="59" y="23.6" width="12.6" height="4" rx="1.6" fill="#eaf1ff" stroke="#1d5fe0" strokeWidth="0.9" />
      <path d="M71 21 V27.6" stroke="#1d5fe0" strokeWidth="1.3" strokeLinecap="round" />
      {/* floor + frame to the front fork */}
      <path d="M18.5 35.2 L48 35.2 L47.4 37.6 H18.5 Z" fill="#0b3aa8" />
      <path d="M19 23 L21 35.6" stroke="#0b3aa8" strokeWidth="2.2" strokeLinecap="round" />
      {/* front bench */}
      <path d="M28 28.4 H47 V35.4 H28 Z" fill={`url(#${id}b)`} />
      <rect x="27.4" y="25.2" width="20.2" height="3.6" rx="1.4" fill="#eaf1ff" stroke="#1d5fe0" strokeWidth="0.9" />
      <path d="M37.5 25 V28.8" stroke="#1d5fe0" strokeWidth="0.9" />
      <path d="M29 30 H46" stroke="white" strokeOpacity="0.4" strokeWidth="0.7" />
      {/* foot pedal */}
      <path d="M22.5 34.6 L24 31.6" stroke="#1f2937" strokeWidth="1" strokeLinecap="round" />
      {/* front fork, handlebar, headlight basket */}
      <path d="M18.4 21 L12 37.5" stroke="#9aa3b2" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M16.6 20.6 L22 19.8 M18.4 21 L17 19.6" stroke="#1f2937" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M12.6 22.6 Q12.4 26.6 15.4 27 Q18.2 26.8 18.2 22.8 Z" fill={`url(#${id}b)`} />
      <ellipse cx="13.4" cy="24.4" rx="1.1" ry="1.3" fill="#fff7d6" />
      {wheel(12, 6)}
      {wheel(61.5, 6.6)}
    </>
  );
}

/** Rendered vehicle photos (trimmed, from public/vehicles); kinds not listed fall back to the SVG art. */
const PHOTOS: Partial<Record<VehicleKind, string>> = {
  bike: "/vehicles/bike.webp",
  auto: "/vehicles/auto.webp",
  erick: "/vehicles/erick.webp",
  mini: "/vehicles/mini.webp",
  sedan: "/vehicles/sedan.webp",
};

export default function VehicleArt({ kind, size = 56 }: { kind: VehicleKind; size?: number }) {
  const h = Math.round(size * 0.62);
  const photo = PHOTOS[kind];
  if (photo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photo} alt="" aria-hidden="true" width={size} height={h} draggable={false} style={{ width: size, height: h, objectFit: "contain", display: "block" }} />;
  }
  return (
    <svg width={size} height={h} viewBox="0 0 80 50" fill="none" aria-hidden="true">
      <ellipse cx={kind === "auto" ? 45 : 41} cy="45" rx={kind === "auto" ? 28 : 34} ry="3.2" fill="rgba(15,23,41,0.13)" />
      {kind === "bike" ? <Bike /> : kind === "auto" ? <Auto /> : kind === "erick" ? <ERick /> : <Car kind={kind} />}
    </svg>
  );
}

/** "Book Any" — two cars, one behind the other. */
export function AnyArt({ size = 56 }: { size?: number }) {
  return (
    <span style={{ position: "relative", display: "inline-block", width: size, height: Math.round(size * 0.62) }}>
      <span style={{ position: "absolute", left: size * 0.24, top: -size * 0.07, opacity: 0.9 }}><VehicleArt kind="sedan" size={size * 0.8} /></span>
      <span style={{ position: "absolute", left: 0, top: size * 0.08 }}><VehicleArt kind="mini" size={size * 0.8} /></span>
    </span>
  );
}

/** Hourly rental — car with a clock badge. */
export function RentalArt({ size = 56 }: { size?: number }) {
  const b = size * 0.36;
  return (
    <span style={{ position: "relative", display: "inline-block", width: size, height: Math.round(size * 0.62) }}>
      <VehicleArt kind="mini" size={size} />
      <svg width={b} height={b} viewBox="0 0 24 24" style={{ position: "absolute", left: -2, top: -4 }} aria-hidden="true">
        <circle cx="12" cy="12" r="11" fill="var(--green)" />
        <circle cx="12" cy="12" r="7.5" fill="white" />
        <path d="M12 8v4.5l2.8 1.8" stroke="#0f1729" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      </svg>
    </span>
  );
}

/** Parcel — delivery rider on a scooter (photo). */
export function ParcelArt({ size = 56 }: { size?: number }) {
  const h = Math.round(size * 0.62);
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/vehicles/parcel.webp" alt="" aria-hidden="true" width={size} height={h} draggable={false} style={{ width: size, height: h, objectFit: "contain", display: "block" }} />;
}
