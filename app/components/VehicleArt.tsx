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
  rear: number;      // x of rear bumper
  roof: number;      // y of roof line
  roofEnd: number;   // x where the roof starts falling to the rear
  tail: number;      // x where the rear glass meets the beltline
  belt: number;      // y of beltline at the rear
  body: [string, string, string];
  stripe?: string;
  wheelR?: number;
};

const CARS: Record<"mini" | "sedan" | "suv" | "taxi", CarSpec> = {
  mini:  { rear: 70, roof: 12.5, roofEnd: 57, tail: 66, belt: 25,   body: ["#ffffff", "#eef1f6", "#c9d0dc"], stripe: "#1d5fe0" },
  sedan: { rear: 76, roof: 12,   roofEnd: 54, tail: 63, belt: 24.5, body: ["#ffffff", "#e8ebf1", "#b9c1cf"], stripe: "#0b2a6b" },
  suv:   { rear: 76, roof: 8.5,  roofEnd: 69, tail: 73, belt: 23,   body: ["#ffffff", "#e9edf3", "#bcc4d1"], stripe: "#1d5fe0", wheelR: 6.4 },
  taxi:  { rear: 75, roof: 12,   roofEnd: 54, tail: 63, belt: 24.5, body: ["#ffe27a", "#f9c80e", "#d9a400"] },
};

function Car({ kind }: { kind: keyof typeof CARS }) {
  const id = useGid();
  const s = CARS[kind];
  const wr = s.wheelR ?? 5.6;
  const bottom = 38.5;
  return (
    <>
      <Defs id={id} body={s.body} />
      {/* far-side front wheel peeking out */}
      <ellipse cx="9.5" cy={bottom - 0.5} rx="2.6" ry="4" fill="#161b26" />
      {/* side panel */}
      <path d={`M18 27 L${s.rear - 4} ${s.belt} Q${s.rear} ${s.belt + 0.5} ${s.rear} ${s.belt + 4.5} V${bottom - 2.5} Q${s.rear} ${bottom - 0.5} ${s.rear - 2.5} ${bottom - 0.5} L18 ${bottom} Z`} fill={`url(#${id}b)`} />
      {/* front face (angled away, a touch darker) */}
      <path d={`M6 30.5 Q6 27.4 9 27 L18 27 L18 ${bottom} L8.5 ${bottom - 0.6} Q6 ${bottom - 1} 6 ${bottom - 3} Z`} fill={`url(#${id}b)`} />
      <path d={`M6 30.5 Q6 27.4 9 27 L18 27 L18 ${bottom} L8.5 ${bottom - 0.6} Q6 ${bottom - 1} 6 ${bottom - 3} Z`} fill="#0f1729" opacity="0.1" />
      {/* hood */}
      <path d={`M8.5 27.2 L18 27.2 L28 ${s.belt - 2.5} L17.5 ${s.belt - 2.2} Z`} fill={s.body[0]} />
      <path d={`M8.5 27.2 L18 27.2 L28 ${s.belt - 2.5} L17.5 ${s.belt - 2.2} Z`} fill="#0f1729" opacity="0.05" />
      {/* upper body around the glass */}
      <path d={`M17.5 ${s.belt - 2.2} L27 ${s.roof + 0.6} L${s.roofEnd} ${s.roof} L${s.tail} ${s.belt - 0.3} L${s.rear - 3} ${s.belt} L18 27 Z`} fill={`url(#${id}b)`} />
      {/* windscreen */}
      <path d={`M18.6 ${s.belt - 2.4} L27.6 ${s.belt - 2.8} L35 ${s.roof + 1.3} L27.4 ${s.roof + 1.6} Z`} fill={`url(#${id}g)`} />
      {/* side windows */}
      <path d={`M30 ${s.belt - 2.6} L${s.tail - 2} ${s.belt - 1.4} L${s.roofEnd - 1} ${s.roof + 1.6} L37 ${s.roof + 1.5} Z`} fill={`url(#${id}g)`} />
      <path d={`M${(30 + s.tail) / 2 + 1} ${s.belt - 2} L${(37 + s.roofEnd) / 2 + 1} ${s.roof + 1.5}`} stroke={s.body[1]} strokeWidth="1.6" />
      {/* glass reflection */}
      <path d={`M22 ${s.belt - 3} L28.5 ${s.roof + 2}`} stroke="white" strokeOpacity="0.28" strokeWidth="1.4" strokeLinecap="round" />
      {/* roof highlight */}
      <path d={`M27.5 ${s.roof + 0.4} L${s.roofEnd - 1} ${s.roof - 0.1}`} stroke="white" strokeWidth="1.1" strokeLinecap="round" opacity="0.9" />
      {/* door seam, handle */}
      <path d={`M${(30 + s.tail) / 2 + 1} ${s.belt - 1.4} V${bottom - 1.5}`} stroke="#0f1729" strokeOpacity="0.14" strokeWidth="0.7" />
      <rect x={(30 + s.tail) / 2 + 3} y={s.belt + 2.2} width="3.4" height="1" rx="0.5" fill="#0f1729" opacity="0.3" />
      {/* brand stripe / taxi chequer */}
      {s.stripe && <path d={`M18 31.6 L${s.rear} ${s.belt + 4.8}`} stroke={s.stripe} strokeWidth="1.5" />}
      {kind === "taxi" && (
        <>
          <path d={`M18 31.2 L${s.rear} ${s.belt + 4.4}`} stroke="#111827" strokeWidth="2.2" strokeDasharray="2 2" />
          <path d={`M27.5 ${s.roof + 0.5} l3 -3.4 h9 l2 3.2 z`} fill="#111827" />
          <rect x="31.4" y={s.roof - 2.4} width="7" height="1.6" rx="0.5" fill="#f9c80e" />
        </>
      )}
      {kind === "suv" && <path d={`M28 ${s.roof - 1} L${s.roofEnd - 1} ${s.roof - 1.4}`} stroke="#1f2937" strokeWidth="1.3" strokeLinecap="round" />}
      {/* lower body shading + sill */}
      <path d={`M18 ${bottom - 3} L${s.rear} ${bottom - 3.4} V${bottom - 2.5} Q${s.rear} ${bottom - 0.5} ${s.rear - 2.5} ${bottom - 0.5} L18 ${bottom} Z`} fill="#0f1729" opacity="0.12" />
      {/* face: grille + headlights */}
      <rect x="9" y="32.4" width="7.5" height="2.6" rx="1" fill="#1f2937" />
      <path d="M6.6 29.2 Q8 28.4 10.6 28.6 L10.4 30.6 Q8 30.8 6.6 30.6 Z" fill="#fff7d6" stroke="#9aa3b2" strokeWidth="0.4" />
      <path d="M14.2 28.7 L17.6 28.8 L17.6 30.8 L14.2 30.6 Z" fill="#fff7d6" stroke="#9aa3b2" strokeWidth="0.4" />
      <path d={`M${s.rear - 1.6} ${s.belt + 1.4} V${s.belt + 4}`} stroke="#e23d3d" strokeWidth="1.6" strokeLinecap="round" />
      {/* wheel arches + wheels */}
      <ellipse cx="25" cy={bottom - 0.5} rx={wr * 1.02} ry={wr * 1.15} fill="#0f1729" opacity="0.55" />
      <ellipse cx={s.rear - 11} cy={bottom - 0.8} rx={wr * 1.02} ry={wr * 1.15} fill="#0f1729" opacity="0.55" />
      <Wheel id={id} x={25} y={bottom} r={wr} />
      <Wheel id={id} x={s.rear - 11} y={bottom - 0.3} r={wr} />
    </>
  );
}

/** Motorbike with rider in helmet. */
function Bike() {
  const id = useGid();
  return (
    <>
      <Defs id={id} body={["#3b82f6", "#1d5fe0", "#0b3aa8"]} />
      {/* rear wheel */}
      <ellipse cx="58" cy="37" rx="6.4" ry="7.4" fill="#161b26" />
      <ellipse cx="58.3" cy="37" rx="3.4" ry="4.2" fill={`url(#${id}r)`} />
      {/* frame + exhaust */}
      <path d="M60 33 L46 31 L34 33" stroke="#1f2937" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M44 36 L64 35.2" stroke="#9aa3b2" strokeWidth="2" strokeLinecap="round" />
      {/* tank + body */}
      <path d="M30 27 Q33 22 42 22.5 L52 24 Q57 25 58 29 L46 30.5 Q36 31 30 27 Z" fill={`url(#${id}b)`} />
      <path d="M33 24.5 Q38 22.8 44 23.6" stroke="white" strokeOpacity="0.6" strokeWidth="1" strokeLinecap="round" />
      {/* seat */}
      <path d="M44 23.5 Q52 21.5 61 24.5 L60 26.5 Q52 25 45 25.6 Z" fill="#111827" />
      {/* engine */}
      <rect x="37" y="29" width="10" height="6" rx="2" fill="#4b5563" />
      {/* front fork + wheel */}
      <path d="M28 21 L22 37" stroke="#9aa3b2" strokeWidth="2.2" strokeLinecap="round" />
      <ellipse cx="21" cy="37.5" rx="6" ry="7" fill="#161b26" />
      <ellipse cx="21.3" cy="37.5" rx="3.2" ry="4" fill={`url(#${id}r)`} />
      <path d="M15.5 30 Q21 26.5 26.5 30" stroke="#1d5fe0" strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* headlight + bars */}
      <ellipse cx="27" cy="21.5" rx="2.6" ry="3" fill="#fff7d6" stroke="#4b5563" strokeWidth="0.8" />
      <path d="M29 18.5 L34 17" stroke="#111827" strokeWidth="1.8" strokeLinecap="round" />
      {/* rider: leg, torso, arm, helmet */}
      <path d="M50 22 L43 27.5 L41 33" stroke="#334155" strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M41 33.2 L44.5 33.4" stroke="#111827" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M47 23 Q46 15 42 11 L50 9 Q54 15 53 22.5 Z" fill="#16a34a" />
      <path d="M44 13 L36 17.5" stroke="#16a34a" strokeWidth="3.4" strokeLinecap="round" />
      <circle cx="35.2" cy="17.7" r="1.4" fill="#f1c7a3" />
      <circle cx="46" cy="7" r="5.2" fill="#facc15" />
      <path d="M41 6.5 Q41.2 3 45 2.2" stroke="white" strokeOpacity="0.7" strokeWidth="1" strokeLinecap="round" fill="none" />
      <path d="M40.8 7.4 Q42.5 10.4 46 10.6 L46.4 7 Z" fill="#111827" />
    </>
  );
}

/** Classic Indian auto-rickshaw: green body, yellow canopy. */
function Auto() {
  const id = useGid();
  return (
    <>
      <Defs id={id} body={["#34d399", "#16a34a", "#0f7a3a"]} />
      <ellipse cx="12" cy="37.5" rx="2.6" ry="4" fill="#161b26" />
      {/* canopy */}
      <path d="M14 21 Q15 9 28 7.5 L64 7 Q70 7.4 70 13 L70 22 L60 22 L58 12 L30 12 Q22 13 21 21 Z" fill="#facc15" />
      <path d="M28 8 L64 7.6" stroke="white" strokeOpacity="0.7" strokeWidth="1" strokeLinecap="round" />
      <path d="M14 21 Q15 9 28 7.5 L30 12 Q22 13 21 21 Z" fill="#0f1729" opacity="0.08" />
      {/* windscreen */}
      <path d="M16 22 Q17 13.5 27 12.8 L29 22 Z" fill={`url(#${id}g)`} />
      {/* open cabin interior */}
      <path d="M31 12.5 L57 12.4 L59 22 L31 22 Z" fill="#1f2937" />
      <rect x="42" y="16" width="12" height="6" rx="1.5" fill="#7c2d12" />
      {/* lower body */}
      <path d="M8 27 Q9 22.5 14 22 L70 21.5 Q72 22 72 25 V34 Q72 36 70 36 L14 37 Q8 36.5 8 33 Z" fill={`url(#${id}b)`} />
      <path d="M8 27 Q9 22.5 14 22 L20 22 L19 37 L14 37 Q8 36.5 8 33 Z" fill="#0f1729" opacity="0.1" />
      <path d="M20 26.5 L71 26" stroke="#facc15" strokeWidth="1.4" />
      <ellipse cx="12.5" cy="29.5" rx="2" ry="2.2" fill="#fff7d6" stroke="#4b5563" strokeWidth="0.6" />
      <path d="M70.6 23.5 V27" stroke="#e23d3d" strokeWidth="1.6" strokeLinecap="round" />
      <Wheel id={id} x={22} y={38} r={5.2} />
      <ellipse cx="60" cy="37" rx="5.6" ry="6.2" fill="#0f1729" opacity="0.5" />
      <Wheel id={id} x={60} y={38} r={5.2} />
    </>
  );
}

/** Battery e-rickshaw: flat roof on pillars, open sides, rear bench. */
function ERick() {
  const id = useGid();
  return (
    <>
      <Defs id={id} body={["#60a5fa", "#1d5fe0", "#0b3aa8"]} />
      <ellipse cx="11" cy="37.5" rx="2.4" ry="3.8" fill="#161b26" />
      {/* roof */}
      <path d="M12 9 L70 7.5 Q73 7.6 73 10 L72 12 L12 13 Q10 12.6 10 11 Q10 9.2 12 9 Z" fill="#e5e7eb" />
      <path d="M12 9 L70 7.5 Q73 7.6 73 10 L72 10.6 L12 11.2 Z" fill="#16a34a" />
      <path d="M14 9.2 L68 8" stroke="white" strokeOpacity="0.75" strokeWidth="0.9" strokeLinecap="round" />
      {/* pillars */}
      <path d="M15 13 L16.5 24 M35 12.6 L35 24 M70.5 12 L70.5 24" stroke="#9aa3b2" strokeWidth="1.6" strokeLinecap="round" />
      {/* windscreen */}
      <path d="M15.6 13.4 L22 13.3 L23 24 L16.6 24 Z" fill={`url(#${id}g)`} opacity="0.85" />
      {/* driver + rear bench */}
      <circle cx="28" cy="16" r="2.4" fill="#334155" />
      <path d="M26 24 V20 Q28 18 30 20 V24 Z" fill="#334155" />
      <path d="M44 15 H66 V24 H44 Z" fill="#1f2937" opacity="0.18" />
      <rect x="47" y="17" width="16" height="7" rx="1.5" fill="#7c2d12" />
      {/* body tub */}
      <path d="M9 28 Q9.5 24 14 24 L72 23.5 Q74 23.6 74 26 V33.5 Q74 35.5 72 35.5 L14 36.5 Q9 36.2 9 33 Z" fill={`url(#${id}b)`} />
      <path d="M9 28 Q9.5 24 14 24 L19 24 L18.5 36.5 L14 36.5 Q9 36.2 9 33 Z" fill="#0f1729" opacity="0.12" />
      <path d="M19 28 L73.5 27.5" stroke="white" strokeOpacity="0.55" strokeWidth="1" />
      <text x="40" y="33.6" fontSize="4.6" fontWeight="700" fill="white" fontFamily="sans-serif">E</text>
      <path d="M43.6 29.6 l-1.2 2.2 h1.6 l-1.2 2.2" stroke="#facc15" strokeWidth="0.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <ellipse cx="13" cy="29.6" rx="1.9" ry="2.1" fill="#fff7d6" stroke="#4b5563" strokeWidth="0.6" />
      <path d="M73.3 25.6 V29" stroke="#e23d3d" strokeWidth="1.5" strokeLinecap="round" />
      <Wheel id={id} x={21} y={38} r={4.8} />
      <ellipse cx="62" cy="37" rx="5.2" ry="5.8" fill="#0f1729" opacity="0.5" />
      <Wheel id={id} x={62} y={38} r={4.8} />
    </>
  );
}

export default function VehicleArt({ kind, size = 56 }: { kind: VehicleKind; size?: number }) {
  const h = Math.round(size * 0.62);
  return (
    <svg width={size} height={h} viewBox="0 0 80 50" fill="none" aria-hidden="true">
      <ellipse cx="41" cy="45" rx="34" ry="3.2" fill="rgba(15,23,41,0.13)" />
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

/** Parcel — delivery rider on an orange scooter with a red box. */
export function ParcelArt({ size = 56 }: { size?: number }) {
  const id = useGid();
  return (
    <svg width={size} height={Math.round(size * 0.62)} viewBox="0 0 80 50" fill="none" aria-hidden="true">
      <Defs id={id} body={["#fdba4d", "#f59e0b", "#d97706"]} />
      <ellipse cx="41" cy="45" rx="32" ry="3" fill="rgba(15,23,41,0.13)" />
      {/* delivery box */}
      <rect x="9" y="12" width="17" height="14" rx="1.6" fill="#e23d3d" />
      <rect x="9" y="12" width="17" height="3.4" rx="1.4" fill="#b91c1c" />
      <path d="M11 17.5 H24" stroke="white" strokeOpacity="0.35" strokeWidth="0.8" />
      {/* rear body + seat */}
      <path d="M10 33 Q9 26 16 26 L36 26 Q38 31 34 35 L16 36 Q11 36 10 33 Z" fill={`url(#${id}b)`} />
      <path d="M14 26.5 Q22 23.5 34 25.5 L34 27.5 L15 28 Z" fill="#1f2937" />
      {/* floorboard + front shield */}
      <path d="M33 35 L50 35 L50 32 L36 32 Z" fill="#1f2937" />
      <path d="M50 35.5 Q49 25 54 16 L58 15 Q59 15.4 58.6 17 Q55 26 56.5 35.5 Z" fill={`url(#${id}b)`} />
      <path d="M55 17.5 Q52.5 24 52.6 33" stroke="white" strokeOpacity="0.55" strokeWidth="1" strokeLinecap="round" />
      {/* handlebar + mirror */}
      <path d="M56.5 15.5 L53.5 13.2" stroke="#1f2937" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M57 15 L59 9.5" stroke="#1f2937" strokeWidth="0.9" />
      <ellipse cx="59.3" cy="8.8" rx="1.4" ry="1" fill="#1f2937" />
      {/* front mudguard + wheels */}
      <path d="M52.5 35.5 Q58 30 63.5 35.5" stroke="#f59e0b" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <ellipse cx="58" cy="38.5" rx="5" ry="5.8" fill="#161b26" />
      <ellipse cx="58.3" cy="38.5" rx="2.6" ry="3.2" fill={`url(#${id}r)`} />
      <ellipse cx="19" cy="38.5" rx="5" ry="5.8" fill="#161b26" />
      <ellipse cx="19.3" cy="38.5" rx="2.6" ry="3.2" fill={`url(#${id}r)`} />
      {/* rider: legs, torso, arm, head, helmet */}
      <path d="M29 26 L40 27 L44 33.5" stroke="#1f2937" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M43.5 34 L47.5 34" stroke="#111827" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M26 26 Q25 17 30 12 L36 12.5 Q38.5 18 34 26.5 Z" fill="#e23d3d" />
      <path d="M33 15 L42 17 L52.5 13.6" stroke="#e23d3d" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="53" cy="13.4" r="1.3" fill="#f1c7a3" />
      <circle cx="33.6" cy="8" r="3.4" fill="#f1c7a3" />
      <path d="M29.6 7.6 Q29.4 2.2 34.4 2 Q38.6 2.2 38.4 6.8 L35 7 L34.4 9 Q31 9 29.6 7.6 Z" fill="#e23d3d" />
      <path d="M31 4.4 Q32.4 2.8 34.6 2.8" stroke="white" strokeOpacity="0.7" strokeWidth="0.8" strokeLinecap="round" fill="none" />
    </svg>
  );
}
