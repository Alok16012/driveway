"use client";

import { useState } from "react";
import { BackIcon, CheckIcon, ClockIcon, DocIcon, UploadIcon } from "../icons";
import VehicleArt from "../VehicleArt";
import { ErrorText, Footer, PrimaryButton, StatusBadge, card, field, iconBtn, label } from "../ui";
import { CITIES, VEHICLES, type VehicleKind } from "../../lib/data";
import { getSession, registerDriver, type DriverApplication } from "../../lib/api";
import { supabase } from "../../lib/supabase/client";

type DocKey = "photo" | "licence" | "rc" | "insurance" | "aadhaar";

const DOCS: { id: DocKey; label: string; sub: string }[] = [
  { id: "photo", label: "Profile Photo", sub: "Clear face, no sunglasses" },
  { id: "licence", label: "Driving Licence", sub: "Front & back in one image or PDF" },
  { id: "rc", label: "Vehicle RC", sub: "Registration certificate" },
  { id: "insurance", label: "Vehicle Insurance", sub: "Valid policy document" },
  { id: "aadhaar", label: "Aadhaar / ID Proof", sub: "For identity verification" },
];

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "application/pdf": "pdf" };
const PLATE_RE = /^[A-Z]{2}\s?\d{1,2}\s?[A-Z]{0,3}\s?\d{4}$/;
const UPI_RE = /^[a-zA-Z0-9._-]{2,64}@[a-zA-Z]{2,32}$/;
const STEPS = ["Personal", "Vehicle", "Documents", "Payout"];

/** Four-step driver application. Documents go to a private storage bucket; an admin reviews them. */
export function KycFlow({ onSubmitted }: { onSubmitted: () => void }) {
  const [step, setStep] = useState(0);
  const [k, setK] = useState({ name: "", city: "Noida", vehicle: "sedan" as VehicleKind, model: "", plate: "", ac: true, upi: "" });
  const [docs, setDocs] = useState<Partial<Record<DocKey, string>>>({});
  const [uploading, setUploading] = useState<DocKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (p: Partial<typeof k>) => { setK((x) => ({ ...x, ...p })); setErr(null); };

  const upload = async (id: DocKey, file: File | undefined) => {
    if (!file) return;
    setErr(null);
    const ext = TYPES[file.type];
    if (!ext) { setErr("Upload a JPG, PNG or PDF file."); return; }
    if (file.size > MAX_BYTES) { setErr("Files must be 5 MB or smaller."); return; }
    setUploading(id);
    try {
      const uid = (await getSession())?.user.id;
      if (!uid) throw new Error("Your session has expired. Please sign in again.");
      const path = `${uid}/${id}-${Date.now()}.${ext}`;
      const { error } = await supabase().storage.from("driver-docs").upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw new Error(error.message);
      setDocs((d) => ({ ...d, [id]: path }));
    } catch (e) { setErr((e as Error).message); } finally { setUploading(null); }
  };

  const ok = [
    k.name.trim().length > 1,
    k.model.trim().length >= 2 && PLATE_RE.test(k.plate.trim()),
    DOCS.every((d) => docs[d.id]),
    UPI_RE.test(k.upi),
  ][step];

  const submit = async () => {
    setBusy(true); setErr(null);
    try {
      const app: DriverApplication = { name: k.name.trim(), city: k.city, vehicle: k.vehicle, model: k.model.trim(), plate: k.plate.trim(), ac: k.ac,
        docs: docs as DriverApplication["docs"], upi: k.upi };
      await registerDriver(app);
      onSubmitted();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <div className="fade-up" style={{ position: "absolute", inset: 0, zIndex: 190, background: "var(--app-bg)", display: "flex", flexDirection: "column", overflowY: "auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "18px 16px 8px" }}>
        {step > 0 && <button onClick={() => setStep(step - 1)} aria-label="Back" className="press" style={iconBtn}><BackIcon c="var(--ink)" /></button>}
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "var(--blue)" }}>STEP {step + 1} OF 4</p>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{["Personal details", "Your vehicle", "Upload documents", "Payout details"][step]}</h2>
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, padding: "4px 16px 18px" }}>
        {STEPS.map((s, i) => (
          <div key={s} style={{ flex: 1 }}>
            <span style={{ display: "block", height: 4, borderRadius: 4, background: i <= step ? "var(--blue)" : "var(--line-strong)" }} />
            <span style={{ display: "block", marginTop: 4, fontSize: 10.5, fontWeight: 600, color: i <= step ? "var(--ink)" : "var(--ink-mute)" }}>{s}</span>
          </div>
        ))}
      </div>

      <div style={{ padding: "0 16px", flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
        {step === 0 && (
          <>
            <div><label style={label} htmlFor="kn">Full name (as on licence)</label><input id="kn" value={k.name} maxLength={80} onChange={(e) => set({ name: e.target.value })} placeholder="Rohit Kumar" style={field} autoComplete="name" /></div>
            <div>
              <span style={label}>City</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {CITIES.map((c) => {
                  const on = c === k.city;
                  return <button key={c} onClick={() => set({ city: c })} aria-pressed={on} style={{ padding: "9px 14px", borderRadius: 12, cursor: "pointer", fontSize: 13, fontWeight: 600, background: on ? "var(--blue-tint)" : "var(--surface)", color: on ? "var(--blue)" : "var(--text-secondary)", border: on ? "1.5px solid var(--blue)" : "1.5px solid var(--line)" }}>{c}</button>;
                })}
              </div>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <div>
              <span style={label}>Vehicle category</span>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
                {VEHICLES.map((v) => {
                  const on = v.id === k.vehicle;
                  return (
                    <button key={v.id} onClick={() => set({ vehicle: v.id, ac: v.ac ? k.ac : false })} aria-pressed={on} className="press" style={{ ...card, padding: "10px 4px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, border: on ? "1.5px solid var(--blue)" : "1.5px solid transparent", background: on ? "var(--blue-tint)" : "var(--surface)" }}>
                      <VehicleArt kind={v.id} size={50} />
                      <span style={{ fontSize: 12.5, fontWeight: 600 }}>{v.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            {VEHICLES.find((v) => v.id === k.vehicle)?.ac && (
              <div>
                <span style={label}>Air conditioning</span>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {[true, false].map((v) => {
                    const on = k.ac === v;
                    return <button key={String(v)} onClick={() => set({ ac: v })} aria-pressed={on} style={{ padding: "11px 10px", borderRadius: 12, cursor: "pointer", fontSize: 13.5, fontWeight: 600, textAlign: "left", background: on ? "var(--blue-tint)" : "var(--surface)", color: "var(--ink)", border: on ? "1.5px solid var(--blue)" : "1.5px solid var(--line)" }}>
                      {v ? "❄ AC vehicle" : "Non-AC vehicle"}<span style={{ display: "block", fontSize: 11, fontWeight: 500, color: "var(--ink-soft)" }}>{v ? "Get AC and Non-AC rides" : "Get Non-AC rides only"}</span>
                    </button>;
                  })}
                </div>
              </div>
            )}
            <div><label style={label} htmlFor="km">Make, model & colour</label><input id="km" value={k.model} maxLength={60} onChange={(e) => set({ model: e.target.value })} placeholder="Maruti Dzire · White" style={field} /></div>
            <div>
              <label style={label} htmlFor="kp">Registration number</label>
              <input id="kp" value={k.plate} maxLength={15} onChange={(e) => set({ plate: e.target.value.toUpperCase() })} placeholder="UP16 AB 1234" style={field} />
              {k.plate.length >= 6 && !PLATE_RE.test(k.plate.trim()) && <ErrorText msg="Use the format on your RC, e.g. UP16 AB 1234." />}
            </div>
          </>
        )}

        {step === 2 && DOCS.map((d) => {
          const done = !!docs[d.id];
          const busyDoc = uploading === d.id;
          return (
            <label key={d.id} className="press" style={{ ...card, border: done ? "1.5px solid var(--success-border)" : "1.5px dashed var(--line-strong)", padding: 14, display: "flex", alignItems: "center", gap: 12, cursor: uploading ? "wait" : "pointer" }}>
              <input type="file" accept="image/jpeg,image/png,application/pdf" disabled={!!uploading} style={{ display: "none" }} onChange={(e) => void upload(d.id, e.target.files?.[0])} />
              <span style={{ width: 42, height: 42, borderRadius: 12, background: done ? "var(--success)" : "var(--blue-tint)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {done ? <CheckIcon s={20} c="var(--success-text)" /> : <DocIcon s={20} c="var(--blue)" />}
              </span>
              <span style={{ flex: 1 }}>
                <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{d.label}</span>
                <span style={{ display: "block", fontSize: 12, color: done ? "var(--success-text)" : "var(--ink-soft)" }}>{busyDoc ? "Uploading…" : done ? "Uploaded · tap to replace" : `${d.sub} · JPG, PNG or PDF, max 5 MB`}</span>
              </span>
              {!done && <UploadIcon s={20} c="var(--blue)" />}
            </label>
          );
        })}

        {step === 3 && (
          <>
            <div>
              <label style={label} htmlFor="ku">UPI ID for payouts</label>
              <input id="ku" value={k.upi} maxLength={97} onChange={(e) => set({ upi: e.target.value.trim() })} placeholder="name@okaxis" style={field} />
              {k.upi && !UPI_RE.test(k.upi) && <ErrorText msg="Enter a UPI ID like name@okaxis." />}
            </div>
            <p style={{ margin: 0, fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.5 }}>Payouts go to this UPI ID. Only DriveWay admins reviewing your application can see your documents.</p>
          </>
        )}
        <ErrorText msg={err} />
      </div>
      <Footer>
        <PrimaryButton disabled={!ok || busy || !!uploading} onClick={() => (step < 3 ? setStep(step + 1) : void submit())}>{busy ? "Submitting…" : step < 3 ? "Continue" : "Submit for Verification"}</PrimaryButton>
      </Footer>
    </div>
  );
}

/** Waiting for an admin to review the application. */
export function PendingApproval({ name, kyc, note, checking, onRefresh, onReapply, onLogout }: {
  name: string; kyc: "Pending" | "Rejected"; note: string | null; checking: boolean; onRefresh: () => void; onReapply: () => void; onLogout: () => void;
}) {
  const rejected = kyc === "Rejected";
  return (
    <div className="fade-up" style={{ position: "absolute", inset: 0, zIndex: 190, background: "var(--app-bg)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}>
      <div style={{ width: 96, height: 96, borderRadius: "50%", background: rejected ? "var(--error)" : "var(--gold-tint)", display: "flex", alignItems: "center", justifyContent: "center" }}><ClockIcon s={48} c={rejected ? "var(--red)" : "var(--gold-dark)"} /></div>
      <h1 style={{ margin: "20px 0 6px", fontSize: 24, fontWeight: 800 }}>{rejected ? "Application not approved" : "Verification in progress"}</h1>
      <p style={{ margin: 0, fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.55 }}>
        {rejected ? <>Sorry {name.split(" ")[0]}, we couldn&apos;t approve your application{note ? `: ${note}` : "."} You can fix it and apply again.</>
          : <>Thanks {name.split(" ")[0]}! Our team is checking your documents. This usually takes under 24 hours.</>}
      </p>
      <div style={{ marginTop: 18 }}><StatusBadge status={kyc} /></div>
      <div style={{ width: "100%", marginTop: 24, display: "flex", flexDirection: "column", gap: 10 }}>
        {rejected ? <PrimaryButton onClick={onReapply}>Apply again</PrimaryButton> : <PrimaryButton onClick={onRefresh} disabled={checking}>{checking ? "Checking…" : "Check status"}</PrimaryButton>}
        <PrimaryButton tone="ghost" onClick={onLogout}>Log out</PrimaryButton>
      </div>
    </div>
  );
}
