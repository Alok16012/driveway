"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import BottomNav, { BellGlyph, HomeGlyph, ProfileGlyph, RidesGlyph, WalletGlyph } from "../components/BottomNav";
import { OtpStep, PhoneLogin, SplashScreen } from "../components/Auth";
import { KycFlow, PendingApproval } from "../components/driver/Kyc";
import {
  AlertsScreen, DRIVER_ALERTS, DriverHome, DriverProfile, EarningsScreen, RequestPopup, TripPage, TripsScreen,
  type RideRequest, type TripPhase,
} from "../components/driver/DriverScreens";
import { ChatScreen, type ChatMessage } from "../components/customer/AccountScreens";
import { DemoButton, Toast } from "../components/ui";
import { DRIVERS, RIDES, nowTime, type Driver, type Ride } from "../lib/data";

const SHELL_MAX_W = 430;
const AUTH_KEY = "driveway:driver";

type Tab = "home" | "earnings" | "trips" | "alerts" | "profile";
type Stage = "splash" | "phone" | "otp" | "kyc" | "pending" | "app";

const REQUESTS: Omit<RideRequest, "id">[] = [
  { customer: "Amit Sharma", initials: "AS", rating: 4.9, from: "Sector 12, Noida", to: "DLF Mall of India", pickupKm: 1.2, pickupMin: 3, km: 4.2, min: 16, fare: 160, pay: "UPI" },
  { customer: "Priya Mehta", initials: "PM", rating: 4.7, from: "Botanical Garden Metro", to: "Sector 62, Noida", pickupKm: 0.8, pickupMin: 2, km: 6.8, min: 22, fare: 182, pay: "Cash" },
  { customer: "Kavya Iyer", initials: "KI", rating: 5.0, from: "Great India Place", to: "Akshardham Temple", pickupKm: 1.6, pickupMin: 4, km: 9.1, min: 28, fare: 246, pay: "UPI" },
];

const readDriver = () => { try { return localStorage.getItem(AUTH_KEY) === "1"; } catch { return false; } };
const writeDriver = (v: boolean) => { try { if (v) localStorage.setItem(AUTH_KEY, "1"); else localStorage.removeItem(AUTH_KEY); } catch { /* storage blocked */ } };

let seq = 1300;

export default function DriverApp() {
  const [stage, setStage] = useState<Stage>("splash");
  const [phone, setPhone] = useState("");
  const [driver, setDriver] = useState<Driver>(DRIVERS[0]);
  const [tab, setTab] = useState<Tab>("home");
  const [online, setOnline] = useState(false);
  const [request, setRequest] = useState<RideRequest | null>(null);
  const [trip, setTrip] = useState<{ req: RideRequest; phase: TripPhase; progress: number } | null>(null);
  const [today, setToday] = useState({ earnings: 1240, trips: 3, minutes: 5 * 60 + 40 });
  const [trips, setTrips] = useState<Ride[]>(RIDES.filter((r) => r.driver === DRIVERS[0].name));
  const [alerts, setAlerts] = useState(DRIVER_ALERTS);
  const [unread, setUnread] = useState(2);
  const [support, setSupport] = useState(false);
  const [chat, setChat] = useState<ChatMessage[]>([{ id: 1, from: "agent", body: "Hi Captain! 👋 How can the driver support team help?", at: "09:00 AM" }]);
  const [typing, setTyping] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const reqIdx = useRef(0);

  useEffect(() => {
    if (!readDriver()) return;
    const t = setTimeout(() => setStage("app"), 1100);
    return () => clearTimeout(t);
  }, []);

  const flash = (msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  };

  // Online & idle → a request arrives a few seconds later (stands in for the dispatch socket).
  const sendRequest = useCallback(() => {
    const r = REQUESTS[reqIdx.current++ % REQUESTS.length];
    setRequest({ ...r, id: `RD${++seq}` });
  }, []);
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

  // Car moves along the route while driving to pickup / on trip.
  const phase = trip?.phase;
  useEffect(() => {
    if (phase !== "toPickup" && phase !== "onTrip") return;
    const step = phase === "toPickup" ? 0.05 : 0.03;
    const t = setInterval(() => setTrip((x) => (x && x.phase === phase ? { ...x, progress: Math.min(1, x.progress + step) } : x)), 450);
    return () => clearInterval(t);
  }, [phase]);

  const decline = useCallback((expired: boolean) => {
    setRequest(null);
    flash(expired ? "Request expired" : "Request declined");
  }, []);

  const accept = () => {
    if (!request) return;
    setTrip({ req: request, phase: "toPickup", progress: 0 });
    setRequest(null);
    setAlerts((a) => [["New Ride Request", `${request.from} → ${request.to} · ₹${request.fare}`, "just now", "ride"], ...a]);
  };

  const finish = (stars: number) => {
    if (!trip) return;
    const { req } = trip;
    const net = Math.round(req.fare * 0.8);
    setToday((d) => ({ ...d, earnings: d.earnings + net, trips: d.trips + 1 }));
    setTrips((t) => [{
      id: req.id, customer: req.customer, driver: driver.name, vehicle: driver.vehicle, from: req.from, to: req.to, km: req.km, min: req.min,
      fare: req.fare, discount: 0, pay: req.pay, paid: true, status: "Completed", date: "Today", time: nowTime(), rating: stars || undefined,
    }, ...t]);
    setAlerts((a) => [["Trip Completed", `₹${net} credited to your wallet`, "just now", "pay"], ...a]);
    setTrip(null);
    setTab("home");
    flash(`+₹${net} added to today's earnings`);
  };

  const sendChat = (body: string) => {
    setChat((c) => [...c, { id: Date.now(), from: "me", body, at: nowTime() }]);
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      setChat((c) => [...c, { id: Date.now() + 1, from: "agent", body: /payout|payment|money/i.test(body) ? "Payouts settle every Monday to your linked bank account. I can see this week's is scheduled." : "Thanks! A support agent will call you back within 10 minutes.", at: nowTime() }]);
    }, 1300);
  };

  const logout = () => { writeDriver(false); setOnline(false); setTrip(null); setTab("home"); setStage("splash"); };

  const showNav = stage === "app" && !trip && !support;

  return (
    <div style={{ position: "fixed", inset: 0, background: "var(--app-bg)", display: "flex", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: SHELL_MAX_W, height: "100%", position: "relative", background: "var(--app-bg)", overflow: "hidden", boxShadow: "var(--shadow-float)", display: "flex", flexDirection: "column" }}>

        {stage === "splash" && (
          <SplashScreen tagline="Drive · Earn · Grow" cta="Start Driving" onStart={() => setStage(readDriver() ? "app" : "phone")}
            footer={<p style={{ margin: "14px 0 0", textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.55)" }}>Demo: <Link href="/" style={{ color: "var(--gold)" }}>Customer app</Link> · <Link href="/admin" style={{ color: "var(--gold)" }}>Admin panel</Link></p>} />
        )}
        {stage === "phone" && <PhoneLogin title="Welcome, Driver" accent="Let's get you earning" social={false} onSent={(p) => { setPhone(p); setStage("otp"); }} />}
        {stage === "otp" && (
          <OtpStep phone={phone} onBack={() => setStage("phone")} onVerified={() => setStage("kyc")} />
        )}
        {stage === "kyc" && (
          <>
            <KycFlow onSubmit={(k) => {
              setDriver({ ...DRIVERS[0], name: k.name, initials: k.name.split(/\s+/).map((s) => s[0]).join("").slice(0, 2).toUpperCase(), vehicle: k.vehicle, model: k.model, plate: k.plate, city: k.city, phone: `+91 ${phone.slice(0, 5)} ${phone.slice(5)}`, trips: 0, rating: 0 });
              setStage("pending");
            }} />
            <div style={{ position: "absolute", top: 20, right: 16, zIndex: 195 }}>
              <DemoButton onClick={() => { writeDriver(true); setStage("app"); }}>skip KYC</DemoButton>
            </div>
          </>
        )}
        {stage === "pending" && <PendingApproval name={driver.name} onApproved={() => { writeDriver(true); setStage("app"); flash("You're approved! Go online to start earning 🎉"); }} />}

        {stage === "app" && (support ? (
          <div style={{ flex: 1, minHeight: 0 }}>
            <ChatScreen title="Driver Support" messages={chat} typing={typing} onSend={sendChat} onBack={() => setSupport(false)} quick={["Payout issue", "Rider didn't show", "App problem", "Document update"]} />
          </div>
        ) : (
          <div className="no-scroll" style={{ flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", paddingBottom: showNav ? "calc(76px + env(safe-area-inset-bottom))" : undefined }}>
            {trip ? (
              <TripPage req={trip.req} phase={trip.phase} progress={trip.progress}
                onBack={() => flash("Finish this trip first")}
                onCall={() => { window.location.href = "tel:+919876543210"; }}
                onArrived={() => { setTrip({ ...trip, phase: "arrived", progress: 1 }); flash("Rider notified that you've arrived"); }}
                onStart={() => setTrip({ ...trip, phase: "onTrip", progress: 0 })}
                onEnd={() => setTrip({ ...trip, phase: "collect", progress: 1 })}
                onCollected={() => setTrip({ ...trip, phase: "rate" })}
                onRated={finish} />
            ) : (
              <>
                {tab === "home" && (
                  <>
                    <DriverHome driver={driver} online={online} today={today} unread={unread}
                      onToggle={(v) => { setOnline(v); if (!v) setRequest(null); flash(v ? "You're online — looking for rides" : "You're offline"); }}
                      onOpenEarnings={() => setTab("earnings")} onAlerts={() => { setUnread(0); setTab("alerts"); }} />
                    {online && !request && <div style={{ textAlign: "center", marginTop: -8, paddingBottom: 16 }}><DemoButton onClick={sendRequest}>send a ride request now</DemoButton></div>}
                  </>
                )}
                {tab === "earnings" && <EarningsScreen today={today} />}
                {tab === "trips" && <TripsScreen trips={trips} />}
                {tab === "alerts" && <AlertsScreen items={alerts} />}
                {tab === "profile" && <DriverProfile driver={driver} onLogout={logout} onHelp={() => setSupport(true)} />}
              </>
            )}
          </div>
        ))}

        {showNav && (
          <BottomNav<Tab> active={tab} onChange={(t) => { setTab(t); if (t === "alerts") setUnread(0); }} items={[
            { id: "home", label: "Home", Icon: HomeGlyph },
            { id: "earnings", label: "Earnings", Icon: WalletGlyph },
            { id: "trips", label: "Trips", Icon: RidesGlyph },
            { id: "alerts", label: "Alerts", Icon: BellGlyph, badge: unread },
            { id: "profile", label: "Profile", Icon: ProfileGlyph },
          ]} />
        )}

        {request && !trip && <RequestPopup key={request.id} req={request} onAccept={accept} onDecline={decline} />}
        <Toast msg={toast} bottom={showNav ? 90 : 96} />
      </div>
    </div>
  );
}
