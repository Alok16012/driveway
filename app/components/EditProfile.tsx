"use client";

/* Edit-profile page shared by the customer and rider apps: name, email, mobile, and (for riders) city. */
import { useState } from "react";
import { MobileInput } from "./Auth";
import { PageHeader, PrimaryButton, field, label } from "./ui";

export interface ProfileValues { name: string; email: string; phone: string; city?: string }

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function EditProfilePage({ initial, cities, note, onSave, onBack }: {
  initial: ProfileValues;
  /** Riders pick a city; customers don't see the field. */
  cities?: string[];
  note?: string;
  /** Resolves to an error message, or null when saved. */
  onSave: (v: ProfileValues) => Promise<string | null>;
  onBack: () => void;
}) {
  const [v, setV] = useState<ProfileValues>({ ...initial, phone: initial.phone.replace(/\D/g, "").slice(-10) });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (p: Partial<ProfileValues>) => { setV((x) => ({ ...x, ...p })); setErr(""); };
  const ok = v.name.trim().length >= 2 && v.phone.length === 10 && (!v.email.trim() || EMAIL.test(v.email.trim())) && (!cities || !!v.city);

  const save = async () => {
    setBusy(true); setErr("");
    const e = await onSave({ ...v, name: v.name.trim(), email: v.email.trim() });
    setBusy(false);
    if (e) setErr(e);
  };

  return (
    <div>
      <PageHeader title="Edit Profile" onBack={onBack} />
      <form onSubmit={(e) => { e.preventDefault(); if (ok && !busy) save(); }} style={{ padding: "0 16px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
        <div><label style={label} htmlFor="pn">Full name</label><input id="pn" value={v.name} onChange={(e) => set({ name: e.target.value })} style={field} autoComplete="name" /></div>
        <div><label style={label} htmlFor="pe">Email</label><input id="pe" type="email" value={v.email} onChange={(e) => set({ email: e.target.value })} placeholder="you@example.com" style={field} autoComplete="email" /></div>
        <div><label style={label} htmlFor="phone">Mobile number</label><MobileInput value={v.phone} onChange={(phone) => set({ phone })} /></div>
        {cities && (
          <div>
            <span style={label}>City</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {cities.map((c) => {
                const on = c === v.city;
                return (
                  <button key={c} type="button" onClick={() => set({ city: c })} aria-pressed={on} style={{
                    padding: "9px 14px", borderRadius: 12, cursor: "pointer", fontSize: 13, fontWeight: 600,
                    background: on ? "var(--blue-tint)" : "var(--surface)", color: on ? "var(--blue)" : "var(--text-secondary)",
                    border: on ? "1.5px solid var(--blue)" : "1.5px solid var(--line)",
                  }}>{c}</button>
                );
              })}
            </div>
          </div>
        )}
        {note && <p style={{ margin: 0, fontSize: 12, color: "var(--ink-mute)", lineHeight: 1.5 }}>{note}</p>}
        {err && <p role="alert" style={{ margin: 0, fontSize: 12.5, color: "var(--red)" }}>{err}</p>}
        <PrimaryButton type="submit" disabled={!ok || busy}>{busy ? "Saving…" : "Save changes"}</PrimaryButton>
      </form>
    </div>
  );
}
