"use client";

import { useState } from "react";
import { ArrowRight, BackIcon, BellIcon, PinIcon, CheckIcon } from "./icons";
import { ErrorText, PrimaryButton, card, field, iconBtn, label } from "./ui";
import { emailSignIn, emailSignUp, isIndianMobile } from "../lib/api";

/** Brand splash — deep navy so the DriveWay gradient logo reads the way it was drawn. */
export function SplashScreen({ tagline, cta = "Get Started", onStart, footer }: {
  tagline: string; cta?: string; onStart: () => void; footer?: React.ReactNode;
}) {
  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 200,
      background: "linear-gradient(165deg,#04246b 0%,#020b24 100%)",
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

const isEmail = (e: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e.trim());
const MIN_PASSWORD = 6;

const SwitchLink = ({ q, cta, onClick }: { q: string; cta: string; onClick: () => void }) => (
  <p style={{ margin: 0, textAlign: "center", fontSize: 13.5, color: "var(--ink-soft)" }}>
    {q} <button type="button" onClick={onClick} style={{ background: "none", border: "none", padding: 0, color: "var(--blue)", fontWeight: 600, fontSize: 13.5, cursor: "pointer" }}>{cta}</button>
  </p>
);

const Terms = () => (
  <p style={{ marginTop: "auto", fontSize: 11.5, color: "var(--ink-mute)", textAlign: "center", lineHeight: 1.5 }}>
    By continuing you agree to DriveWay&apos;s Terms of Service and Privacy Policy.
  </p>
);

/** Email + password sign-in (Supabase Auth). */
export function EmailLogin({ title, accent, onSignedIn, onSignUp }: { title: string; accent: string; onSignedIn: () => void; onSignUp: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const ok = isEmail(email) && password.length > 0;
  const submit = async () => {
    if (!ok || busy) return;
    setBusy(true); setErr(null);
    try { await emailSignIn(email, password); onSignedIn(); } catch (e) { setErr((e as Error).message); setBusy(false); }
  };
  return (
    <Shell>
      <H title={title} accent={accent} body="Log in with your email and password." />
      <form onSubmit={(e) => { e.preventDefault(); void submit(); }} style={{ padding: "28px 24px 24px", display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
        <div><label style={label} htmlFor="le">Email</label><input id="le" type="email" value={email} maxLength={254} onChange={(e) => { setEmail(e.target.value); setErr(null); }} placeholder="you@example.com" style={field} autoComplete="email" /></div>
        <div><label style={label} htmlFor="lp">Password</label><input id="lp" type="password" value={password} onChange={(e) => { setPassword(e.target.value); setErr(null); }} placeholder="Your password" style={field} autoComplete="current-password" /></div>
        <ErrorText msg={err} />
        <PrimaryButton type="submit" disabled={!ok || busy}>{busy ? "Logging in…" : "Log in"}</PrimaryButton>
        <SwitchLink q="New to DriveWay?" cta="Create an account" onClick={onSignUp} />
        <Terms />
      </form>
    </Shell>
  );
}

/** Name, email, mobile and password → new account. */
export function SignUp({ onSignedUp, onLogin }: { onSignedUp: (hasSession: boolean) => void; onLogin: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const ok = name.trim().length > 0 && isEmail(email) && isIndianMobile(phone) && password.length >= MIN_PASSWORD;
  const submit = async () => {
    if (!ok || busy) return;
    setBusy(true); setErr(null);
    try { onSignedUp(await emailSignUp({ name, email, phone, password })); } catch (e) { setErr((e as Error).message); setBusy(false); }
  };
  return (
    <Shell onBack={onLogin}>
      <H title="Create your" accent="DriveWay account" body="A few details and you're ready to ride." />
      <form onSubmit={(e) => { e.preventDefault(); void submit(); }} style={{ padding: "24px 24px", display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
        <div><label style={label} htmlFor="sn">Full Name</label><input id="sn" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="Amit Sharma" style={field} autoComplete="name" /></div>
        <div><label style={label} htmlFor="se">Email</label><input id="se" type="email" value={email} maxLength={254} onChange={(e) => { setEmail(e.target.value); setErr(null); }} placeholder="you@example.com" style={field} autoComplete="email" /></div>
        <div>
          <label style={label} htmlFor="sp">Mobile Number</label>
          <div style={{ ...field, display: "flex", alignItems: "center", gap: 10, padding: "4px 14px" }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)", borderRight: "1.5px solid var(--line)", paddingRight: 10 }}>🇮🇳 +91</span>
            <input id="sp" value={phone} inputMode="numeric" autoComplete="tel-national" placeholder="98765 43210"
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
              style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 16, padding: "10px 0", color: "var(--ink)", letterSpacing: "0.04em" }} />
          </div>
          {phone.length === 10 && !isIndianMobile(phone) && <ErrorText msg="Indian mobile numbers start with 6, 7, 8 or 9." />}
        </div>
        <div>
          <label style={label} htmlFor="spw">Password</label>
          <input id="spw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={`At least ${MIN_PASSWORD} characters`} style={field} autoComplete="new-password" />
          {password.length > 0 && password.length < MIN_PASSWORD && <ErrorText msg={`Use at least ${MIN_PASSWORD} characters.`} />}
        </div>
        <ErrorText msg={err} />
        <PrimaryButton type="submit" disabled={!ok || busy}>{busy ? "Creating account…" : "Sign up"}</PrimaryButton>
        <SwitchLink q="Already have an account?" cta="Log in" onClick={onLogin} />
        <Terms />
      </form>
    </Shell>
  );
}

/** Name and email — shown once, after the first sign-in. */
export function ProfileSetup({ onDone }: { onDone: (p: { name: string; email: string }) => Promise<void> }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async () => {
    if (!name.trim() || busy) return;
    setBusy(true); setErr(null);
    try { await onDone({ name: name.trim(), email: email.trim() }); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Shell>
      <H title="Almost there!" accent="Tell us about you" body="This helps drivers greet you and receipts reach your inbox." />
      <form onSubmit={(e) => { e.preventDefault(); void submit(); }}
        style={{ padding: "24px 24px", display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
        <div><label style={label} htmlFor="n">Full Name</label><input id="n" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="Amit Sharma" style={field} autoComplete="name" /></div>
        <div><label style={label} htmlFor="e">Email <span style={{ fontWeight: 400, color: "var(--ink-mute)" }}>(optional)</span></label><input id="e" type="email" value={email} maxLength={254} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" style={field} autoComplete="email" /></div>
        <ErrorText msg={err} />
        <div style={{ marginTop: "auto" }}><PrimaryButton type="submit" disabled={!name.trim() || busy}>{busy ? "Saving…" : "Continue"}</PrimaryButton></div>
      </form>
    </Shell>
  );
}

/** Ask the browser for the real permission; resolves true only if granted. */
async function ask(kind: string): Promise<boolean> {
  try {
    if (kind === "Location") {
      if (!("geolocation" in navigator)) return false;
      return await new Promise((res) => navigator.geolocation.getCurrentPosition(() => res(true), () => res(false), { timeout: 10000 }));
    }
    if (!("Notification" in window)) return false;
    return (await Notification.requestPermission()) === "granted";
  } catch { return false; }
}

/** Location + notification permission ask, one screen. The app works without either. */
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
            <button onClick={() => void ask(t).then(set)} disabled={on} className="press" style={{
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
