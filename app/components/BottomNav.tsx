"use client";

/* Solid glyphs — at 21px a filled shape stays legible where a stroke icon muddies. */
type G = ({ c }: { c: string }) => React.ReactElement;

export const HomeGlyph: G = ({ c }) => (
  <svg width="21" height="21" viewBox="0 0 24 24" fill={c}>
    <path d="M12 3.2 3 10.4V20a1.5 1.5 0 0 0 1.5 1.5H9.5V15h5v6.5h5A1.5 1.5 0 0 0 21 20v-9.6z" />
  </svg>
);

export const RidesGlyph: G = ({ c }) => (
  <svg width="21" height="21" viewBox="0 0 24 24" fill={c}>
    <path d="M5 11.5 7 6.2A2 2 0 0 1 8.9 5h6.2A2 2 0 0 1 17 6.2l2 5.3a2.5 2.5 0 0 1 1.5 2.3V18a1 1 0 0 1-1 1h-1.3a1 1 0 0 1-1-1v-1H6.8v1a1 1 0 0 1-1 1H4.5a1 1 0 0 1-1-1v-4.2A2.5 2.5 0 0 1 5 11.5z" />
    <path d="M7.4 11h9.2l-1.3-3.6a.9.9 0 0 0-.8-.6H9.5a.9.9 0 0 0-.8.6z" fill="white" />
    <circle cx="7.5" cy="14" r="1.2" fill="white" /><circle cx="16.5" cy="14" r="1.2" fill="white" />
  </svg>
);

export const OffersGlyph: G = ({ c }) => (
  <svg width="21" height="21" viewBox="0 0 24 24" fill={c}>
    <path d="M2.8 12.3V4.3a1.5 1.5 0 0 1 1.5-1.5h8l8.6 8.6a1.6 1.6 0 0 1 0 2.2l-7.8 7.8a1.6 1.6 0 0 1-2.2 0z" />
    <circle cx="7.6" cy="7.6" r="1.7" fill="white" />
    <path d="M10.5 15.5l5-5" stroke="white" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);

export const ChatGlyph: G = ({ c }) => (
  <svg width="21" height="21" viewBox="0 0 24 24" fill={c}>
    <path d="M12 3.5c5 0 9 3.4 9 7.8s-4 7.8-9 7.8c-1 0-2-.1-2.9-.4L4.5 20.5l1.2-3.9C4 15.2 3 13.3 3 11.3 3 6.9 7 3.5 12 3.5z" />
    <circle cx="8.3" cy="11.3" r="1.2" fill="white" /><circle cx="12" cy="11.3" r="1.2" fill="white" /><circle cx="15.7" cy="11.3" r="1.2" fill="white" />
  </svg>
);

export const ProfileGlyph: G = ({ c }) => (
  <svg width="21" height="21" viewBox="0 0 24 24" fill={c}>
    <circle cx="12" cy="7.8" r="4.3" />
    <path d="M3.8 20.2a8.2 8.2 0 0 1 16.4 0 1 1 0 0 1-1 1H4.8a1 1 0 0 1-1-1z" />
  </svg>
);

export const WalletGlyph: G = ({ c }) => (
  <svg width="21" height="21" viewBox="0 0 24 24" fill={c}>
    <path d="M4.5 4h12A1.5 1.5 0 0 1 18 5.5V7h1a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a3 3 0 0 1-3-3V6.5A2.5 2.5 0 0 1 4.5 4z" />
    <path d="M21 11h-4.5a2 2 0 0 0 0 4H21z" fill="white" />
    <path d="M4.5 7H18" stroke="white" strokeWidth="1.5" />
  </svg>
);

export const BellGlyph: G = ({ c }) => (
  <svg width="21" height="21" viewBox="0 0 24 24" fill={c}>
    <path d="M12 2.5a6.5 6.5 0 0 0-6.5 6.5c0 6.5-3 8.3-3 8.3h19s-3-1.8-3-8.3A6.5 6.5 0 0 0 12 2.5z" />
    <path d="M9.5 19.5a2.5 2.5 0 0 0 5 0z" />
  </svg>
);

export interface NavItem<T extends string> { id: T; label: string; Icon: G; badge?: number }

export default function BottomNav<T extends string>({ items, active, onChange }: { items: NavItem<T>[]; active: T; onChange: (t: T) => void }) {
  return (
    // Floats over the content with no backdrop of its own — only the pill is solid.
    <div style={{
      position: "absolute", left: 0, right: 0, bottom: 0,
      padding: "0 14px calc(10px + env(safe-area-inset-bottom))",
      pointerEvents: "none", zIndex: 50,
    }}>
      <nav style={{
        display: "flex", alignItems: "stretch",
        background: "rgba(255,255,255,0.94)",
        backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
        borderRadius: 999, padding: 4,
        boxShadow: "0 8px 24px rgba(15,23,41,0.14)",
        pointerEvents: "auto",
      }}>
        {items.map((tab) => {
          const on = active === tab.id;
          const color = on ? "var(--blue)" : "var(--ink)";
          return (
            <button key={tab.id} aria-label={tab.label} aria-current={on ? "page" : undefined}
              onClick={() => onChange(tab.id)}
              style={{
                flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
                background: on ? "var(--blue-tint)" : "transparent",
                border: "none", borderRadius: 999, cursor: "pointer", padding: "6px 0 5px",
                transition: "background 0.2s", position: "relative",
              }}>
              <tab.Icon c={color} />
              <span style={{ fontSize: 10.5, fontWeight: on ? 600 : 500, color }}>{tab.label}</span>
              {!!tab.badge && !on && (
                <span style={{
                  position: "absolute", top: 4, left: "calc(50% + 6px)", minWidth: 16, height: 16, padding: "0 4px",
                  borderRadius: 10, background: "var(--red)", border: "1.5px solid white",
                  color: "white", fontSize: 9.5, fontWeight: 700,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>{tab.badge}</span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
