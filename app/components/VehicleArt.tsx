import type { VehicleKind } from "../lib/data";

/* Flat two-tone vehicle illustrations, side view — same style as the quick-action tiles. */

export default function VehicleArt({ kind, size = 56 }: { kind: VehicleKind; size?: number }) {
  const h = Math.round(size * 0.62);
  const wheel = (x: number, r = 6.5) => (
    <g key={x}><circle cx={x} cy="38" r={r} fill="#0f1729" /><circle cx={x} cy="38" r={r * 0.42} fill="#dfe4ef" /></g>
  );
  return (
    <svg width={size} height={h} viewBox="0 0 80 50" fill="none" aria-hidden="true">
      <ellipse cx="40" cy="45.5" rx="32" ry="3" fill="rgba(15,23,41,0.08)" />
      {kind === "bike" && (
        <>
          <path d="M20 38 L34 24 H48 L58 38" stroke="#0847c7" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M30 24 h20 l-4 -7 h-12z" fill="var(--blue)" />
          <path d="M50 17 l6 -5 h6" stroke="#0f1729" strokeWidth="3" strokeLinecap="round" />
          <circle cx="36" cy="10" r="5" fill="#f5a623" />
          {wheel(20, 8)}{wheel(60, 8)}
        </>
      )}
      {kind === "auto" && (
        <>
          <path d="M14 36 V20 C14 12, 22 7, 32 7 H52 C60 7, 64 14, 64 22 V36z" fill="#2f9e76" />
          <path d="M14 22 H64 V36 H14z" fill="#f5a623" />
          <path d="M22 11 H46 V22 H18 C18 16, 19 12, 22 11z" fill="#dce9fd" />
          <path d="M50 11 H56 C60 12, 61 17, 61 22 H50z" fill="#dce9fd" />
          <rect x="12" y="34" width="56" height="4" rx="2" fill="#0f1729" />
          {wheel(24)}{wheel(58)}
        </>
      )}
      {(kind === "mini" || kind === "sedan") && (
        <>
          <path d={kind === "mini"
            ? "M10 36 V28 C10 24, 14 22, 18 21 L26 12 C28 10, 30 9, 34 9 H50 C54 9, 57 11, 59 14 L64 21 C68 22, 70 25, 70 28 V36z"
            : "M6 36 V28 C6 24, 10 22, 16 21 L26 12 C28 10, 30 9, 34 9 H50 C54 9, 57 11, 59 14 L66 21 C72 22, 75 25, 75 29 V36z"}
            fill={kind === "mini" ? "var(--blue)" : "#0f1729"} />
          <path d="M28 13 C29 12, 31 11.5, 34 11.5 H40 V21 H21z" fill="#dce9fd" />
          <path d="M43 11.5 H50 C53 11.5, 55 13, 56 15 L60 21 H43z" fill="#dce9fd" />
          <rect x={kind === "mini" ? 62 : 68} y="25" width="6" height="3" rx="1.5" fill="#f5a623" />
          {wheel(kind === "mini" ? 22 : 20)}{wheel(kind === "mini" ? 58 : 61)}
        </>
      )}
      {kind === "taxi" && (
        <>
          <path d="M7 36 V28 C7 24, 11 22, 16 21 L26 12 C28 10, 30 9, 34 9 H50 C54 9, 57 11, 59 14 L66 21 C71 22, 74 25, 74 29 V36z" fill="#1f2937" />
          <path d="M7 27 H74 V31 H7z" fill="#f5c518" />
          <path d="M28 13 C29 12, 31 11.5, 34 11.5 H40 V21 H21z" fill="#dce9fd" />
          <path d="M43 11.5 H50 C53 11.5, 55 13, 56 15 L60 21 H43z" fill="#dce9fd" />
          <rect x="33" y="4" width="14" height="5" rx="1.5" fill="#f5c518" />
          {wheel(20)}{wheel(61)}
        </>
      )}
      {kind === "suv" && (
        <>
          <path d="M5 36 V22 C5 18, 8 16, 12 15 L20 7 H58 C62 7, 65 9, 67 12 L72 18 C75 19, 76 22, 76 26 V36z" fill="#475569" />
          <path d="M22 10 H38 V18 H15z" fill="#dce9fd" />
          <path d="M41 10 H57 C60 10, 62 12, 64 14 L67 18 H41z" fill="#dce9fd" />
          <rect x="20" y="4" width="36" height="3" rx="1.5" fill="#0f1729" />
          <rect x="70" y="22" width="6" height="3" rx="1.5" fill="#f5a623" />
          {wheel(20, 7.5)}{wheel(61, 7.5)}
        </>
      )}
    </svg>
  );
}

/** "Book Any" — two cars, one behind the other. */
export function AnyArt({ size = 56 }: { size?: number }) {
  return (
    <span style={{ position: "relative", display: "inline-block", width: size, height: Math.round(size * 0.62) }}>
      <span style={{ position: "absolute", left: size * 0.22, top: -size * 0.06, opacity: 0.85 }}><VehicleArt kind="sedan" size={size * 0.8} /></span>
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

/** Parcel — stacked boxes. */
export function ParcelArt({ size = 56 }: { size?: number }) {
  return (
    <svg width={size} height={Math.round(size * 0.62)} viewBox="0 0 80 50" fill="none" aria-hidden="true">
      <ellipse cx="40" cy="45.5" rx="30" ry="3" fill="rgba(15,23,41,0.08)" />
      <rect x="14" y="20" width="30" height="24" rx="2" fill="#d9a066" />
      <rect x="14" y="20" width="30" height="6" fill="#c48a4f" />
      <rect x="26" y="20" width="6" height="24" fill="#f5e6d0" opacity="0.8" />
      <rect x="40" y="10" width="26" height="34" rx="2" fill="var(--blue)" />
      <rect x="40" y="10" width="26" height="7" fill="var(--blue-dark)" />
      <rect x="50" y="10" width="6" height="34" fill="#dce9fd" opacity="0.7" />
      <rect x="44" y="30" width="10" height="6" rx="1" fill="white" />
    </svg>
  );
}
