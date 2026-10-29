/* DriveWay brand pieces, cut from the official logo (public/driveway-*.png), recoloured to the orange theme.
 * The original green → blue artwork is kept in assets/brand-original/. */

/** The "D + road" pin symbol on its own. `badge` sets it on a white tile so it reads on the orange canvas. */
export function BrandMark({ size = 36, badge }: { size?: number; badge?: boolean }) {
  // eslint-disable-next-line @next/next/no-img-element
  const img = <img src="/driveway-mark.png" alt="DriveWay" width={size} height={Math.round(size * 1.094)} style={{ display: "block", objectFit: "contain" }} />;
  if (!badge) return img;
  const pad = Math.round(size * 0.18);
  return (
    <span style={{ display: "inline-flex", padding: pad, borderRadius: Math.round(size * 0.32), background: "white", boxShadow: "0 3px 10px rgba(124,45,18,0.25)", flexShrink: 0 }}>{img}</span>
  );
}

/** "DriveWay" with "Way" in the logo's orange gradient. `light` for the orange canvas (white "Drive", light amber "Way"). */
export function Wordmark({ sub = "RIDE · REACH · RELAX", light, size = 20 }: { sub?: string; light?: boolean; size?: number }) {
  return (
    <div style={{ lineHeight: 1.05 }}>
      <p style={{ margin: 0, fontSize: size, fontWeight: 800, letterSpacing: "-0.01em", color: light ? "white" : "var(--ink)" }}>
        Drive<span style={{
          background: light ? "linear-gradient(90deg,#fef3c7 0%,#fde68a 50%,#fbbf24 100%)" : "linear-gradient(90deg,#fdba2c 0%,#f97316 50%,#ea580c 100%)",
          WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
        }}>Way</span>
      </p>
      {sub && <p style={{ margin: "2px 0 0", fontSize: 8.5, fontWeight: 600, letterSpacing: "0.14em", color: light ? "rgba(255,255,255,0.75)" : "var(--ink-soft)" }}>{sub}</p>}
    </div>
  );
}
