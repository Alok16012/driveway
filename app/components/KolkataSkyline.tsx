/* Kolkata landmarks for the customer launch screen: Howrah Bridge, Victoria Memorial,
 * Dakshineswar Kali Temple and Kalighat Temple — drawn as white silhouettes that rise in one by one. */

const rise = (i: number): React.CSSProperties => ({ animationDelay: `${0.15 + i * 0.22}s` });

/** Small temple spire (rekha / bulb with finial) standing on y = base. */
const spire = (x: number, base: number, h: number, w: number) => (
  <>
    <path d={`M${x - w} ${base} Q${x - w} ${base - h * 0.55} ${x} ${base - h} Q${x + w} ${base - h * 0.55} ${x + w} ${base} Z`} />
    <rect x={x - 0.6} y={base - h - 5} width={1.2} height={5} />
    <circle cx={x} cy={base - h - 5.5} r={1.3} />
  </>
);

export const LANDMARKS = ["Howrah Bridge", "Victoria Memorial", "Dakshineswar", "Kalighat"];

export default function KolkataSkyline({ style }: { style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 400 150" style={{ width: "100%", height: "auto", display: "block", ...style }} aria-hidden="true">
      {/* Hooghly river */}
      <rect x="0" y="138" width="400" height="12" fill="rgba(255,255,255,0.18)" />
      <path d="M8 143 h40 M70 146 h50 M150 143 h60 M240 146 h45 M310 143 h70" stroke="rgba(255,255,255,0.35)" strokeWidth="1.2" strokeLinecap="round" />

      {/* Howrah Bridge — cantilever truss with two tall towers */}
      <g className="fade-up" style={rise(0)} stroke="white" strokeWidth="2" strokeLinejoin="round" fill="none">
        <path d="M0 96 L28 38 L66 82 L104 38 L132 96" />
        <path d="M0 112 H132" strokeWidth="3" />
        <path d="M28 38 V138 M104 38 V138" strokeWidth="3.4" />
        <path d="M24 38 V138 M108 38 V138" strokeWidth="1.4" />
        <path d="M0 96 L14 112 L14 67 L28 112 M28 112 L47 60 L47 112 L66 82 M66 82 L85 112 L85 60 L104 112 M104 112 L118 67 L118 112 L132 96" strokeWidth="1.2" />
      </g>

      {/* Victoria Memorial — central dome with the Angel of Victory, corner cupolas */}
      <g className="fade-up" style={rise(1)} fill="white">
        <rect x="142" y="108" width="116" height="30" rx="1" />
        <rect x="164" y="90" width="72" height="18" />
        <rect x="186" y="74" width="28" height="16" />
        <path d="M182 75 Q182 46 200 44 Q218 46 218 75 Z" />
        <rect x="197.5" y="36" width="5" height="8" />
        <path d="M200 26 l3 5 l4 -2 l-4 4 v3 h-6 v-3 l-4 -4 l4 2 Z" />
        {[150, 250].map((x) => (
          <g key={x}>
            <rect x={x - 7} y="96" width="14" height="12" />
            <path d={`M${x - 8} 97 Q${x - 8} 84 ${x} 83 Q${x + 8} 84 ${x + 8} 97 Z`} />
            <rect x={x - 0.7} y="77" width="1.4" height="6" />
          </g>
        ))}
        <g fill="rgba(194,65,12,0.45)">
          {[148, 160, 172, 184, 208, 220, 232, 244].map((x) => <rect key={x} x={x} y="115" width="5" height="18" rx="2.5" />)}
          <path d="M194 138 V120 Q200 112 206 120 V138 Z" />
        </g>
      </g>

      {/* Dakshineswar Kali Temple — nava-ratna: nine spires on a raised plinth */}
      <g className="fade-up" style={rise(2)} fill="white">
        <rect x="266" y="126" width="76" height="12" />
        <rect x="274" y="104" width="60" height="22" />
        <rect x="285" y="88" width="38" height="16" />
        {spire(280, 104, 13, 5)}
        {spire(328, 104, 13, 5)}
        {spire(293, 88, 14, 5.5)}
        {spire(315, 88, 14, 5.5)}
        {spire(304, 88, 40, 9)}
        <g fill="rgba(194,65,12,0.45)">
          {[282, 296, 310, 324].map((x) => <path key={x} d={`M${x - 3} 126 V114 Q${x} 109 ${x + 3} 114 V126 Z`} />)}
        </g>
      </g>

      {/* Kalighat Temple — Bengal aat-chala curved roofs with a crowning spire */}
      <g className="fade-up" style={rise(3)} fill="white">
        <rect x="352" y="112" width="42" height="26" />
        <path d="M346 114 Q373 90 400 114 Q373 104 346 114 Z" />
        <rect x="360" y="98" width="26" height="10" />
        <path d="M356 100 Q373 82 390 100 Q373 93 356 100 Z" />
        {spire(373, 88, 22, 5)}
        <path d="M373 55 l9 3 l-9 3 Z" />
        <path d="M368 138 V124 Q373 117 378 124 V138 Z" fill="rgba(194,65,12,0.45)" />
      </g>
    </svg>
  );
}
