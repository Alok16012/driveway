"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import BottomNav, { HomeGlyph, OffersGlyph, ProfileGlyph, RidesGlyph, WalletGlyph } from "../components/BottomNav";
import { OtpStep, PhoneLogin, SplashScreen } from "../components/Auth";
import { KycFlow, PendingApproval } from "../components/rider/Kyc";
import {
  AlertsScreen, COMMISSION, EarningsScreen, RIDER_ALERTS, RequestPopup, RiderAccount, RiderHome, TripPage, TripsScreen,
  type AccountKey, type QuickKey, type RideRequest, type RiderAlert, type TripPhase,
} from "../components/rider/RiderScreens";
import {
  BankPage, CancelTripSheet, DocumentsPage, HotspotsPage, IncentivesScreen, PerformancePage, PreferencesPage, ReferPage,
  SosSheet, TripDetailPage, VehiclePage, WalletPage, type RiderPrefs,
} from "../components/rider/RiderPages";
import { ChatScreen, type ChatMessage } from "../components/customer/AccountScreens";
import { DemoButton, Toast } from "../components/ui";
import { DRIVERS, INCENTIVES, RIDER_WALLET, RIDES, inr, nowTime, type Driver, type Ride, type WalletTxn } from "../lib/data";

const SHELL_MAX_W = 430;
const AUTH_KEY = "driveway:rider";

type Tab = "home" | "earnings" | "trips" | "incentives" | "account";
type Stage = "splash" | "phone" | "otp" | "kyc" | "pending" | "app";
type Detail =
  | { k: "alerts" } | { k: "support" } | { k: "trip"; id: string }
  | { k: "wallet" } | { k: "performance" } | { k: "hotspots" }
  | { k: Exclude<AccountKey, "help" | "performance"> };

const REQUESTS: Omit<RideRequest, "id">[] = [
  { customer: "Amit Sharma", initials: "AS", rating: 4.9, from: "Sector 12, Noida", to: "DLF Mall of India", pickupKm: 1.2, pickupMin: 3, km: 4.2, min: 16, fare: 160, pay: "UPI" },
  { customer: "Priya Mehta", initials: "PM", rating: 4.7, from: "Botanical Garden Metro", to: "Sector 62, Noida", pickupKm: 0.8, pickupMin: 2, km: 6.8, min: 22, fare: 182, pay: "Cash" },
  { customer: "Kavya Iyer", initials: "KI", rating: 5.0, from: "Great India Place", to: "Akshardham Temple", pickupKm: 1.6, pickupMin: 4, km: 9.1, min: 28, fare: 246, pay: "UPI" },
];

const readRider = () => { try { return localStorage.getItem(AUTH_KEY) === "1"; } catch { return false; } };
const writeRider = (v: boolean) => { try { if (v) localStorage.setItem(AUTH_KEY, "1"); else localStorage.removeItem(AUTH_KEY); } catch { /* storage blocked */ } };

let seq = 1300;
let txSeq = 400;
const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

export default function RiderApp() {
  const [stage, setStage] = useState<Stage>("splash");
  const [phone, setPhone] = useState("");
  const [rider, setRider] = useState<Driver>(DRIVERS[0]);
  const [tab, setTab] = useState<Tab>("home");
  const [stack, setStack] = useState<Detail[]>([]);
  const [online, setOnline] = useState(false);
  const [request, setRequest] = useState<RideRequest | null>(null);
  const [trip, setTrip] = useState<{ req: RideRequest; phase: TripPhase; progress: number } | null>(null);
  const [sheet, setSheet] = useState<"cancel" | "sos" | null>(null);
  const [today, setToday] = useState({ earnings: 1240, trips: 3, minutes: 5 * 60 + 40 });
  const [week, setWeek] = useState(52);
  const [peak, setPeak] = useState(1);
  const [stats, setStats] = useState({ accepted: 48, declined: 2, cancelled: 1 });
  const [wallet, setWallet] = useState({ balance: 1840, dues: 36 });
  const [txns, setTxns] = useState<WalletTxn[]>(RIDER_WALLET);
  const [prefs, setPrefs] = useState<RiderPrefs>({ autoAccept: false, goHome: null, cash: true, sound: true, nav: "Google Maps" });
  const [trips, setTrips] = useState<Ride[]>(RIDES.filter((r) => r.driver === DRIVERS[0].name));
  const [alerts, setAlerts] = useState<RiderAlert[]>(RIDER_ALERTS);
  const [unread, setUnread] = useState(2);
  const [chat, setChat] = useState<ChatMessage[]>([{ id: 1, from: "agent", body: "Hi! 👋 How can the rider support team help?", at: "09:00 AM" }]);
  const [typing, setTyping] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const scrollRef = useRef<HTMLDivElement>(null);
  const reqIdx = useRef(0);

  useEffect(() => {
    if (!readRider()) return;
    const t = setTimeout(() => setStage("app"), 1100);
    return () => clearTimeout(t);
  }, []);

  const detail = stack[stack.length - 1];
  const detailKey = detail ? JSON.stringify(detail) : tab;
  useEffect(() => { scrollRef.current?.scrollTo({ top: 0 }); }, [detailKey]);

  const push = (d: Detail) => setStack((s) => [...s, d]);
  const back = () => setStack((s) => s.slice(0, -1));
  const goTab = (t: Tab) => { setStack([]); setTab(t); };

  const flash = useCallback((msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }, []);

  const addTxn = (kind: WalletTxn["kind"], note: string, amount: number) =>
    setTxns((t) => [{ id: `WT${++txSeq}`, kind, note, amount, at: `Today, ${nowTime()}` }, ...t]);

  // Online & idle → a request arrives a few seconds later (stands in for the dispatch socket).
  // With "Accept cash rides" off, dispatch only sends online-paid rides.
  const sendRequest = useCallback(() => {
    let r = REQUESTS[reqIdx.current++ % REQUESTS.length];
    if (!prefs.cash && r.pay === "Cash") r = REQUESTS[reqIdx.current++ % REQUESTS.length];
    setRequest({ ...r, id: `RD${++seq}` });
  }, [prefs.cash]);
  useEffect(() => {
    if (!online || request || trip || stage !== "app") return;
    const t = setTimeout(sendRequest, 4500);
    return () => clearTimeout(t);
  }, [online, request, trip, stage, sendRequest]);

  // Online-time ticker.
  useEffect(() => {
    if (!online) return;
    const t = setInterval(() => setToday((d) => ({ ...d, minutes: d.minutes + 1 })), 60000);
    return () => clearInterval(t);
  }, [online]);

  // Vehicle moves along the route while heading to pickup / on trip.
  const phase = trip?.phase;
  useEffect(() => {
    if (phase !== "toPickup" && phase !== "onTrip") return;
    const step = phase === "toPickup" ? 0.05 : 0.03;
    const t = setInterval(() => setTrip((x) => (x && x.phase === phase ? { ...x, progress: Math.min(1, x.progress + step) } : x)), 450);
    return () => clearInterval(t);
  }, [phase]);

  const decline = useCallback((expired: boolean) => {
    setRequest(null);
    setStats((s) => ({ ...s, declined: s.declined + 1 }));
    flash(expired ? "Request expired — counted as missed" : "Request declined");
  }, [flash]);

  const accept = useCallback(() => {
    if (!request) return;
    setTrip({ req: request, phase: "toPickup", progress: 0 });
    setRequest(null);
    setStack([]);
    setStats((s) => ({ ...s, accepted: s.accepted + 1 }));
    setAlerts((a) => [["Ride Accepted", `${request.from} → ${request.to} · ${inr(request.fare)}`, "just now", "ride"], ...a]);
  }, [request]);

  const cancelTrip = (reason: string) => {
    if (!trip) return;
    const { req } = trip;
    setTrips((t) => [{
      id: req.id, customer: req.customer, driver: rider.name, vehicle: rider.vehicle, from: req.from, to: req.to, km: req.km, min: req.min,
      fare: req.fare, discount: 0, pay: req.pay, paid: false, status: "Cancelled", date: "Today", time: nowTime(), cancelReason: reason,
    }, ...t]);
    setStats((s) => ({ ...s, cancelled: s.cancelled + 1 }));
    setTrip(null);
    setSheet(null);
    setTab("home");
    flash("Ride cancelled");
  };

  const finish = (stars: number) => {
    if (!trip) return;
    const { req } = trip;
    const total = req.fare + (req.waitFee ?? 0);
    const net = Math.round(total * (1 - COMMISSION));
    const cut = Math.round(total * COMMISSION);
    const count = today.trips + 1;
    const daily = INCENTIVES[0];

    setToday((d) => ({ ...d, earnings: d.earnings + net, trips: count }));
    setWeek((w) => w + 1);
    if (new Date().getHours() >= 18 && new Date().getHours() < 21) setPeak((p) => p + 1);

    if (req.pay === "Cash") {
      setWallet((w) => ({ ...w, dues: w.dues + cut }));
      addTxn("Cash Commission", `Ride ${req.id} · ${COMMISSION * 100}% of ${inr(total)}`, -cut);
    } else {
      setWallet((w) => ({ ...w, balance: w.balance + net }));
      addTxn("Trip Earning", `Ride ${req.id} · ${req.pay}`, net);
    }
    if (count === daily.target) {
      setWallet((w) => ({ ...w, balance: w.balance + daily.reward }));
      addTxn("Incentive", `${daily.title} bonus`, daily.reward);
      setAlerts((a) => [["Bonus Unlocked 🎉", `${inr(daily.reward)} ${daily.title} bonus added to wallet`, "just now", "bonus"], ...a]);
      setUnread((u) => u + 1);
    }

    setTrips((t) => [{
      id: req.id, customer: req.customer, driver: rider.name, vehicle: rider.vehicle, from: req.from, to: req.to, km: req.km, min: req.min,
      fare: total, discount: 0, pay: req.pay, paid: true, status: "Completed", date: "Today", time: nowTime(), rating: stars || undefined,
    }, ...t]);
    setAlerts((a) => [["Trip Completed", req.pay === "Cash" ? `${inr(total)} collected in cash` : `${inr(net)} credited to your wallet`, "just now", "pay"], ...a]);
    setTrip(null);
    setTab("home");
    flash(count === daily.target ? `+${inr(net)} and ${inr(daily.reward)} bonus unlocked! 🎉` : `+${inr(net)} added to today's earnings`);
  };

  const withdraw = () => {
    const payable = wallet.balance - wallet.dues;
    if (wallet.dues > 0) addTxn("Dues Paid", "Adjusted from wallet", -wallet.dues);
    addTxn("Payout", "Instant payout · HDFC ••4521 (₹5 fee)", -payable);
    setWallet({ balance: 0, dues: 0 });
    flash(`${inr(payable - 5)} is on its way to your bank`);
  };

  const payDues = () => {
    addTxn("Dues Paid", "Paid via UPI", -wallet.dues);
    setWallet((w) => ({ ...w, dues: 0 }));
    flash("Cash dues cleared — thank you!");
  };

  const navigate = (to: string) => {
    if (prefs.nav === "Google Maps") window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(to)}`, "_blank", "noopener");
    else flash(`In-app navigation to ${to}`);
  };

  const sendChat = (body: string) => {
    setChat((c) => [...c, { id: Date.now(), from: "me", body, at: nowTime() }]);
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      setChat((c) => [...c, { id: Date.now() + 1, from: "agent", body: /payout|payment|money|wallet/i.test(body) ? "Weekly payouts settle every Monday to your linked bank account. You can also take an instant payout from your Wallet." : "Thanks! A rider support agent will call you back within 10 minutes.", at: nowTime() }]);
    }, 1300);
  };

  const toggleOnline = (v: boolean) => {
    setOnline(v);
    if (!v) setRequest(null);
    flash(v ? "You're online — looking for rides" : "You're offline");
  };

  const openQuick = (k: QuickKey) => {
    if (k === "incentives") goTab("incentives");
    else push({ k });
  };

  const openAccount = (k: AccountKey) => push(k === "help" ? { k: "support" } : { k });

  const logout = () => { writeRider(false); setOnline(false); setTrip(null); setStack([]); setTab("home"); setStage("splash"); };

  const showNav = stage === "app" && !trip && !detail;
  const acceptance = pct(stats.accepted, stats.accepted + stats.declined);
  const cancellation = pct(stats.cancelled, stats.accepted);

  return (
    <div style={{ position: "fixed", inset: 0, background: "var(--app-bg)", display: "flex", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: SHELL_MAX_W, height: "100%", position: "relative", background: "var(--app-bg)", overflow: "hidden", boxShadow: "var(--shadow-float)", display: "flex", flexDirection: "column" }}>

        {stage === "splash" && (
          <SplashScreen tagline="Drive · Earn · Grow" cta="Start Riding" onStart={() => setStage(readRider() ? "app" : "phone")}
            footer={<p style={{ margin: "14px 0 0", textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.55)" }}>Demo: <Link href="/customer" style={{ color: "var(--gold)" }}>Customer app</Link> · <Link href="/admin" style={{ color: "var(--gold)" }}>Admin panel</Link></p>} />
        )}
        {stage === "phone" && <PhoneLogin title="Welcome, Rider" accent="Let's get you earning" social={false} onSent={(p) => { setPhone(p); setStage("otp"); }} />}
        {stage === "otp" && (
          <OtpStep phone={phone} onBack={() => setStage("phone")} onVerified={() => setStage("kyc")} />
        )}
        {stage === "kyc" && (
          <>
            <KycFlow onSubmit={(k) => {
              setRider({ ...DRIVERS[0], name: k.name, initials: k.name.split(/\s+/).map((s) => s[0]).join("").slice(0, 2).toUpperCase(), vehicle: k.vehicle, model: k.model, plate: k.plate, city: k.city, phone: `+91 ${phone.slice(0, 5)} ${phone.slice(5)}`, trips: 0, rating: 0 });
              setStage("pending");
            }} />
            <div style={{ position: "absolute", top: 20, right: 16, zIndex: 195 }}>
              <DemoButton onClick={() => { writeRider(true); setStage("app"); }}>skip KYC</DemoButton>
            </div>
          </>
        )}
        {stage === "pending" && <PendingApproval name={rider.name} onApproved={() => { writeRider(true); setStage("app"); flash("You're approved! Go online to start earning 🎉"); }} />}

        {stage === "app" && (detail?.k === "support" ? (
          <div style={{ flex: 1, minHeight: 0 }}>
            <ChatScreen title="Rider Support" messages={chat} typing={typing} onSend={sendChat} onBack={back} quick={["Payout issue", "Customer didn't show", "App problem", "Document update"]} />
          </div>
        ) : (
          <div ref={scrollRef} className="no-scroll" style={{ flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", paddingBottom: showNav ? "calc(76px + env(safe-area-inset-bottom))" : undefined }}>
            {trip ? (
              <TripPage req={trip.req} phase={trip.phase} progress={trip.progress}
                onBack={() => flash("Finish or cancel this trip first")}
                onCall={() => { window.location.href = "tel:+919876543210"; }}
                onNavigate={() => navigate(trip.phase === "onTrip" ? trip.req.to : trip.req.from)}
                onCancel={() => setSheet("cancel")}
                onSos={() => setSheet("sos")}
                onArrived={() => { setTrip({ ...trip, phase: "arrived", progress: 1 }); flash("Customer notified that you've arrived"); }}
                onStart={(waitFee) => setTrip({ ...trip, req: { ...trip.req, waitFee }, phase: "onTrip", progress: 0 })}
                onEnd={() => setTrip({ ...trip, phase: "collect", progress: 1 })}
                onCollected={() => setTrip({ ...trip, phase: "rate" })}
                onRated={finish} />
            ) : detail ? (
              <>
                {detail.k === "alerts" && <AlertsScreen items={alerts} onBack={back} />}
                {detail.k === "wallet" && <WalletPage balance={wallet.balance} dues={wallet.dues} txns={txns} onWithdraw={withdraw} onPayDues={payDues} onBack={back} />}
                {detail.k === "performance" && <PerformancePage rider={rider} stats={{ ...stats, acceptance, cancellation }} onBack={back} />}
                {detail.k === "hotspots" && <HotspotsPage online={online} onNavigate={navigate} onGoOnline={() => toggleOnline(true)} onBack={back} />}
                {detail.k === "documents" && <DocumentsPage onBack={back} onUploaded={(d) => flash(`${d} uploaded — we'll verify it within 24 hours`)} />}
                {detail.k === "vehicle" && <VehiclePage rider={rider} onBack={back} />}
                {detail.k === "bank" && <BankPage onBack={back} onSaved={() => flash("UPI ID updated")} />}
                {detail.k === "preferences" && (
                  <PreferencesPage prefs={prefs} onBack={back} onChange={(p) => {
                    setPrefs((x) => ({ ...x, ...p }));
                    if ("goHome" in p) flash(p.goHome ? "Go Home on — only rides towards home" : "Go Home off");
                  }} />
                )}
                {detail.k === "refer" && <ReferPage code={`RIDE${rider.initials}${rider.id.slice(-3)}`} onBack={back} onShare={() => flash("Invite link copied — share it on WhatsApp")} />}
                {detail.k === "trip" && (() => {
                  const r = trips.find((x) => x.id === detail.id);
                  return r ? <TripDetailPage ride={r} onBack={back} onHelp={() => push({ k: "support" })} /> : null;
                })()}
              </>
            ) : (
              <>
                {tab === "home" && (
                  <>
                    <RiderHome rider={rider} online={online} today={today} unread={unread} wallet={wallet.balance} goHome={prefs.goHome}
                      onToggle={toggleOnline}
                      onOpenEarnings={() => goTab("earnings")} onAlerts={() => { setUnread(0); push({ k: "alerts" }); }}
                      onQuick={openQuick} onClearGoHome={() => { setPrefs((p) => ({ ...p, goHome: null })); flash("Go Home off"); }} />
                    {online && !request && <div style={{ textAlign: "center", marginTop: -8, paddingBottom: 16 }}><DemoButton onClick={sendRequest}>send a ride request now</DemoButton></div>}
                  </>
                )}
                {tab === "earnings" && <EarningsScreen today={today} />}
                {tab === "trips" && <TripsScreen trips={trips} onOpen={(r) => push({ k: "trip", id: r.id })} />}
                {tab === "incentives" && <IncentivesScreen progress={{ today: today.trips, week, peak }} />}
                {tab === "account" && <RiderAccount rider={rider} stats={{ acceptance, cancellation }} onMenu={openAccount} onLogout={logout} />}
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

        {request && !trip && <RequestPopup key={request.id} req={request} autoAccept={prefs.autoAccept} towardsHome={!!prefs.goHome} onAccept={accept} onDecline={decline} />}
        {sheet === "cancel" && <CancelTripSheet onClose={() => setSheet(null)} onConfirm={cancelTrip} />}
        {sheet === "sos" && (
          <SosSheet onClose={() => setSheet(null)} onAction={(a) => {
            setSheet(null);
            if (a === "police") window.location.href = "tel:112";
            else flash(a === "safety" ? "Safety team alerted — they'll call you now" : "Live location shared with your emergency contacts");
          }} />
        )}
        <Toast msg={toast} bottom={showNav ? 90 : 96} />
      </div>
    </div>
  );
}
