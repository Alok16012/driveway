/* DriveWay brand pieces, cut from the official logo (public/driveway-*.png). */

/** The "D + road" pin symbol on its own. */
export function BrandMark({ size = 36 }: { size?: number; light?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/driveway-mark.png" alt="DriveWay" width={size} height={Math.round(size * 1.094)} style={{ display: "block", objectFit: "contain" }} />
  );
}

/** "DriveWay" with "Way" in the logo's green → cyan → blue gradient. `light` for dark backgrounds. */
export function Wordmark({ sub = "RIDE · REACH · RELAX", light, size = 20 }: { sub?: string; light?: boolean; size?: number }) {
  return (
    <div style={{ lineHeight: 1.05 }}>
      <p style={{ margin: 0, fontSize: size, fontWeight: 800, letterSpacing: "-0.01em", color: light ? "white" : "var(--ink)" }}>
        Drive<span style={{
          background: "linear-gradient(90deg,#7ee21f 0%,#1fd6c9 55%,#1b8cff 100%)",
          WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
        }}>Way</span>
      </p>
      {sub && <p style={{ margin: "2px 0 0", fontSize: 8.5, fontWeight: 600, letterSpacing: "0.14em", color: light ? "rgba(255,255,255,0.6)" : "var(--ink-soft)" }}>{sub}</p>}
    </div>
  );
}
