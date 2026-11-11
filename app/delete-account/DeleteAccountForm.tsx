"use client";

import { useState } from "react";
import { deleteMyAccount, emailSignIn, myDriver, signOut } from "../lib/api";
import { ErrorText, PrimaryButton, field } from "../components/ui";

/** Sign in, then delete the account — for people who no longer have the app installed. */
export function DeleteAccountForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<"login" | "confirm" | "done">("login");
  const [rider, setRider] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try { await emailSignIn(email, password); setRider(!!(await myDriver())); setStep("confirm"); }
    catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  };
  const remove = async () => {
    setBusy(true); setErr(null);
    try { await deleteMyAccount(rider); setStep("done"); } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  };

  if (step === "done") return <p style={{ padding: 14, borderRadius: 12, background: "var(--success)", color: "var(--success-text)", fontWeight: 600 }}>Your DriveWay account has been deleted and you are signed out.</p>;
  if (step === "confirm") return (
    <div>
      <p>Signed in as <b>{email}</b>{rider ? " (rider account)" : ""}. Type DELETE to permanently delete this account.</p>
      <input value={text} onChange={(e) => setText(e.target.value)} aria-label="Type DELETE to confirm" autoCapitalize="characters" style={{ ...field, width: "100%", maxWidth: 320 }} />
      <ErrorText msg={err} />
      <div style={{ display: "flex", gap: 10, marginTop: 12, maxWidth: 420 }}>
        <PrimaryButton tone="ghost" disabled={busy} onClick={() => { void signOut(); setStep("login"); setText(""); }} style={{ flex: 1 }}>Cancel</PrimaryButton>
        <PrimaryButton disabled={busy || text.trim().toUpperCase() !== "DELETE"} onClick={() => void remove()} style={{ flex: 1, background: "var(--red)" }}>{busy ? "Deleting…" : "Delete account"}</PrimaryButton>
      </div>
    </div>
  );
  return (
    <form onSubmit={(e) => void login(e)} style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 360 }}>
      <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" aria-label="Email" autoComplete="email" style={field} />
      <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" aria-label="Password" autoComplete="current-password" style={field} />
      <ErrorText msg={err} />
      <PrimaryButton type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in to continue"}</PrimaryButton>
    </form>
  );
}
