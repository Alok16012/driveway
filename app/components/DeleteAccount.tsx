"use client";

import { useState } from "react";
import { Sheet } from "./customer/BookingScreens";
import { ErrorText, PrimaryButton, field } from "./ui";
import { deleteMyAccount } from "../lib/api";

/** Delete my account: what goes, what stays, and a typed confirmation. Signs out when done. */
export function DeleteAccountSheet({ rider, onClose, onDeleted }: { rider?: boolean; onClose: () => void; onDeleted: () => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const ok = text.trim().toUpperCase() === "DELETE";
  const go = async () => {
    if (!ok || busy) return;
    setBusy(true); setErr(null);
    try { await deleteMyAccount(!!rider); onDeleted(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const li: React.CSSProperties = { margin: "4px 0", fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.45 };
  return (
    <Sheet onClose={busy ? () => undefined : onClose}>
      <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "var(--ink)" }}>Delete your account?</p>
      <ul style={{ margin: "10px 0 0", paddingLeft: 18 }}>
        <li style={li}>Your name, phone, email{rider ? ", documents, vehicle details and UPI ID" : " and saved places"} are removed and you are signed out.</li>
        <li style={li}>Ride and payment records stay without your name, as required for accounts and tax.</li>
        {rider && <li style={li}>Withdraw your wallet balance first — it can&apos;t be paid out after deletion. Cash dues must be cleared.</li>}
        <li style={li}>This can&apos;t be undone. You can sign up again later with the same number.</li>
      </ul>
      <label style={{ display: "block", margin: "14px 0 6px", fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>Type DELETE to confirm</label>
      <input value={text} onChange={(e) => setText(e.target.value)} autoCapitalize="characters" aria-label="Type DELETE to confirm" style={{ ...field, width: "100%" }} />
      <ErrorText msg={err} />
      <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
        <PrimaryButton tone="ghost" disabled={busy} onClick={onClose} style={{ flex: 1 }}>Cancel</PrimaryButton>
        <PrimaryButton disabled={!ok || busy} onClick={() => void go()} style={{ flex: 1, background: "var(--red)" }}>{busy ? "Deleting…" : "Delete account"}</PrimaryButton>
      </div>
    </Sheet>
  );
}
