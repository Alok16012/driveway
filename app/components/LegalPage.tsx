import Link from "next/link";

/** Plain, readable page for the privacy policy, terms and account deletion — linked from the apps and Play Store. */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "var(--app-bg)", padding: "28px 16px 48px" }}>
      <main style={{ maxWidth: 760, margin: "0 auto", background: "var(--surface)", color: "var(--ink)", borderRadius: 20, padding: "28px 22px", boxShadow: "var(--shadow-lg)", lineHeight: 1.65, fontSize: 15 }}>
        <Link href="/" style={{ color: "var(--blue)", fontWeight: 600, fontSize: 14, textDecoration: "none" }}>← DriveWay</Link>
        <h1 style={{ margin: "14px 0 4px", fontSize: 28, lineHeight: 1.2 }}>{title}</h1>
        <p style={{ margin: "0 0 18px", fontSize: 13, color: "var(--ink-mute)" }}>Last updated: {updated}</p>
        <div className="legal">{children}</div>
        <p style={{ margin: "28px 0 0", fontSize: 13, color: "var(--ink-mute)" }}>
          <Link href="/privacy" style={{ color: "var(--blue)" }}>Privacy Policy</Link> · <Link href="/terms" style={{ color: "var(--blue)" }}>Terms of Service</Link> · <Link href="/delete-account" style={{ color: "var(--blue)" }}>Delete your account</Link>
        </p>
      </main>
    </div>
  );
}
