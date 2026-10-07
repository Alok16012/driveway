"use client";

import { useState } from "react";
import { ArrowRight, BackIcon, BellIcon, PinIcon, CheckIcon } from "./icons";
import { PrimaryButton, card, field, iconBtn, label } from "./ui";

/** Brand splash — deep navy so the DriveWay gradient logo reads the way it was drawn. */
export function SplashScreen({ tagline, cta = "Get Started", onStart, footer }: {
  tagline: string; cta?: string; onStart: () => void; footer?: React.ReactNode;
}) {
  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 200,
      background: "var(--hero)",
      display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", right: -80, top: -90, width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(31,214,201,0.30), transparent 70%)" }} />
      <div style={{ position: "absolute", left: -70, bottom: 120, width: 260, height: 260, borderRadius: "50%", background: "radial-gradient(circle, rgba(126,226,31,0.16), transparent 70%)" }} />
      {/* A road winding off into the distance */}
      <svg viewBox="0 0 400 200" preserveAspectRatio="none" style={{ position: "absolute", left: 0, right: 0, bottom: 0, width: "100%", height: 220 }} aria-hidden="true">
        <path d="M120 200 C 160 140, 250 120, 400 70 L 400 110 C 290 140, 230 160, 230 200z" fill="rgba(255,255,255,0.07)" />
        <path d="M175 200 C 210 150, 290 125, 400 90" stroke="rgba(255,255,255,0.35)" strokeWidth="2.5" strokeDasharray="10 12" fill="none" />
      </svg>

      <div className="fade-up" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative", zIndex: 1 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/driveway-logo.png" alt="DriveWay" style={{ width: 240, maxWidth: "66%", height: "auto", display: "block" }} />
        <p style={{ margin: "20px 0 0", fontSize: 15, color: "rgba(255,255,255,0.75)", letterSpacing: "0.04em" }}>{tagline}</p>
      </div>

      <div style={{ padding: "0 20px calc(22px + env(safe-area-inset-bottom))", position: "relative", zIndex: 1 }}>
        <PrimaryButton tone="gold" onClick={onStart}>{cta} <ArrowRight s={18} c="var(--blue-dark)" /></PrimaryButton>
        {footer}
      </div>
    </div>
  );
}

/** Secondary link under the splash button, e.g. "New to DriveWay? Create an account". */
export function SplashLink({ prompt, cta, onClick }: { prompt: string; cta: string; onClick: () => void }) {
  return (
    <p style={{ margin: "14px 0 0", textAlign: "center", fontSize: 13.5, color: "rgba(255,255,255,0.75)" }}>
      {prompt}{" "}
      <button onClick={onClick} style={{ background: "none", border: "none", padding: 0, color: "white", fontWeight: 700, fontSize: 13.5, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3 }}>{cta}</button>
    </p>
  );
}

const Shell = ({ children, onBack }: { children: React.ReactNode; onBack?: () => void }) => (
  <div className="fade-up" style={{ position: "absolute", inset: 0, zIndex: 190, background: "var(--app-bg)", display: "flex", flexDirection: "column", overflowY: "auto" }}>
    <div style={{ padding: "18px 16px 0", minHeight: 42 }}>
      {onBack && <button onClick={onBack} aria-label="Back" className="press" style={iconBtn}><BackIcon c="var(--ink)" /></button>}
    </div>
    {children}
  </div>
);

const H = ({ title, accent, body }: { title: string; accent?: string; body: string }) => (
  <div style={{ padding: "8px 24px 0" }}>
    <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: "var(--ink)", lineHeight: 1.2 }}>
      {title}{accent && <><br /><span style={{ color: "var(--blue)" }}>{accent}</span></>}
    </h1>
    <p style={{ margin: "10px 0 0", fontSize: 14.5, color: "var(--ink-soft)", lineHeight: 1.55 }}>{body}</p>
  </div>
);

type SwitchTo = { prompt: string; cta: string; onClick: () => void };

const Switch = ({ to }: { to?: SwitchTo }) => to ? (
  <p style={{ margin: 0, textAlign: "center", fontSize: 13.5, color: "var(--ink-soft)" }}>
    {to.prompt}{" "}
    <button type="button" onClick={to.onClick} style={{ background: "none", border: "none", padding: 0, color: "var(--blue)", fontWeight: 700, fontSize: 13.5, cursor: "pointer" }}>{to.cta}</button>
  </p>
) : null;

const Terms = () => (
  <p style={{ marginTop: "auto", fontSize: 11.5, color: "var(--ink-mute)", textAlign: "center", lineHeight: 1.5 }}>
    By continuing you agree to DriveWay&apos;s Terms of Service and Privacy Policy.
  </p>
);

const Err = ({ msg }: { msg: string }) => msg ? <p role="alert" style={{ margin: 0, fontSize: 12.5, color: "var(--red)" }}>{msg}</p> : null;

/** Password field with a show/hide toggle. */
function PasswordInput({ id, value, onChange, autoComplete }: { id: string; value: string; onChange: (v: string) => void; autoComplete: string }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ ...field, display: "flex", alignItems: "center", gap: 8, padding: "4px 6px 4px 14px" }}>
      <input id={id} type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete}
        placeholder="••••••••" style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", fontSize: 15, padding: "10px 0", color: "var(--ink)" }} />
      <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Hide password" : "Show password"}
        style={{ background: "none", border: "none", color: "var(--blue)", fontWeight: 600, fontSize: 12.5, cursor: "pointer", padding: "6px 8px" }}>{show ? "Hide" : "Show"}</button>
    </div>
  );
}

/** 10-digit Indian mobile number with a fixed +91 prefix. */
export function MobileInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ ...field, display: "flex", alignItems: "center", gap: 10, padding: "4px 14px" }}>
      <span style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)", borderRight: "1.5px solid var(--line)", paddingRight: 10 }}>🇮🇳 +91</span>
      <input id="phone" value={value} inputMode="numeric" autoComplete="tel-national" placeholder="98765 43210"
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 10))}
        style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", fontSize: 16, padding: "10px 0", color: "var(--ink)", letterSpacing: "0.04em" }} />
    </div>
  );
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MIN_PASSWORD = 8;

/** Runs an async submit that resolves to an error message (or null), tracking busy/error state. */
function useSubmit() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const run = async (fn: () => Promise<string | null>) => {
    setBusy(true); setErr("");
    const e = await fn();
    if (e) setErr(e);
    setBusy(false);
  };
  return { busy, err, setErr, run };
}

/** Email + password log-in. `onSubmit` returns an error message or null. */
export function EmailLogin({ title, accent, body = "Log in with the email and password you signed up with.", switchTo, onSubmit }: {
  title: string; accent: string; body?: string; switchTo?: SwitchTo;
  onSubmit: (email: string, password: string) => Promise<string | null>;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { busy, err, setErr, run } = useSubmit();
  const ok = EMAIL.test(email.trim()) && password.length > 0;
  return (
    <Shell>
      <H title={title} accent={accent} body={body} />
      <form onSubmit={(e) => { e.preventDefault(); if (ok && !busy) run(() => onSubmit(email, password)); }} onChange={() => setErr("")}
        style={{ padding: "28px 24px 24px", display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
        <div><label style={label} htmlFor="le">Email</label><input id="le" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" style={field} autoComplete="email" /></div>
        <div><label style={label} htmlFor="lp">Password</label><PasswordInput id="lp" value={password} onChange={setPassword} autoComplete="current-password" /></div>
        <Err msg={err} />
        <PrimaryButton type="submit" disabled={!ok || busy}>{busy ? "Logging in…" : "Log in"}</PrimaryButton>
        <Switch to={switchTo} />
        <Terms />
      </form>
    </Shell>
  );
}

export interface SignUpDetails { name: string; email: string; phone: string; password: string }

/** Create an account: name, email, mobile and password. `onSubmit` returns an error message or null. */
export function SignUpForm({ title, accent, body, cta = "Create account", switchTo, onSubmit }: {
  title: string; accent: string; body: string; cta?: string; switchTo?: SwitchTo;
  onSubmit: (d: SignUpDetails) => Promise<string | null>;
}) {
  const [d, setD] = useState<SignUpDetails>({ name: "", email: "", phone: "", password: "" });
  const set = (p: Partial<SignUpDetails>) => setD((x) => ({ ...x, ...p }));
  const { busy, err, setErr, run } = useSubmit();
  const problem = !d.name.trim() ? "name" : !EMAIL.test(d.email.trim()) ? "email" : d.phone.length !== 10 ? "phone" : d.password.length < MIN_PASSWORD ? "password" : null;
  return (
    <Shell>
      <H title={title} accent={accent} body={body} />
      <form onSubmit={(e) => { e.preventDefault(); if (!problem && !busy) run(() => onSubmit(d)); }} onChange={() => setErr("")}
        style={{ padding: "24px 24px", display: "flex", flexDirection: "column", gap: 14, flex: 1 }}>
        <div><label style={label} htmlFor="sn">Full Name</label><input id="sn" value={d.name} onChange={(e) => set({ name: e.target.value })} placeholder="Amit Sharma" style={field} autoComplete="name" /></div>
        <div><label style={label} htmlFor="se">Email</label><input id="se" type="email" value={d.email} onChange={(e) => set({ email: e.target.value })} placeholder="you@example.com" style={field} autoComplete="email" /></div>
        <div><label style={label} htmlFor="phone">Mobile Number</label><MobileInput value={d.phone} onChange={(phone) => set({ phone })} /></div>
        <div>
          <label style={label} htmlFor="sp">Password</label>
          <PasswordInput id="sp" value={d.password} onChange={(password) => set({ password })} autoComplete="new-password" />
          <p style={{ margin: "6px 2px 0", fontSize: 11.5, color: d.password && d.password.length < MIN_PASSWORD ? "var(--red)" : "var(--ink-mute)" }}>At least {MIN_PASSWORD} characters</p>
        </div>
        <Err msg={err} />
        <PrimaryButton type="submit" disabled={!!problem || busy}>{busy ? "Creating account…" : cta}</PrimaryButton>
        <Switch to={switchTo} />
        <Terms />
      </form>
    </Shell>
  );
}

/** For someone already signed in who has no customer profile yet (e.g. they signed up as a rider first). */
export function ProfileSetup({ initial, onDone }: {
  initial: { name: string; phone: string }; onDone: (p: { name: string; phone: string }) => Promise<string | null>;
}) {
  const [name, setName] = useState(initial.name);
  const [phone, setPhone] = useState(initial.phone.replace(/\D/g, "").slice(-10));
  const { busy, err, setErr, run } = useSubmit();
  const ok = !!name.trim() && phone.length === 10;
  return (
    <Shell>
      <H title="Almost there!" accent="Tell us about you" body="This helps drivers greet you and reach you during a ride." />
      <form onSubmit={(e) => { e.preventDefault(); if (ok && !busy) run(() => onDone({ name: name.trim(), phone })); }} onChange={() => setErr("")}
        style={{ padding: "24px 24px", display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
        <div><label style={label} htmlFor="n">Full Name</label><input id="n" value={name} onChange={(e) => setName(e.target.value)} placeholder="Amit Sharma" style={field} autoComplete="name" /></div>
        <div><label style={label} htmlFor="phone">Mobile Number</label><MobileInput value={phone} onChange={setPhone} /></div>
        <Err msg={err} />
        <div style={{ marginTop: "auto" }}><PrimaryButton type="submit" disabled={!ok || busy}>{busy ? "Saving…" : "Continue"}</PrimaryButton></div>
      </form>
    </Shell>
  );
}

/** Location + notification permission ask, one screen. */
export function PermissionStep({ onDone }: { onDone: () => void }) {
  const [loc, setLoc] = useState(false);
  const [bell, setBell] = useState(false);
  const rows = [
    { on: loc, set: setLoc, Icon: PinIcon, t: "Location", b: "To find drivers near you and set your pickup point." },
    { on: bell, set: setBell, Icon: BellIcon, t: "Notifications", b: "Driver arriving, trip updates and receipts." },
  ];
  return (
    <Shell>
      <H title="Allow access" accent="for a smooth ride" body="You can change these any time from your phone settings." />
      <div style={{ padding: "24px 24px", display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
        {rows.map(({ on, set, Icon, t, b }) => (
          <div key={t} style={{ ...card, padding: 16, display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 46, height: 46, borderRadius: 14, background: "var(--blue-tint)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon s={22} c="var(--blue)" /></div>
            <div style={{ flex: 1 }}><p style={{ margin: 0, fontSize: 14.5, fontWeight: 600 }}>{t}</p><p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.45 }}>{b}</p></div>
            <button onClick={() => set(true)} disabled={on} className="press" style={{
              border: "none", borderRadius: 10, padding: "8px 12px", fontSize: 12.5, fontWeight: 700, cursor: on ? "default" : "pointer",
              background: on ? "var(--success)" : "var(--blue)", color: on ? "var(--success-text)" : "white", display: "flex", alignItems: "center", gap: 4,
            }}>{on ? <><CheckIcon s={13} c="var(--success-text)" /> Allowed</> : "Allow"}</button>
          </div>
        ))}
        <div style={{ marginTop: "auto" }}><PrimaryButton onClick={onDone}>{loc && bell ? "Let's ride" : "Continue"} <ArrowRight s={18} c="white" /></PrimaryButton></div>
      </div>
    </Shell>
  );
}
