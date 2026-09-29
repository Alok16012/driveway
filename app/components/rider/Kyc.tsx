"use client";

import { useState } from "react";
import { BackIcon, CheckIcon, ClockIcon, DocIcon, UploadIcon } from "../icons";
import VehicleArt from "../VehicleArt";
import { DemoButton, Footer, PrimaryButton, card, field, iconBtn, label } from "../ui";
import { VEHICLES, type VehicleKind } from "../../lib/data";

export interface KycData {
  name: string; email: string; city: string;
  vehicle: VehicleKind; model: string; plate: string;
  docs: Record<string, boolean>;
  upi: string; account: string; ifsc: string;
}

const DOCS = [
  { id: "photo", label: "Profile Photo", sub: "Clear face, no sunglasses" },
  { id: "dl", label: "Driving Licence", sub: "Front & back" },
  { id: "rc", label: "Vehicle RC", sub: "Registration certificate" },
  { id: "ins", label: "Vehicle Insurance", sub: "Valid policy document" },
  { id: "aadhaar", label: "Aadhaar / ID Proof", sub: "For identity verification" },
];

const STEPS = ["Personal", "Vehicle", "Documents", "Bank"];

/** Four-step rider registration (PRD §5.1). Uploads are simulated. */
export function KycFlow({ onSubmit }: { onSubmit: (k: KycData) => void }) {
  const [step, setStep] = useState(0);
  const [k, setK] = useState<KycData>({
    name: "", email: "", city: "Noida", vehicle: "sedan", model: "", plate: "",
    docs: {}, upi: "", account: "", ifsc: "",
  });
  const set = (p: Partial<KycData>) => setK((x) => ({ ...x, ...p }));

  const ok = [
    k.name.trim().length > 1,
    k.model.trim() && k.plate.trim().length >= 6,
    DOCS.every((d) => k.docs[d.id]),
    k.upi.includes("@") || (k.account.length >= 9 && k.ifsc.length === 11),
  ][step];

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
            <div><label style={label} htmlFor="kn">Full name (as on licence)</label><input id="kn" value={k.name} onChange={(e) => set({ name: e.target.value })} placeholder="Rohit Kumar" style={field} /></div>
            <div><label style={label} htmlFor="ke">Email <span style={{ fontWeight: 400, color: "var(--ink-mute)" }}>(optional)</span></label><input id="ke" type="email" value={k.email} onChange={(e) => set({ email: e.target.value })} placeholder="you@example.com" style={field} /></div>
            <div>
              <span style={label}>City</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {["Noida", "Delhi", "Gurugram", "Lucknow"].map((c) => {
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
                    <button key={v.id} onClick={() => set({ vehicle: v.id })} aria-pressed={on} className="press" style={{ ...card, padding: "10px 4px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, border: on ? "1.5px solid var(--blue)" : "1.5px solid transparent", background: on ? "var(--blue-tint)" : "var(--surface)" }}>
                      <VehicleArt kind={v.id} size={50} />
                      <span style={{ fontSize: 12.5, fontWeight: 600 }}>{v.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div><label style={label} htmlFor="km">Make, model & colour</label><input id="km" value={k.model} onChange={(e) => set({ model: e.target.value })} placeholder="Maruti Dzire · White" style={field} /></div>
            <div><label style={label} htmlFor="kp">Registration number</label><input id="kp" value={k.plate} onChange={(e) => set({ plate: e.target.value.toUpperCase() })} placeholder="UP16 AB 1234" style={{ ...field, textTransform: "uppercase", letterSpacing: "0.04em" }} /></div>
          </>
        )}

        {step === 2 && DOCS.map((d) => {
          const done = k.docs[d.id];
          return (
            <button key={d.id} onClick={() => set({ docs: { ...k.docs, [d.id]: true } })} className="press" style={{ ...card, border: done ? "1.5px solid var(--success-border)" : "1.5px dashed var(--line-strong)", padding: 14, display: "flex", alignItems: "center", gap: 12, cursor: "pointer", textAlign: "left" }}>
              <span style={{ width: 42, height: 42, borderRadius: 12, background: done ? "var(--success)" : "var(--blue-tint)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {done ? <CheckIcon s={20} c="var(--success-text)" /> : <DocIcon s={20} c="var(--blue)" />}
              </span>
              <span style={{ flex: 1 }}>
                <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{d.label}</span>
                <span style={{ display: "block", fontSize: 12, color: done ? "var(--success-text)" : "var(--ink-soft)" }}>{done ? "Uploaded · pending review" : d.sub}</span>
              </span>
              {!done && <UploadIcon s={20} c="var(--blue)" />}
            </button>
          );
        })}

        {step === 3 && (
          <>
            <div><label style={label} htmlFor="ku">UPI ID</label><input id="ku" value={k.upi} onChange={(e) => set({ upi: e.target.value.trim() })} placeholder="name@okaxis" style={field} /></div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--ink-mute)", fontSize: 12 }}><span style={{ flex: 1, height: 1, background: "var(--line-strong)" }} /> or bank account <span style={{ flex: 1, height: 1, background: "var(--line-strong)" }} /></div>
            <div><label style={label} htmlFor="ka">Account number</label><input id="ka" inputMode="numeric" value={k.account} onChange={(e) => set({ account: e.target.value.replace(/\D/g, "").slice(0, 18) })} placeholder="XXXX XXXX XXXX" style={field} /></div>
            <div><label style={label} htmlFor="ki">IFSC</label><input id="ki" value={k.ifsc} onChange={(e) => set({ ifsc: e.target.value.toUpperCase().slice(0, 11) })} placeholder="HDFC0001234" style={{ ...field, textTransform: "uppercase" }} /></div>
            <p style={{ margin: 0, fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.5 }}>Weekly payouts land here every Monday. Only admins with verification access can see your documents.</p>
          </>
        )}
      </div>
      <Footer>
        <PrimaryButton disabled={!ok} onClick={() => (step < 3 ? setStep(step + 1) : onSubmit(k))}>{step < 3 ? "Continue" : "Submit for Verification"}</PrimaryButton>
        {step === 2 && !ok && <div style={{ textAlign: "center", marginTop: 10 }}><DemoButton onClick={() => set({ docs: Object.fromEntries(DOCS.map((d) => [d.id, true])) })}>upload all</DemoButton></div>}
      </Footer>
    </div>
  );
}

/** Waiting for admin approval. */
export function PendingApproval({ name, onApproved }: { name: string; onApproved: () => void }) {
  return (
    <div className="fade-up" style={{ position: "absolute", inset: 0, zIndex: 190, background: "var(--app-bg)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 28, textAlign: "center" }}>
      <div style={{ width: 96, height: 96, borderRadius: "50%", background: "var(--gold-tint)", display: "flex", alignItems: "center", justifyContent: "center" }}><ClockIcon s={48} c="var(--gold-dark)" w={1.6} /></div>
      <h1 style={{ margin: "20px 0 6px", fontSize: 24, fontWeight: 800 }}>Verification in progress</h1>
      <p style={{ margin: 0, fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.55 }}>Thanks, {name.split(" ")[0] || "rider"}! Our team is reviewing your documents. This usually takes 24–48 hours — we&apos;ll notify you once you&apos;re approved.</p>
      <div style={{ ...card, width: "100%", padding: 14, marginTop: 22, textAlign: "left" }}>
        {[["Documents submitted", true], ["Background check", false], ["Account activated", false]].map(([t, d], i) => (
          <div key={String(t)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderTop: i ? "1px solid var(--line)" : "none" }}>
            <span style={{ width: 22, height: 22, borderRadius: "50%", background: d ? "var(--green)" : "var(--line)", display: "flex", alignItems: "center", justifyContent: "center" }}>{d && <CheckIcon s={12} c="white" />}</span>
            <span style={{ fontSize: 13.5, fontWeight: 500, color: d ? "var(--ink)" : "var(--ink-soft)" }}>{t}</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 20 }}><DemoButton onClick={onApproved}>approve my account</DemoButton></div>
    </div>
  );
}
