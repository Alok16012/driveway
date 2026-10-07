"use client";

import { BackIcon } from "./icons";
import type { RideStatus } from "../lib/data";

/** Detail-page header: back arrow + title on the canvas, optional actions right. */
export function PageHeader({ title, onBack, right, sub }: { title: string; onBack?: () => void; right?: React.ReactNode; sub?: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 14, padding: "18px 16px 12px",
      position: "sticky", top: 0, zIndex: 20, background: "var(--app-bg)",
    }}>
      {onBack && (
        <button onClick={onBack} aria-label="Back" className="press" style={iconBtn}>
          <BackIcon c="var(--ink)" />
        </button>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: "var(--ink)" }}>{title}</h2>
        {sub && <p style={{ margin: 0, fontSize: 12, color: "var(--ink-soft)" }}>{sub}</p>}
      </div>
      {right && <div style={{ display: "flex", alignItems: "center", gap: 18 }}>{right}</div>}
    </div>
  );
}

export const iconBtn: React.CSSProperties = {
  background: "none", border: "none", padding: 0, cursor: "pointer",
  display: "flex", alignItems: "center", position: "relative",
};

/** Segmented pill tabs — white track, blue active pill. */
export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string }[]; value: T; onChange: (id: T) => void }) {
  return (
    <div style={{
      display: "flex", background: "var(--surface)", borderRadius: 999, padding: 4,
      boxShadow: "var(--shadow-card)",
    }}>
      {tabs.map((t) => {
        const on = t.id === value;
        return (
          <button key={t.id} onClick={() => onChange(t.id)} aria-pressed={on} style={{
            flex: 1, border: "none", cursor: "pointer", borderRadius: 999,
            padding: "9px 6px", fontSize: 13.5, fontWeight: on ? 600 : 500,
            background: on ? "var(--blue)" : "transparent",
            color: on ? "white" : "var(--ink-soft)",
            transition: "background 0.2s, color 0.2s", whiteSpace: "nowrap",
          }}>{t.label}</button>
        );
      })}
    </div>
  );
}

type Tone = { bg: string; fg: string; bd: string };
const GREEN: Tone = { bg: "var(--success)", fg: "var(--success-text)", bd: "var(--success-border)" };
const AMBER: Tone = { bg: "var(--warning)", fg: "var(--warning-text)", bd: "var(--warning-border)" };
const BLUE: Tone = { bg: "var(--info-bg)", fg: "var(--info-text)", bd: "var(--info-border)" };
const RED: Tone = { bg: "var(--error)", fg: "var(--error-text)", bd: "#fecaca" };
const PURPLE: Tone = { bg: "var(--purple-tint)", fg: "var(--purple)", bd: "#e9e3ff" };
const GREY: Tone = { bg: "var(--surface-dim)", fg: "var(--text-muted)", bd: "var(--border)" };

const TONES: Record<string, Tone> = {
  Completed: GREEN, Approved: GREEN, Online: GREEN, Active: GREEN, Resolved: GREEN, Paid: GREEN,
  Started: BLUE, Arriving: BLUE, Assigned: BLUE, Arrived: BLUE, "In Progress": BLUE, Ongoing: BLUE,
  Searching: PURPLE, Scheduled: PURPLE, Open: PURPLE,
  Pending: AMBER, Unpaid: AMBER, Expired: AMBER,
  Cancelled: RED, Rejected: RED, Blocked: RED, Suspended: RED,
  Offline: GREY, Inactive: GREY,
};

export function StatusBadge({ status }: { status: RideStatus | string }) {
  const t = TONES[status] ?? GREY;
  return (
    <span style={{
      background: t.bg, color: t.fg, border: `1px solid ${t.bd}`,
      fontSize: 10.5, fontWeight: 600, padding: "3px 9px", borderRadius: 999, whiteSpace: "nowrap",
    }}>{status}</span>
  );
}

export function PrimaryButton({ children, onClick, disabled, tone = "blue", style, type }: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean; tone?: "blue" | "gold" | "red" | "ghost"; style?: React.CSSProperties; type?: "submit" | "button";
}) {
  const bg = { blue: "linear-gradient(135deg,var(--blue),var(--blue-dark))", gold: "white", red: "linear-gradient(135deg,#f25555,var(--red))", ghost: "var(--surface)" }[tone];
  const fg = { blue: "white", gold: "var(--blue-dark)", red: "white", ghost: "var(--ink)" }[tone];
  const sh = { blue: "0 6px 16px rgba(11,92,255,0.30)", gold: "0 6px 16px rgba(6,53,154,0.25)", red: "0 6px 16px rgba(224,49,49,0.28)", ghost: "var(--shadow-card)" }[tone];
  return (
    <button type={type ?? "button"} onClick={onClick} disabled={disabled} className="press" style={{
      width: "100%", border: "none", borderRadius: 16, padding: "15px 18px",
      fontSize: 15, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer",
      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
      background: disabled ? "var(--line-strong)" : bg,
      color: disabled ? "var(--ink-mute)" : fg,
      boxShadow: disabled ? "none" : sh,
      ...style,
    }}>{children}</button>
  );
}

export const card: React.CSSProperties = {
  background: "var(--surface)", borderRadius: 18, boxShadow: "var(--shadow-card)",
};

export const label: React.CSSProperties = {
  display: "block", margin: "0 0 8px", fontSize: 13.5, fontWeight: 600, color: "var(--ink)",
};

export const field: React.CSSProperties = {
  width: "100%", background: "var(--surface)", border: "1.5px solid var(--line)",
  borderRadius: 14, padding: "13px 14px", fontSize: 14, color: "var(--ink)", outline: "none",
};

/** Sticky footer bar for detail pages with a main action. */
export function Footer({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      position: "sticky", bottom: 0, zIndex: 20,
      padding: "12px 16px calc(14px + env(safe-area-inset-bottom))",
      background: "linear-gradient(to top, var(--app-bg) 75%, rgba(238,241,251,0))",
    }}>{children}</div>
  );
}

/** Initials avatar in the brand gradient. */
export function Avatar({ initials, size = 46, tone = "blue" }: { initials: string; size?: number; tone?: "blue" | "gold" | "green" }) {
  const bg = { blue: "linear-gradient(135deg,var(--blue),var(--blue-dark))", gold: "linear-gradient(135deg,var(--gold),var(--gold-dark))", green: "linear-gradient(135deg,#34c38f,var(--green))" }[tone];
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0, background: bg, color: "white",
      display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.34, fontWeight: 700,
    }}>{initials}</div>
  );
}

/** Tap-to-rate stars. */
export function Stars({ value, onChange, size = 30 }: { value: number; onChange?: (n: number) => void; size?: number }) {
  return (
    <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} aria-label={`${n} star${n > 1 ? "s" : ""}`} onClick={() => onChange?.(n)} className="press"
          style={{ background: "none", border: "none", padding: 0, cursor: onChange ? "pointer" : "default", display: "flex" }}>
          <svg width={size} height={size} viewBox="0 0 24 24" fill={n <= value ? "var(--gold)" : "var(--line-strong)"} aria-hidden="true">
            <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5-4.8-4.6 6.6-.9z" />
          </svg>
        </button>
      ))}
    </div>
  );
}

/** iOS-style switch. */
export function Toggle({ on, onChange, label: aria }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button role="switch" aria-checked={on} aria-label={aria} onClick={() => onChange(!on)} style={{
      width: 46, height: 27, borderRadius: 999, border: "none", cursor: "pointer", padding: 3, flexShrink: 0,
      background: on ? "var(--green-500)" : "var(--line-strong)", transition: "background 0.2s", display: "flex",
    }}>
      <span style={{ width: 21, height: 21, borderRadius: "50%", background: "white", boxShadow: "0 1px 3px rgba(0,0,0,0.25)", transform: on ? "translateX(19px)" : "none", transition: "transform 0.2s" }} />
    </button>
  );
}

/** Six-box OTP input. Demo accepts any 4–6 digits. */
export function OtpInput({ value, onChange, length = 4 }: { value: string; onChange: (v: string) => void; length?: number }) {
  return (
    <label style={{ position: "relative", display: "flex", gap: 10, justifyContent: "center", cursor: "text" }}>
      <input value={value} autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={length} aria-label="OTP"
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, length))}
        style={{ position: "absolute", inset: 0, opacity: 0, width: "100%" }} />
      {Array.from({ length }).map((_, i) => (
        <span key={i} style={{
          flex: "0 1 54px", minWidth: 0, height: 58, borderRadius: 14, background: "var(--surface)", display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 22, fontWeight: 700, color: "var(--ink)",
          border: `1.5px solid ${i === value.length ? "var(--blue)" : "var(--line)"}`, boxShadow: "var(--shadow-card)",
        }}>{value[i] ?? ""}</span>
      ))}
    </label>
  );
}

/** Tiny "Demo:" helper link used to fast-forward simulated backend steps. */
export function DemoButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ background: "none", border: "1px dashed var(--line-strong)", borderRadius: 10, padding: "6px 12px", fontSize: 11.5, color: "var(--ink-mute)", cursor: "pointer" }}>
      Demo: {children}
    </button>
  );
}

export function Toast({ msg, bottom = 96 }: { msg: string | null; bottom?: number }) {
  if (!msg) return null;
  return (
    <div className="fade-up" role="status" style={{
      position: "absolute", left: 16, right: 16, bottom, zIndex: 300,
      background: "var(--ink)", color: "white", borderRadius: 14, padding: "12px 16px",
      fontSize: 13.5, fontWeight: 500, boxShadow: "var(--shadow-xl)", textAlign: "center",
    }}>{msg}</div>
  );
}
