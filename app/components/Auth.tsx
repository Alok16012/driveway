"use client";

import { useEffect, useState } from "react";
import { ArrowRight, BackIcon, BellIcon, PinIcon, CheckIcon, LockIcon, LogoutIcon } from "./icons";
import { ErrorText, PasswordInput, PrimaryButton, card, field, iconBtn, label } from "./ui";
import { emailDomainExists, emailSignIn, emailSignUp, isIndianMobile, sendPasswordReset, signOut, updatePassword } from "../lib/api";
import KolkataSkyline, { LANDMARKS } from "./KolkataSkyline";

/** Brand splash — deep navy so the DriveWay gradient logo reads the way it was drawn.
 * `kolkata` swaps in the customer app's orange launch look with the city's landmarks;
 * without `onStart` it is the brief launch screen (no button). */
export function SplashScreen({ tagline, cta = "Get Started", onStart, footer, kolkata }: {
  tagline: string; cta?: string; onStart?: () => void; footer?: React.ReactNode; kolkata?: boolean;
}) {
  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 200,
      background: kolkata ? "linear-gradient(170deg,#fb923c 0%,#ea580c 55%,#c2410c 100%)" : "linear-gradient(165deg,#04246b 0%,#020b24 100%)",
      display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      {kolkata ? (
        <div style={{ position: "absolute", left: "50%", top: -120, width: 420, height: 420, marginLeft: -210, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,237,180,0.45), transparent 68%)" }} />
      ) : (
        <>
          <div style={{ position: "absolute", right: -80, top: -90, width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(31,214,201,0.30), transparent 70%)" }} />
          <div style={{ position: "absolute", left: -70, bottom: 120, width: 260, height: 260, borderRadius: "50%", background: "radial-gradient(circle, rgba(126,226,31,0.16), transparent 70%)" }} />
          {/* A road winding off into the distance */}
          <svg viewBox="0 0 400 200" preserveAspectRatio="none" style={{ position: "absolute", left: 0, right: 0, bottom: 0, width: "100%", height: 220 }} aria-hidden="true">
            <path d="M120 200 C 160 140, 250 120, 400 70 L 400 110 C 290 140, 230 160, 230 200z" fill="rgba(255,255,255,0.07)" />
            <path d="M175 200 C 210 150, 290 125, 400 90" stroke="rgba(255,255,255,0.35)" strokeWidth="2.5" strokeDasharray="10 12" fill="none" />
          </svg>
        </>
      )}

      <div className="fade-up" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative", zIndex: 1 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/driveway-logo.png" alt="DriveWay" style={{ width: 240, maxWidth: "66%", height: "auto", display: "block", filter: kolkata ? "drop-shadow(0 4px 14px rgba(124,45,18,0.35))" : undefined }} />
        <p style={{ margin: "20px 0 0", fontSize: 15, color: kolkata ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.75)", letterSpacing: "0.04em" }}>{tagline}</p>
      </div>

      {kolkata && (
        <div style={{ position: "relative", zIndex: 1, padding: "0 8px" }}>
          <KolkataSkyline />
          <p className="fade-up" style={{ margin: "8px 0 0", textAlign: "center", fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", color: "rgba(255,255,255,0.85)", animationDelay: "1s" }}>
            {LANDMARKS.join(" · ").toUpperCase()}
          </p>
        </div>
      )}

      {onStart ? (
        <div style={{ padding: `${kolkata ? 18 : 0}px 20px calc(22px + env(safe-area-inset-bottom))`, position: "relative", zIndex: 1 }}>
          <PrimaryButton tone={kolkata ? "blue" : "gold"} onClick={onStart}>{cta} <ArrowRight s={18} c={kolkata ? "white" : "var(--blue-dark)"} /></PrimaryButton>
          {footer}
        </div>
      ) : (
        <div style={{ height: "calc(36px + env(safe-area-inset-bottom))" }} />
      )}
    </div>
  );
}

/** Launch image. Signed-out users (`onStart` given) stay on it with the CTA;
 * otherwise it calls `onDone` after `holdMs`. Tap skips the wait. */
export function ImageSplash({ src, cta = "Get Started", onStart, onDone, footer, holdMs = 2500 }: {
  src: string; cta?: string; onStart?: () => void; onDone?: () => void; footer?: React.ReactNode; holdMs?: number;
}) {
  const [ended, setEnded] = useState(false);
  const finish = () => setEnded(true);
  useEffect(() => { const t = setTimeout(finish, holdMs); return () => clearTimeout(t); }, [holdMs]);
  useEffect(() => { if (ended && !onStart) onDone?.(); }, [ended, onStart, onDone]);

  return (
    <div onClick={ended ? undefined : finish} style={{ position: "absolute", inset: 0, zIndex: 300, background: "#ea580c", overflow: "hidden" }}>
      <img src={src} alt="DriveWay — Ride · Reach · Relax"
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      {onStart && (
        <div className="fade-up" style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "18px 20px calc(22px + env(safe-area-inset-bottom))" }}>
          <PrimaryButton tone="blue" onClick={onStart}>{cta} <ArrowRight s={18} c="white" /></PrimaryButton>
          {footer}
        </div>
      )}
    </div>
  );
}

/** A generic city skyline — towers of different heights with lit windows — for the launch screen. */
function CitySkyline() {
  const towers: [number, number, number][] = [   // x, width, height
    [0, 34, 70], [30, 26, 104], [52, 40, 58], [88, 22, 128], [106, 36, 86], [138, 30, 112], [164, 44, 64], [204, 24, 140],
    [224, 38, 92], [258, 28, 118], [282, 42, 74], [320, 26, 100], [342, 34, 132], [372, 28, 80],
  ];
  return (
    <svg viewBox="0 0 400 150" style={{ width: "100%", height: "auto", maxHeight: 140, display: "block" }} aria-hidden="true">
      {towers.map(([x, w, h], i) => (
        <g key={i} className="fade-up" style={{ animationDelay: `${0.1 + (i % 7) * 0.12}s` }}>
          <rect x={x} y={150 - h} width={w} height={h} rx={2} fill="white" />
          {Array.from({ length: Math.floor((h - 14) / 14) }, (_, r) =>
            Array.from({ length: Math.max(1, Math.floor((w - 8) / 9)) }, (_, c) => (
              <rect key={`${r}-${c}`} x={x + 5 + c * 9} y={150 - h + 8 + r * 14} width={4} height={6} rx={1}
                fill={(r * 3 + c * 5 + i) % 4 === 0 ? "#fde68a" : "#ea580c"} opacity={(r * 3 + c * 5 + i) % 4 === 0 ? 1 : 0.35} />
            )))}
        </g>
      ))}
    </svg>
  );
}

type SplashVariant = "customer" | "rider" | "admin";

const SPLASH_COPY: Record<SplashVariant, { headline: string; points: [string, string][] }> = {
  customer: {
    headline: "Rides across your city, in a tap",
    points: [["🛡️", "Verified riders"], ["🔐", "OTP-secured trips"], ["📍", "Live GPS tracking"]],
  },
  rider: {
    headline: "Drive on your time. Earn every day.",
    points: [["💸", "Instant payouts"], ["🎯", "Daily incentives"], ["🧭", "Hotspot guidance"]],
  },
  admin: {
    headline: "Run the whole fleet from one place",
    points: [["🚦", "Live rides"], ["🪪", "Rider KYC"], ["📊", "Pricing & reports"]],
  },
};

const SPLASH_FLEET = [
  { src: "/vehicles/bike.webp", name: "Bike" },
  { src: "/vehicles/auto.webp", name: "Auto" },
  { src: "/vehicles/mini.webp", name: "Cab" },
  { src: "/vehicles/parcel.webp", name: "Parcel" },
];

/** Animated launch screen: logo, tagline, fleet and what the app offers, with a loading bar.
 * Signed-out users (`onStart` given) get the CTA once it has played; everyone else continues
 * via `onDone` after `holdMs`. Tapping skips the wait. */
export function BrandSplash({ variant = "customer", cta = "Get Started", onStart, onDone, footer, holdMs = 2400 }: {
  variant?: SplashVariant; cta?: string; onStart?: () => void; onDone?: () => void; footer?: React.ReactNode; holdMs?: number;
}) {
  const [ended, setEnded] = useState(false);
  const finish = () => setEnded(true);
  useEffect(() => { const t = setTimeout(finish, holdMs); return () => clearTimeout(t); }, [holdMs]);
  useEffect(() => { if (ended && !onStart) onDone?.(); }, [ended, onStart, onDone]);
  const copy = SPLASH_COPY[variant];
  const showCta = ended && !!onStart;

  return (
    <div onClick={ended ? undefined : finish} data-testid="brand-splash" style={{
      position: "absolute", inset: 0, zIndex: 300, overflow: "hidden", display: "flex", flexDirection: "column",
      background: "radial-gradient(120% 70% at 50% 0%, #fdba74 0%, #f97316 38%, #ea580c 68%, #9a3412 100%)",
    }}>
      {/* soft light behind the logo */}
      <div className="splash-glow" style={{ position: "absolute", left: "50%", top: "6%", width: 380, height: 380, marginLeft: -190, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,247,214,0.55), transparent 65%)", pointerEvents: "none" }} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "safe center", padding: "calc(28px + env(safe-area-inset-top)) 24px 0", position: "relative", zIndex: 1, minHeight: 0 }}>
        <div className="splash-pop">
          <div className="splash-float splash-badge" style={{ padding: 18, borderRadius: 34, background: "white", boxShadow: "0 18px 40px rgba(124,45,18,0.35), inset 0 -4px 0 rgba(234,88,12,0.12)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/driveway-mark.png" alt="DriveWay" width={84} height={92} style={{ display: "block", width: "var(--splash-mark, 84px)", height: "auto" }} />
          </div>
        </div>

        <h1 className="fade-up" style={{ margin: "22px 0 0", fontSize: 40, fontWeight: 800, letterSpacing: "-0.02em", color: "white", lineHeight: 1, textShadow: "0 3px 14px rgba(124,45,18,0.35)", animationDelay: "0.35s" }}>
          Drive<span style={{ color: "#fef08a" }}>Way</span>
        </h1>
        <p className="fade-up" style={{ margin: "10px 0 0", fontSize: 12, fontWeight: 700, letterSpacing: "0.32em", color: "rgba(255,255,255,0.9)", animationDelay: "0.5s" }}>
          RIDE · REACH · RELAX
        </p>
        <p className="fade-up" style={{ margin: "18px 0 0", fontSize: 15, fontWeight: 600, color: "white", textAlign: "center", lineHeight: 1.4, animationDelay: "0.7s" }}>
          {copy.headline}
        </p>

        {variant !== "admin" && (
          <div className="fade-up" style={{ display: "flex", gap: 10, marginTop: 20, animationDelay: "0.85s" }}>
            {SPLASH_FLEET.map((v) => (
              <div key={v.name} style={{ width: 66, padding: "8px 4px 6px", borderRadius: 16, background: "rgba(255,255,255,0.16)", border: "1px solid rgba(255,255,255,0.28)", backdropFilter: "blur(6px)", textAlign: "center" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={v.src} alt="" width={50} height={36} style={{ display: "block", margin: "0 auto", objectFit: "contain", height: 36 }} />
                <span style={{ display: "block", marginTop: 4, fontSize: 11, fontWeight: 700, color: "white" }}>{v.name}</span>
              </div>
            ))}
          </div>
        )}

        <div className="fade-up splash-points" style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 8, marginTop: 16, maxWidth: 340, animationDelay: "1s" }}>
          {copy.points.map(([icon, text]) => (
            <span key={text} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 11px", borderRadius: 999, background: "rgba(124,45,18,0.28)", color: "white", fontSize: 11.5, fontWeight: 600 }}>
              <span aria-hidden="true">{icon}</span>{text}
            </span>
          ))}
        </div>
      </div>

      {/* City skyline, then the road with a car driving across */}
      <div aria-hidden="true" className="splash-skyline" style={{ position: "relative", zIndex: 0, padding: "0 6px", marginTop: 12, opacity: 0.55, flexShrink: 0 }}>
        <CitySkyline />
      </div>
      <div aria-hidden="true" style={{ position: "relative", height: 54, flexShrink: 0 }}>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 34, background: "#1f2937", boxShadow: "inset 0 3px 0 rgba(255,255,255,0.12)" }}>
          <div className="splash-road" style={{ position: "absolute", left: 0, right: 0, top: 15, height: 4, backgroundImage: "linear-gradient(90deg, #fde68a 0 32px, transparent 32px 64px)", backgroundSize: "64px 4px" }} />
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/vehicles/sedan.webp" alt="" width={74} height={46} style={{ position: "absolute", bottom: 12, left: 0, height: 46, width: "auto", animation: "splash-drive 3.4s cubic-bezier(0.4,0,0.3,1) 0.3s infinite" }} />
      </div>

      <div style={{ background: "#1f2937", padding: `14px 20px calc(${showCta ? 20 : 26}px + env(safe-area-inset-bottom))`, position: "relative", zIndex: 1, flexShrink: 0 }}>
        {showCta ? (
          <div className="fade-up">
            <PrimaryButton tone="gold" onClick={onStart}>{cta} <ArrowRight s={18} c="var(--blue-dark)" /></PrimaryButton>
            {footer}
          </div>
        ) : (
          <div>
            <div style={{ height: 4, borderRadius: 4, background: "rgba(255,255,255,0.14)", overflow: "hidden" }}>
              <div style={{ height: "100%", borderRadius: 4, background: "linear-gradient(90deg,#fde68a,#f97316)", animation: `splash-load ${holdMs}ms ease-out both` }} />
            </div>
            <p style={{ margin: "10px 0 0", textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.6)", letterSpacing: "0.06em" }}>
              {variant === "admin" ? "Opening the admin console…" : "Tap to skip"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

const Shell = ({ children, onBack }: { children: React.ReactNode; onBack?: () => void }) => (
  <div className="fade-up" style={{ position: "absolute", inset: 0, zIndex: 190, background: "var(--app-bg)", display: "flex", flexDirection: "column", overflowY: "auto" }}>
    <div style={{ padding: "18px 16px 0", minHeight: 42 }}>
      {onBack && <button onClick={onBack} aria-label="Back" className="press" style={iconBtn}><BackIcon c="var(--on-bg)" /></button>}
    </div>
    {children}
  </div>
);

const H = ({ title, accent, body }: { title: string; accent?: string; body: string }) => (
  <div style={{ padding: "8px 24px 0" }}>
    <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: "var(--on-bg)", lineHeight: 1.2 }}>
      {title}{accent && <><br /><span style={{ color: "var(--on-bg-accent)" }}>{accent}</span></>}
    </h1>
    <p style={{ margin: "10px 0 0", fontSize: 14.5, color: "var(--on-bg-soft)", lineHeight: 1.55 }}>{body}</p>
  </div>
);

/** local@domain.tld — no spaces, no empty or doubled dots, a letters-only TLD of 2+ chars. */
const isEmail = (e: string) => /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[a-z]{2,}$/i.test(e.trim()) && !e.includes("..");
const MIN_PASSWORD = 6;

const SwitchLink = ({ q, cta, onClick }: { q: string; cta: string; onClick: () => void }) => (
  <p style={{ margin: 0, textAlign: "center", fontSize: 13.5, color: "var(--on-bg-soft)" }}>
    {q} <button type="button" onClick={onClick} style={{ background: "none", border: "none", padding: 0, color: "var(--on-bg-accent)", fontWeight: 600, fontSize: 13.5, cursor: "pointer" }}>{cta}</button>
  </p>
);

const Terms = () => (
  <p style={{ marginTop: "auto", fontSize: 11.5, color: "var(--on-bg-soft)", textAlign: "center", lineHeight: 1.5 }}>
    By continuing you agree to DriveWay&apos;s Terms of Service and Privacy Policy.
  </p>
);

/** Email + password sign-in (Supabase Auth). */
export function EmailLogin({ title, accent, onSignedIn, onSignUp, onForgot, notice }: {
  title: string; accent: string; onSignedIn: () => void; onSignUp: () => void; onForgot: () => void; notice?: string | null;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(notice ?? null);
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
        <div>
          <label style={label} htmlFor="lp">Password</label><PasswordInput id="lp" value={password} onChange={(e) => { setPassword(e.target.value); setErr(null); }} placeholder="Your password" autoComplete="current-password" />
          <div style={{ textAlign: "right", marginTop: 8 }}>
            <button type="button" onClick={onForgot} style={{ background: "none", border: "none", padding: 0, color: "var(--on-bg-accent)", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Forgot password?</button>
          </div>
        </div>
        <ErrorText msg={err} />
        <PrimaryButton type="submit" disabled={!ok || busy}>{busy ? "Logging in…" : "Log in"}</PrimaryButton>
        <SwitchLink q="New to DriveWay?" cta="Create an account" onClick={onSignUp} />
        <Terms />
      </form>
    </Shell>
  );
}

/** Email → reset link. Says the same thing whether or not the email has an account. */
export function ForgotPassword({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async () => {
    if (!isEmail(email) || busy) return;
    setBusy(true); setErr(null);
    try { await sendPasswordReset(email); setSent(true); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Shell onBack={onBack}>
      {sent ? (
        <>
          <H title="Check your" accent="inbox" body={`If ${email.trim()} has a DriveWay account, we've sent it a link to reset your password. The link works once and expires in an hour.`} />
          <div style={{ padding: "28px 24px 24px", display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
            <PrimaryButton onClick={onBack}>Back to log in</PrimaryButton>
            <SwitchLink q="No email? Check spam, or" cta="send it again" onClick={() => setSent(false)} />
          </div>
        </>
      ) : (
        <>
          <H title="Forgot your" accent="password?" body="Enter the email you signed up with and we'll send you a link to set a new one." />
          <form onSubmit={(e) => { e.preventDefault(); void submit(); }} style={{ padding: "28px 24px 24px", display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
            <div><label style={label} htmlFor="fe">Email</label><input id="fe" type="email" value={email} maxLength={254} onChange={(e) => { setEmail(e.target.value); setErr(null); }} placeholder="you@example.com" style={field} autoComplete="email" /></div>
            <ErrorText msg={err} />
            <PrimaryButton type="submit" disabled={!isEmail(email) || busy}>{busy ? "Sending…" : "Send reset link"}</PrimaryButton>
            <SwitchLink q="Remembered it?" cta="Log in" onClick={onBack} />
          </form>
        </>
      )}
    </Shell>
  );
}

/** Opened from the emailed link (a recovery session) → choose a new password. */
export function ResetPassword({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const ok = password.length >= MIN_PASSWORD && confirm === password;
  const submit = async () => {
    if (!ok || busy) return;
    setBusy(true); setErr(null);
    try { await updatePassword(password); onDone(); } catch (e) { setErr((e as Error).message); setBusy(false); }
  };
  return (
    <Shell>
      <H title="Set a new" accent="password" body="Choose a new password for your DriveWay account." />
      <form onSubmit={(e) => { e.preventDefault(); void submit(); }} style={{ padding: "28px 24px 24px", display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
        <div>
          <label style={label} htmlFor="rp">New Password</label>
          <PasswordInput id="rp" value={password} onChange={(e) => { setPassword(e.target.value); setErr(null); }} placeholder={`At least ${MIN_PASSWORD} characters`} autoComplete="new-password" />
          {password.length > 0 && password.length < MIN_PASSWORD && <ErrorText msg={`Use at least ${MIN_PASSWORD} characters.`} />}
        </div>
        <div>
          <label style={label} htmlFor="rc">Confirm Password</label>
          <PasswordInput id="rc" value={confirm} onChange={(e) => { setConfirm(e.target.value); setErr(null); }} placeholder="Type it again" autoComplete="new-password" />
          {confirm.length > 0 && confirm !== password && <ErrorText msg="Passwords don't match." />}
        </div>
        <ErrorText msg={err} />
        <PrimaryButton type="submit" disabled={!ok || busy}>{busy ? "Saving…" : "Save password"}</PrimaryButton>
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
  const [badEmail, setBadEmail] = useState(false);
  // The email is checked on submit, not here, so a bad one gets the popup instead of a silently greyed-out button.
  const ok = name.trim().length > 0 && email.trim().length > 0 && isIndianMobile(phone) && password.length >= MIN_PASSWORD;
  const submit = async () => {
    if (!ok || busy) return;
    if (!isEmail(email)) { setBadEmail(true); return; }
    setBusy(true); setErr(null);
    if (!(await emailDomainExists(email))) { setBadEmail(true); setBusy(false); return; }
    try { onSignedUp(await emailSignUp({ name, email, phone, password })); } catch (e) { setErr((e as Error).message); setBusy(false); }
  };
  return (
    <Shell onBack={onLogin}>
      <H title="Create your" accent="DriveWay account" body="A few details and you're ready to ride." />
      <form noValidate onSubmit={(e) => { e.preventDefault(); void submit(); }} style={{ padding: "24px 24px", display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
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
          <PasswordInput id="spw" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={`At least ${MIN_PASSWORD} characters`} autoComplete="new-password" />
          {password.length > 0 && password.length < MIN_PASSWORD && <ErrorText msg={`Use at least ${MIN_PASSWORD} characters.`} />}
        </div>
        <ErrorText msg={err} />
        <PrimaryButton type="submit" disabled={!ok || busy}>{busy ? "Creating account…" : "Sign up"}</PrimaryButton>
        <SwitchLink q="Already have an account?" cta="Log in" onClick={onLogin} />
        <Terms />
      </form>
      {badEmail && <InvalidEmailPopup onClose={() => { setBadEmail(false); document.getElementById("se")?.focus(); }} />}
    </Shell>
  );
}

function InvalidEmailPopup({ onClose }: { onClose: () => void }) {
  return (
    <div role="alertdialog" aria-modal="true" aria-labelledby="iet" aria-describedby="ieb" onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(2,11,36,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div className="fade-up" onClick={(e) => e.stopPropagation()} style={{ ...card, width: "100%", maxWidth: 320, padding: "22px 20px 18px", textAlign: "center" }}>
        <p id="iet" style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "var(--ink)" }}>Invalid email</p>
        <p id="ieb" style={{ margin: "8px 0 18px", fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.5 }}>Please enter a valid email address, like you@example.com.</p>
        <PrimaryButton onClick={onClose}>OK</PrimaryButton>
      </div>
    </div>
  );
}

/** Name and email — shown once, after the first sign-in. */
/** Shown instead of the app when an admin has blocked (or, for riders, suspended) the account.
 * Nothing can be booked, accepted or edited — the server refuses it too; the only way out is logging out. */
export function BlockedScreen({ who }: { who: "customer" | "rider" }) {
  const [busy, setBusy] = useState(false);
  return (
    <Shell>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 24px 24px" }}>
        <div role="alert" className="fade-up" style={{ ...card, padding: "28px 22px", textAlign: "center" }}>
          <span style={{ width: 64, height: 64, margin: "0 auto", borderRadius: "50%", background: "var(--error)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <LockIcon s={30} c="var(--error-text)" />
          </span>
          <h1 style={{ margin: "16px 0 6px", fontSize: 22, fontWeight: 800, color: "var(--ink)" }}>Your account is blocked</h1>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: "var(--ink-soft)" }}>
            {who === "rider"
              ? "You can't go online, take rides or make changes to your account right now. Please contact DriveWay support to have it reviewed."
              : "You can't book rides or make changes to your account right now. Please contact DriveWay support to have it reviewed."}
          </p>
        </div>
      </div>
      <div style={{ padding: "0 24px calc(24px + env(safe-area-inset-bottom))" }}>
        <PrimaryButton tone="ghost" disabled={busy} onClick={() => { setBusy(true); void signOut().finally(() => setBusy(false)); }}>
          <LogoutIcon s={18} c="var(--ink)" /> {busy ? "Logging out…" : "Log out"}
        </PrimaryButton>
      </div>
    </Shell>
  );
}

/** Pinned above a blocked account's (read-only) app: they can look around, but not book, ride or edit. */
export function BlockedBanner({ who }: { who: "customer" | "rider" }) {
  return (
    <div role="alert" style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", paddingTop: "calc(10px + env(safe-area-inset-top))", background: "var(--error)", color: "var(--error-text)", flexShrink: 0 }}>
      <LockIcon s={18} c="var(--error-text)" />
      <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.45, fontWeight: 600 }}>
        {who === "rider"
          ? "Your account is blocked — you can't go online, take rides or edit your details. Contact support to have it reviewed."
          : "Your account is blocked — you can't book rides or edit your profile. Contact support to have it reviewed."}
      </p>
    </div>
  );
}

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
        <div><label style={label} htmlFor="e">Email <span style={{ fontWeight: 400, color: "var(--on-bg-soft)" }}>(optional)</span></label><input id="e" type="email" value={email} maxLength={254} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" style={field} autoComplete="email" /></div>
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
