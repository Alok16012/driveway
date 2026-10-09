"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import BottomNav, { HomeGlyph, OffersGlyph, ProfileGlyph, RidesGlyph, WalletGlyph } from "../components/BottomNav";
import { EmailLogin, SignUp, SplashScreen } from "../components/Auth";
import { KycFlow, PendingApproval } from "../components/rider/Kyc";
import { AlertsScreen, EarningsScreen, RequestPopup, RiderAccount, RiderHome, TripPage, TripsScreen, type AccountKey, type QuickKey } from "../components/rider/RiderScreens";
import {
  BankPage, CancelTripSheet, DocumentsPage, IncentivesScreen, PerformancePage, PreferencesPage, SosSheet, TripDetailPage, VehiclePage, WalletPage, type RiderPrefs,
} from "../components/rider/RiderPages";
import { ChatScreen, type ChatMessage } from "../components/customer/AccountScreens";
import { LoadState, Toast } from "../components/ui";
import { inr } from "../lib/data";
import { NATIVE_APP } from "../lib/native";
import {
  acceptRide, completeRide, confirmCash, declineRide, driverArrived, driverCancelRide, driverCloseRide, driverOffers, getSession, myDriver, myDriverTrips,
  myTrip, newKey, onAuthChange, payDues, rateCustomer, requestPayout, setOnline, signOut, startRide, supportMessage, updateMyUpi, watchResume, watchRides,
  type DriverMe, type RideView,
} from "../lib/api";
import { supabase } from "../lib/supabase/client";

const SHELL_MAX_W = 430;
const PREFS_KEY = "driveway:rider-prefs";

type Tab = "home" | "earnings" | "trips" | "incentives" | "account";
type Stage = "loading" | "splash" | "login" | "signup" | "kyc" | "pending" | "app";
type Detail = { k: "alerts" } | { k: "support" } | { k: "trip"; id: string } | { k: "wallet" } | { k: "performance" } | { k: Exclude<AccountKey, "help" | "performance"> };

const readPrefs = (): RiderPrefs => {
  try { return { autoAccept: false, cash: true, nav: "Google Maps", ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}") }; }
  catch { return { autoAccept: false, cash: true, nav: "Google Maps" }; }
};

export default function RiderApp() {
  const [stage, setStage] = useState<Stage>("loading");
  const [me, setMe] = useState<DriverMe | null>(null);
  const [tab, setTab] = useState<Tab>("home");
  const [stack, setStack] = useState<Detail[]>([]);
  const [offer, setOffer] = useState<RideView | null>(null);
  const [trip, setTrip] = useState<RideView | null>(null);
  const [trips, setTrips] = useState<RideView[] | null>(null);
  const [sheet, setSheet] = useState<"cancel" | "sos" | null>(null);
  const [prefs, setPrefs] = useState<RiderPrefs>({ autoAccept: false, cash: true, nav: "Google Maps" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);
  const [toggleErr, setToggleErr] = useState<string | null>(null);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [bootErr, setBootErr] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const scrollRef = useRef<HTMLDivElement>(null);
  const skipped = useRef(new Set<string>());
  const tripId = useRef<string | null>(null);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  useEffect(() => { setPrefs(readPrefs()); }, []);
  const changePrefs = (p: Partial<RiderPrefs>) => setPrefs((x) => { const n = { ...x, ...p }; try { localStorage.setItem(PREFS_KEY, JSON.stringify(n)); } catch { /* storage blocked */ } return n; });

  /* ── session ── */
  const boot = useCallback(async () => {
    setBootErr(null);
    try {
      if (!(await getSession())) { setStage("splash"); return; }
      const d = await myDriver();
      setMe(d);
      setStage(!d ? "kyc" : d.kyc === "Approved" ? "app" : "pending");
    } catch (e) { setBootErr((e as Error).message); }
  }, []);
  useEffect(() => { void boot(); }, [boot]);
  useEffect(() => onAuthChange((signedIn) => { if (!signedIn) { setStage("splash"); setMe(null); setTrip(null); setOffer(null); setStack([]); } }), []);

  const refreshMe = useCallback(async () => {
    try {
      const d = await myDriver();
      setMe(d);
      if (d && d.kyc !== "Approved") setStage("pending");
    } catch { /* next poll retries */ }
  }, []);
  const refreshTrip = useCallback(async () => {
    try {
      const t = await myTrip();
      if (!t && tripId.current) { void refreshMe(); }
      tripId.current = t?.id ?? null;
      setTrip(t);
    } catch { /* keep last state */ }
  }, [refreshMe, flash]);
  const refreshTrips = useCallback(async () => { try { setTrips(await myDriverTrips()); } catch (e) { flash((e as Error).message); } }, [flash]);

  useEffect(() => {
    if (stage !== "app") return;
    void refreshMe(); void refreshTrip();
    const stop = watchRides(() => { void refreshTrip(); });
    const t = setInterval(() => { void refreshTrip(); void refreshMe(); }, 5000);
    const unResume = watchResume(() => { void refreshTrip(); void refreshMe(); });
    return () => { stop(); clearInterval(t); unResume(); };
  }, [stage, refreshMe, refreshTrip]);

  // A customer cancellation removes the trip: tell the driver.
  const lastTrip = useRef<RideView | null>(null);
  const selfCancelled = useRef(false);
  useEffect(() => {
    if (lastTrip.current && !trip && lastTrip.current.status !== "Completed" && !selfCancelled.current) flash("The customer cancelled this ride");
    if (!trip) selfCancelled.current = false;
    lastTrip.current = trip;
  }, [trip, flash]);

  /* ── dispatch: poll for offers while online and free (this is also the heartbeat) ── */
  const online = !!me?.online;
  useEffect(() => {
    if (stage !== "app" || !online || trip) { setOffer(null); return; }
    let live = true;
    const poll = async () => {
      try {
        const list = (await driverOffers()).filter((o) => !skipped.current.has(o.id) && (prefs.cash || o.pay !== "Cash"));
        if (live) setOffer((cur) => (cur && list.some((o) => o.id === cur.id) ? cur : list[0] ?? null));
      } catch { /* retry next tick */ }
    };
    void poll();
    const t = setInterval(() => void poll(), 3000);
    const unResume = watchResume(() => void poll());
    return () => { live = false; clearInterval(t); unResume(); };
  }, [stage, online, trip, prefs.cash]);

  const toggleOnline = async (v: boolean) => {
    setToggling(true); setToggleErr(null);
    try { await setOnline(v); await refreshMe(); flash(v ? "You're online — looking for rides" : "You're offline"); }
    catch (e) { setToggleErr((e as Error).message); } finally { setToggling(false); }
  };

  const accept = useCallback(async () => {
    if (!offer || busy) return;
    setBusy(true); setErr(null);
    try { await acceptRide(offer.id); setOffer(null); setStack([]); await refreshTrip(); }
    catch (e) { skipped.current.add(offer.id); setOffer(null); flash((e as Error).message); }
    finally { setBusy(false); }
  }, [offer, busy, refreshTrip, flash]);
  const decline = useCallback((expired: boolean) => {
    if (!offer) return;
    skipped.current.add(offer.id);
    void declineRide(offer.id).then(refreshMe);
    setOffer(null);
    flash(expired ? "Request expired — counted as missed" : "Request declined");
  }, [offer, refreshMe, flash]);

  /** Run one trip action; refresh from the server either way so the screen matches the database. */
  const act = async (fn: () => Promise<unknown>, done?: string) => {
    if (busy || !trip) return;
    setBusy(true); setErr(null);
    try { await fn(); if (done) flash(done); } catch (e) { setErr((e as Error).message); }
    finally { await refreshTrip(); setBusy(false); }
  };

  const startTrip = (otp: string) => act(async () => {
    const r = await startRide(trip!.id, otp);
    if (r.error === "wrong_otp") throw new Error(`Wrong OTP — ${r.attempts_left} ${r.attempts_left === 1 ? "try" : "tries"} left. Ask the customer to read it again.`);
  });
  const finishTrip = (stars: number) => act(async () => {
    if (stars) await rateCustomer(trip!.id, stars); else await driverCloseRide(trip!.id);
    await refreshMe();
  }, "Trip closed — looking for your next ride");

  const navigate = (to: string) => {
    if (prefs.nav === "Google Maps") window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(to)}`, "_blank", "noopener");
    else flash(`Head to ${to}`);
  };

  /* ── wallet ── */
  const withdraw = async () => {
    setBusy(true); setErr(null);
    try { const r = await requestPayout(newKey()); await refreshMe(); flash(r.paid_out ? `${inr(r.paid_out)} is on its way to ${me?.upi}` : "Payout requested"); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const clearDues = async () => {
    setBusy(true); setErr(null);
    try { await payDues(newKey()); await refreshMe(); flash("Cash dues cleared — thank you!"); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  /* ── support chat backed by a ticket ── */
  const loadChat = useCallback(async () => {
    const { data } = await supabase().from("tickets").select("notes").eq("role", "Driver").order("created_at", { ascending: false }).limit(1);
    const notes = (data?.[0]?.notes ?? []) as { from: string; body: string; at: string }[];
    setChat([{ id: 0, from: "agent", body: "Hi! 👋 How can the rider support team help? Include the trip ID if it's about a ride.", at: "" },
      ...notes.map((n, i) => ({ id: i + 1, from: (n.from === "user" ? "me" : "agent") as ChatMessage["from"], body: n.body, at: new Date(n.at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }) }))]);
  }, []);
  const detail = stack[stack.length - 1];
  useEffect(() => {
    if (detail?.k !== "support") return;
    void loadChat();
    const t = setInterval(() => void loadChat(), 8000);
    return () => clearInterval(t);
  }, [detail?.k, loadChat]);

  const detailKey = detail ? detail.k + ("id" in detail ? detail.id : "") : tab;
  useEffect(() => { scrollRef.current?.scrollTo({ top: 0 }); }, [detailKey]);
  const push = (d: Detail) => setStack((s) => [...s, d]);
  const back = () => setStack((s) => s.slice(0, -1));
  const goTab = (t: Tab) => { setStack([]); setTab(t); if (t === "trips") void refreshTrips(); if (t === "earnings" || t === "incentives") void refreshMe(); };

  const logout = async () => { if (online) { try { await setOnline(false); } catch { /* ignore */ } } await signOut(); };

  const showNav = stage === "app" && !trip && !detail;

  return (
    <div style={{ position: "fixed", inset: 0, background: "var(--app-bg)", display: "flex", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: SHELL_MAX_W, height: "100%", position: "relative", background: "var(--app-bg)", overflow: "hidden", boxShadow: "var(--shadow-float)", display: "flex", flexDirection: "column" }}>

        {stage === "loading" && <LoadState error={bootErr} onRetry={() => void boot()} />}
        {stage === "splash" && (
          <SplashScreen tagline="Drive · Earn · Grow" cta="Start Riding" onStart={() => setStage("login")}
            footer={NATIVE_APP ? undefined : <p style={{ margin: "14px 0 0", textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.55)" }}><Link href="/" style={{ color: "var(--gold)" }}>Book a ride instead</Link></p>} />
        )}
        {stage === "login" && <EmailLogin title="Welcome, Rider" accent="Let's get you earning" onSignedIn={() => void boot()} onSignUp={() => setStage("signup")} />}
        {stage === "signup" && (
          <SignUp onLogin={() => setStage("login")} onSignedUp={(hasSession) => {
            if (hasSession) { void boot(); return; }
            setStage("login"); flash("Check your inbox to confirm your email, then log in.");
          }} />
        )}
        {stage === "kyc" && <KycFlow onSubmitted={() => void boot()} />}
        {stage === "pending" && me && (
          <PendingApproval name={me.name} kyc={me.kyc === "Rejected" ? "Rejected" : "Pending"} note={me.kyc_note} checking={checking}
            onRefresh={() => { setChecking(true); void boot().finally(() => setChecking(false)); }}
            onReapply={() => setStage("kyc")} onLogout={() => void logout()} />
        )}

        {stage === "app" && me && (detail?.k === "support" ? (
          <div style={{ flex: 1, minHeight: 0 }}>
            <ChatScreen title="Rider Support" subtitle="Agents reply here" messages={chat} typing={false} onBack={back}
              onSend={(b) => void supportMessage(b, "Driver", trip?.id ?? null).then(loadChat, (e) => flash((e as Error).message))}
              quick={["Payout issue", "Customer didn't show", "App problem", "Document update"]} />
          </div>
        ) : (
          <div ref={scrollRef} className="no-scroll" style={{ flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", paddingBottom: showNav ? "calc(76px + env(safe-area-inset-bottom))" : undefined }}>
            {trip ? (
              <TripPage trip={trip} busy={busy} err={err}
                onBack={() => flash("Finish or cancel this trip first")}
                onCall={() => { if (trip.customer?.phone) window.location.href = "tel:+" + trip.customer.phone.replace(/\D/g, ""); }}
                onNavigate={() => navigate(trip.status === "Started" ? `${trip.to.name}, ${trip.to.address}` : `${trip.from.name}, ${trip.from.address}`)}
                onCancel={() => { setErr(null); setSheet("cancel"); }}
                onSos={() => setSheet("sos")}
                onArrived={() => void act(() => driverArrived(trip.id), "Customer notified that you've arrived")}
                onStart={(otp) => void startTrip(otp)}
                onEnd={() => void act(() => completeRide(trip.id))}
                onCollected={() => void act(() => confirmCash(trip.id), "Cash collection recorded")}
                onRated={(n) => void finishTrip(n)} />
            ) : detail ? (
              <>
                {detail.k === "alerts" && <AlertsScreen txns={me.txns} onBack={back} />}
                {detail.k === "wallet" && <WalletPage me={me} busy={busy} err={err} onWithdraw={() => void withdraw()} onPayDues={() => void clearDues()} onBack={back} />}
                {detail.k === "performance" && <PerformancePage me={me} trips={trips ?? []} onBack={back} />}
                {detail.k === "documents" && <DocumentsPage me={me} onBack={back} />}
                {detail.k === "vehicle" && <VehiclePage me={me} onBack={back} />}
                {detail.k === "bank" && <BankPage upi={me.upi} onBack={back} onSave={async (u) => { await updateMyUpi(u); await refreshMe(); flash("UPI ID updated"); }} />}
                {detail.k === "preferences" && <PreferencesPage prefs={prefs} onBack={back} onChange={changePrefs} />}
                {detail.k === "trip" && (() => {
                  const r = trips?.find((x) => x.id === detail.id);
                  return r ? <TripDetailPage ride={r} onBack={back} onHelp={() => push({ k: "support" })} /> : <LoadState />;
                })()}
              </>
            ) : (
              <>
                {tab === "home" && (
                  <RiderHome me={me} online={online} toggling={toggling} toggleErr={toggleErr} unread={0}
                    onToggle={(v) => void toggleOnline(v)}
                    onOpenEarnings={() => goTab("earnings")} onAlerts={() => push({ k: "alerts" })}
                    onQuick={(k: QuickKey) => { if (k === "incentives") goTab("incentives"); else { if (k === "performance") void refreshTrips(); setErr(null); push({ k }); } }} />
                )}
                {tab === "earnings" && <EarningsScreen me={me} />}
                {tab === "trips" && <TripsScreen trips={trips} commissionPct={me.commission_pct} onOpen={(r) => push({ k: "trip", id: r.id })} />}
                {tab === "incentives" && <IncentivesScreen me={me} />}
                {tab === "account" && <RiderAccount me={me} onMenu={(k) => { if (k === "performance") void refreshTrips(); push(k === "help" ? { k: "support" } : { k }); }} onLogout={() => void logout()} />}
              </>
            )}
          </div>
        ))}

        {showNav && (
          <BottomNav<Tab> active={tab} onChange={goTab} items={[
            { id: "home", label: "Home", Icon: HomeGlyph },
            { id: "earnings", label: "Earnings", Icon: WalletGlyph },
            { id: "trips", label: "Trips", Icon: RidesGlyph },
            { id: "incentives", label: "Incentives", Icon: OffersGlyph },
            { id: "account", label: "Account", Icon: ProfileGlyph },
          ]} />
        )}

        {stage === "app" && offer && !trip && <RequestPopup key={offer.id} offer={offer} autoAccept={prefs.autoAccept} busy={busy} err={null} onAccept={() => void accept()} onDecline={decline} />}
        {sheet === "cancel" && trip && (
          <CancelTripSheet busy={busy} err={err} onClose={() => setSheet(null)}
            onConfirm={(reason) => void act(() => { selfCancelled.current = true; return driverCancelRide(trip.id, reason); }, "Ride cancelled — it's been offered to other drivers").then(() => setSheet(null))} />
        )}
        {sheet === "sos" && (
          <SosSheet onClose={() => setSheet(null)} onAction={(a) => {
            setSheet(null);
            if (a === "police") window.location.href = "tel:112";
            else if (a === "support") void supportMessage(`SOS during trip ${trip?.code ?? ""}`, "Driver", trip?.id ?? null).then(() => flash("Support has your SOS ticket — call 112 if you're in danger"), (e) => flash((e as Error).message));
            else if (trip && "share" in navigator) void navigator.share({ title: `DriveWay trip ${trip.code}`, text: `${trip.from.name} → ${trip.to.name} · ${me?.model} ${me?.plate}` }).catch(() => undefined);
            else flash("Sharing isn't available on this device");
          }} />
        )}
        <Toast msg={toast} bottom={showNav ? 90 : 96} />
      </div>
    </div>
  );
}
