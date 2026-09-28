"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import BottomNav, { ChatGlyph, HomeGlyph, OffersGlyph, ProfileGlyph, RidesGlyph } from "./components/BottomNav";
import { OtpStep, PermissionStep, PhoneLogin, ProfileSetup, SplashScreen } from "./components/Auth";
import HomeScreen from "./components/customer/HomeScreen";
import { ChooseRidePage, ConfirmPage, LiveRidePage, SearchPage, TripDonePage } from "./components/customer/BookingScreens";
import {
  ChatScreen, InfoPage, OffersScreen, ProfileScreen, RideDetailPage, RidesScreen,
  type ChatMessage, type ProfileKey,
} from "./components/customer/AccountScreens";
import type { ActiveRide, Booking } from "./components/customer/types";
import { Toast, card } from "./components/ui";
import { BriefcaseIcon, CardIcon, HomeIcon, UpiIcon, WalletIcon } from "./components/icons";
import {
  COUPONS, DRIVERS, MY_RIDES, PLACES, USER, discountFor, inr, nowTime,
  type Place, type Ride, type VehicleKind,
} from "./lib/data";

const SHELL_MAX_W = 430;
const AUTH_KEY = "driveway:rider";

type Tab = "home" | "rides" | "offers" | "support" | "profile";
type Stage = "splash" | "phone" | "otp" | "setup" | "perm" | "app";

type Detail =
  | { k: "search"; to?: Place; prefer?: VehicleKind }
  | { k: "choose" }
  | { k: "confirm" }
  | { k: "live" }
  | { k: "done" }
  | { k: "ride"; id: string }
  | { k: "rides" }
  | { k: "chat" }
  | { k: "info"; key: ProfileKey | "notifications" };

type Rider = typeof USER;

const readRider = (): Rider | null => { try { const r = localStorage.getItem(AUTH_KEY); return r ? JSON.parse(r) : null; } catch { return null; } };
const writeRider = (r: Rider | null) => { try { if (r) localStorage.setItem(AUTH_KEY, JSON.stringify(r)); else localStorage.removeItem(AUTH_KEY); } catch { /* storage blocked */ } };

let seq = 1290;
const initialsOf = (n: string) => n.split(/\s+/).map((s) => s[0]).join("").slice(0, 2).toUpperCase();

/** Canned support replies until the real support backend is wired up. */
function autoReply(body: string) {
  const t = body.toLowerCase();
  if (/pay|charg|refund/.test(t)) return "Sorry about that! Share the ride ID (e.g. RD1289) and I'll check the payment right away.";
  if (/lost|left|item/.test(t)) return "I've alerted the driver. We'll call you as soon as they confirm the item is in the vehicle.";
  if (/driver|rude|behav/.test(t)) return "Thanks for telling us. Your safety matters — I've raised a priority complaint for our trust team.";
  if (/fare|price|high|expensive/.test(t)) return "Fares depend on distance, time and demand. I can review the route for you — which ride was it?";
  return "Thanks! A DriveWay support agent will get back to you shortly.";
}

export default function CustomerApp() {
  const [stage, setStage] = useState<Stage>("splash");
  const [phone, setPhone] = useState("");
  const [user, setUser] = useState<Rider>(USER);
  const [tab, setTab] = useState<Tab>("home");
  const [stack, setStack] = useState<Detail[]>([]);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [active, setActive] = useState<ActiveRide | null>(null);
  const [rides, setRides] = useState<Ride[]>(MY_RIDES);
  const [chat, setChat] = useState<ChatMessage[]>([
    { id: 1, from: "agent", body: "Hi! 👋 Welcome to DriveWay support. How can we help you today?", at: "10:02 AM" },
  ]);
  const [typing, setTyping] = useState(false);
  const [unread, setUnread] = useState(2);
  const [pendingCoupon, setPendingCoupon] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Returning riders skip login.
  useEffect(() => {
    const r = readRider();
    if (!r) return;
    const t = setTimeout(() => { setUser(r); setStage("app"); }, 1100);
    return () => clearTimeout(t);
  }, []);

  const detail = stack[stack.length - 1];
  const detailKey = detail ? JSON.stringify(detail) : tab;
  useEffect(() => { scrollRef.current?.scrollTo({ top: 0 }); }, [detailKey]);

  const push = (d: Detail) => setStack((s) => [...s, d]);
  const back = () => setStack((s) => s.slice(0, -1));
  const goTab = (t: Tab) => { setStack([]); setTab(t); };
  const flash = (msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  };

  /* ── Ride lifecycle simulation (stands in for the realtime socket from PRD §10) ── */
  const advance = (r: ActiveRide): ActiveRide => {
    switch (r.status) {
      case "Searching": {
        const d = DRIVERS.find((x) => x.vehicle === r.vehicle && x.kyc === "Approved" && !x.suspended) ?? DRIVERS[0];
        return { ...r, status: "Assigned", driver: d, progress: 0 };
      }
      case "Assigned": return { ...r, status: "Arriving", progress: 0 };
      case "Arriving": return { ...r, status: "Arrived", progress: 1 };
      case "Arrived": return { ...r, status: "Started", progress: 0 };
      case "Started": return { ...r, status: "Completed", progress: 1 };
      default: return r;
    }
  };

  const status = active?.status;
  useEffect(() => {
    if (!status) return;
    const msg: Record<string, string> = {
      Assigned: "Driver assigned! 🎉", Arriving: "Your driver is on the way", Arrived: "Your driver has arrived — share the OTP",
      Started: "Trip started. Have a safe ride!", Completed: "You've reached your destination",
    };
    if (msg[status]) flash(msg[status]);
    if (status === "Completed") { setStack([{ k: "done" }]); return; }

    const moving = status === "Arriving" || status === "Started";
    if (moving) {
      const step = status === "Arriving" ? 0.045 : 0.03;
      const t = setInterval(() => {
        setActive((r) => {
          if (!r || r.status !== status) return r;
          const p = r.progress + step;
          return p >= 1 ? advance(r) : { ...r, progress: p };
        });
      }, 450);
      return () => clearInterval(t);
    }
    const wait = { Searching: 3500, Assigned: 1800, Arrived: 5000 }[status as "Searching" | "Assigned" | "Arrived"];
    if (!wait) return;
    const t = setTimeout(() => setActive((r) => (r && r.status === status ? advance(r) : r)), wait);
    return () => clearTimeout(t);
  }, [status]);

  const startBooking = (to?: Place, prefer?: VehicleKind) => {
    if (active) { push({ k: "live" }); flash("You already have a ride in progress"); return; }
    push({ k: "search", to, prefer });
  };

  const confirmRide = (b: Booking) => {
    const ride: ActiveRide = {
      ...b, id: `RD${++seq}`, status: "Searching", progress: 0, driver: DRIVERS[0],
      otp: String(1000 + Math.floor(Math.random() * 9000)), eta: 5,
    };
    setActive(ride);
    setPendingCoupon(null);
    setStack([{ k: "live" }]);
  };

  const record = (r: ActiveRide, extra: Partial<Ride>): Ride => ({
    id: r.id, customer: user.name, driver: r.driver.name, vehicle: r.vehicle, from: r.from.name, to: r.to.name,
    km: r.km, min: r.min, fare: r.fare, discount: discountFor(r.coupon, r.fare), pay: r.pay, paid: true,
    status: "Completed", date: "Today", time: nowTime(), ...extra,
  });

  const cancelRide = (reason: string) => {
    if (!active) return;
    setRides((x) => [record(active, { status: "Cancelled", cancelReason: reason, paid: false }), ...x]);
    setActive(null);
    goTab("home");
    flash("Ride cancelled");
  };

  const finishRide = (stars: number) => {
    if (!active) return;
    setRides((x) => [record(active, { rating: stars || undefined }), ...x]);
    setActive(null);
    goTab("home");
    flash(stars ? "Thanks for rating your driver!" : "Thanks for riding with DriveWay");
  };

  const sendChat = (body: string) => {
    setChat((c) => [...c, { id: Date.now(), from: "me", body, at: nowTime() }]);
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      setChat((c) => [...c, { id: Date.now() + 1, from: "agent", body: autoReply(body), at: nowTime() }]);
    }, 1400);
  };

  const logout = () => { writeRider(null); setStack([]); setTab("home"); setActive(null); setStage("splash"); };

  const showNav = stage === "app" && !detail;
  const chatFull = (!detail && tab === "support") || detail?.k === "chat";
  const firstName = user.name.split(" ")[0];

  return (
    // Pinned to the viewport so the page itself never scrolls — only the content area does.
    <div style={{ position: "fixed", inset: 0, background: "var(--app-bg)", display: "flex", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: SHELL_MAX_W, height: "100%", position: "relative", background: "var(--app-bg)", overflow: "hidden", boxShadow: "var(--shadow-float)", display: "flex", flexDirection: "column" }}>

        {stage === "splash" && (
          <SplashScreen tagline="Ride · Reach · Relax" onStart={() => setStage(readRider() ? "app" : "phone")}
            footer={
              <p style={{ margin: "14px 0 0", textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.55)" }}>
                Demo: <Link href="/driver" style={{ color: "var(--gold)" }}>Driver app</Link> · <Link href="/admin" style={{ color: "var(--gold)" }}>Admin panel</Link>
              </p>
            } />
        )}
        {stage === "phone" && <PhoneLogin title="Welcome to" accent="DriveWay" onSent={(p) => { setPhone(p); setStage("otp"); }} />}
        {stage === "otp" && <OtpStep phone={phone} onBack={() => setStage("phone")} onVerified={() => setStage("setup")} />}
        {stage === "setup" && (
          <ProfileSetup onDone={({ name, email }) => {
            setUser({ ...USER, name, email, initials: initialsOf(name), phone: `+91 ${phone.slice(0, 5)} ${phone.slice(5)}` });
            setStage("perm");
          }} />
        )}
        {stage === "perm" && <PermissionStep onDone={() => { writeRider(user); setStage("app"); }} />}

        {stage === "app" && (chatFull ? (
          <div style={{ flex: 1, minHeight: 0, paddingBottom: showNav ? "calc(76px + env(safe-area-inset-bottom))" : undefined }}>
            <ChatScreen title="DriveWay Support" messages={chat} typing={typing} onSend={sendChat} onBack={detail ? back : undefined} />
          </div>
        ) : (
          <div ref={scrollRef} className="no-scroll" style={{
            flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain",
            paddingBottom: showNav ? "calc(76px + env(safe-area-inset-bottom))" : undefined,
          }}>
            {/* ── Booking flow ── */}
            {detail?.k === "search" && (
              <SearchPage initialTo={detail.to} onBack={back} onDone={(from, to) => {
                const coupon = COUPONS.find((c) => c.code === pendingCoupon) ?? null;
                setBooking({ from, to, vehicle: detail.prefer ?? "mini", km: 0, min: 0, fare: 0, coupon, pay: "UPI" });
                push({ k: "choose" });
              }} />
            )}
            {detail?.k === "choose" && booking && (
              <ChooseRidePage from={booking.from} to={booking.to} prefer={booking.vehicle} onBack={back}
                onNext={(x) => { setBooking({ ...booking, ...x }); push({ k: "confirm" }); }} />
            )}
            {detail?.k === "confirm" && booking && (
              <ConfirmPage booking={booking} onBack={back} onConfirm={(coupon, pay) => confirmRide({ ...booking, coupon, pay })} />
            )}
            {detail?.k === "live" && active && (
              <LiveRidePage ride={active} onBack={() => goTab("home")} onCancel={cancelRide} onChat={() => push({ k: "chat" })}
                onDemoNext={() => setActive((r) => (r ? advance(r) : r))}
                onShare={() => flash("Live trip link shared with your emergency contacts")} />
            )}
            {detail?.k === "done" && active && (
              <TripDonePage ride={active} onDone={finishRide} onReceipt={() => flash(`Receipt sent to ${user.email || "your phone"}`)} />
            )}

            {/* ── Other detail pages ── */}
            {detail?.k === "rides" && <RidesScreen rides={rides} onBack={back} onOpen={(r) => push({ k: "ride", id: r.id })} onBook={() => startBooking()} />}
            {detail?.k === "ride" && (() => {
              const r = rides.find((x) => x.id === detail.id);
              return r ? <RideDetailPage ride={r} onBack={back} onHelp={() => push({ k: "chat" })} /> : null;
            })()}
            {detail?.k === "info" && <ProfileInfo which={detail.key} onBack={back} />}

            {/* ── Tabs ── */}
            {!detail && tab === "home" && (
              <HomeScreen
                firstName={firstName} active={active} unread={unread}
                onSearch={(prefer) => startBooking(undefined, prefer)}
                onQuick={(to) => startBooking(to)}
                onTrack={() => push(active?.status === "Completed" ? { k: "done" } : { k: "live" })}
                onOffers={() => goTab("offers")}
                onNotifications={() => { setUnread(0); push({ k: "info", key: "notifications" }); }}
              />
            )}
            {!detail && tab === "rides" && <RidesScreen rides={rides} onOpen={(r) => push({ k: "ride", id: r.id })} onBook={() => startBooking()} />}
            {!detail && tab === "offers" && (
              <OffersScreen onUse={(code) => { setPendingCoupon(code); flash(`${code} will be applied to your next ride`); startBooking(); }} />
            )}
            {!detail && tab === "profile" && (
              <ProfileScreen
                user={user}
                stats={{ rides: rides.filter((r) => r.status === "Completed").length, saved: 2, coupons: COUPONS.filter((c) => c.active).length }}
                onMenu={(key) => push(key === "rides" ? { k: "rides" } : key === "help" ? { k: "chat" } : { k: "info", key })}
                onLogout={logout}
                onDelete={() => flash("Deletion request sent — we'll confirm by SMS within 48 hours")}
              />
            )}
          </div>
        ))}

        {showNav && (
          <BottomNav<Tab> active={tab} onChange={goTab} items={[
            { id: "home", label: "Home", Icon: HomeGlyph },
            { id: "rides", label: "Rides", Icon: RidesGlyph },
            { id: "offers", label: "Offers", Icon: OffersGlyph },
            { id: "support", label: "Support", Icon: ChatGlyph },
            { id: "profile", label: "Profile", Icon: ProfileGlyph },
          ]} />
        )}

        <Toast msg={toast} bottom={showNav ? 90 : 96} />
      </div>
    </div>
  );
}

/* Profile-menu pages that don't need a screen of their own yet. */
function ProfileInfo({ which, onBack }: { which: ProfileKey | "notifications"; onBack: () => void }) {
  const row: React.CSSProperties = { ...card, padding: 14, display: "flex", alignItems: "center", gap: 12 };
  const small: React.CSSProperties = { margin: "2px 0 0", fontSize: 12.5, color: "var(--ink-soft)", lineHeight: 1.5 };

  switch (which) {
    case "places":
      return (
        <InfoPage title="Saved Places" onBack={onBack}>
          {PLACES.filter((p) => p.kind === "home" || p.kind === "work").map((p) => (
            <div key={p.id} style={row}>{p.kind === "home" ? <HomeIcon s={22} c="var(--blue)" /> : <BriefcaseIcon s={22} c="var(--blue)" />}<div><p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{p.name}</p><p style={small}>{p.address}</p></div></div>
          ))}
          <button style={{ ...row, border: "1.5px dashed var(--blue-ghost)", background: "transparent", boxShadow: "none", color: "var(--blue)", fontWeight: 600, fontSize: 14, cursor: "pointer", justifyContent: "center" }}>+ Add new place</button>
        </InfoPage>
      );
    case "payments":
      return (
        <InfoPage title="Payment Methods" onBack={onBack}>
          <div style={row}><UpiIcon s={22} c="var(--blue)" /><div><p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>UPI</p><p style={small}>amit@okaxis</p></div></div>
          <div style={row}><CardIcon s={22} c="var(--blue)" /><div><p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Visa ending 4821</p><p style={small}>Expires 08/29</p></div></div>
          <p style={{ ...small, textAlign: "center", padding: "0 20px" }}>Card details are stored by the payment gateway, never on DriveWay servers.</p>
        </InfoPage>
      );
    case "wallet":
      return (
        <InfoPage title="Wallet" onBack={onBack}>
          <div style={{ borderRadius: 20, padding: 18, background: "linear-gradient(150deg,var(--blue-dark),var(--blue))", color: "white", boxShadow: "0 10px 28px rgba(11,92,255,0.28)" }}>
            <p style={{ margin: 0, fontSize: 12.5, color: "rgba(255,255,255,0.75)" }}>Available balance</p>
            <p style={{ margin: "4px 0 0", fontSize: 30, fontWeight: 800 }}>{inr(240)}</p>
            <span style={{ display: "inline-block", marginTop: 8, background: "var(--gold)", color: "var(--blue-dark)", fontSize: 10.5, fontWeight: 700, padding: "3px 10px", borderRadius: 8 }}>COMING SOON · TOP-UPS</span>
          </div>
          {[["Refund · RD1282", "+ ₹166", "27 Sep"], ["Ride RD1284", "− ₹220", "27 Sep"], ["Referral bonus", "+ ₹100", "20 Sep"]].map(([t, a, d]) => (
            <div key={t} style={row}><WalletIcon s={20} c="var(--ink-soft)" /><div style={{ flex: 1 }}><p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{t}</p><p style={small}>{d}</p></div><span style={{ fontWeight: 700, color: a.startsWith("+") ? "var(--success-text)" : "var(--ink)" }}>{a}</span></div>
          ))}
        </InfoPage>
      );
    case "notifications":
      return (
        <InfoPage title="Notifications" onBack={onBack}>
          {[["Trip completed", "₹160 paid via UPI for ride RD1289. Rate your driver!", "1h"], ["Weekend offer 🎉", "15% off all rides this weekend with WEEKEND.", "5h"], ["Refund processed", "₹166 for ride RD1282 is back in your wallet.", "1d"]].map(([t, b, w]) => (
            <div key={t} style={row}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: "var(--blue)", flexShrink: 0 }} />
              <div style={{ flex: 1 }}><p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{t}</p><p style={small}>{b}</p></div>
              <span style={{ fontSize: 11.5, color: "var(--ink-mute)" }}>{w}</span>
            </div>
          ))}
        </InfoPage>
      );
    case "report":
      return (
        <InfoPage title="Report an Issue" onBack={onBack}>
          {["I was charged incorrectly", "I lost an item", "My driver was unprofessional", "Safety concern", "App isn't working"].map((q) => (
            <div key={q} style={{ ...row, justifyContent: "space-between" }}><span style={{ fontSize: 14, fontWeight: 500 }}>{q}</span><span style={{ color: "var(--ink-mute)" }}>›</span></div>
          ))}
        </InfoPage>
      );
    case "legal":
      return (
        <InfoPage title="Terms & Privacy" onBack={onBack}>
          {[["Terms of Service", "Rules for using DriveWay as a rider — bookings, cancellations, fares and conduct."], ["Privacy Policy", "What we collect (location during trips, contact details), why, and how long we keep it."], ["Refund Policy", "Wrong charges are refunded to the original payment method within 5–7 working days."]].map(([q, a]) => (
            <div key={q} style={{ ...card, padding: 14 }}><p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{q}</p><p style={small}>{a}</p></div>
          ))}
        </InfoPage>
      );
    case "about":
    default:
      return (
        <InfoPage title="About DriveWay" onBack={onBack}>
          <div style={{ ...card, padding: 16 }}>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>DriveWay</p>
            <p style={small}>Book a Bike, Auto, Mini, Sedan or SUV in a few taps. Verified drivers, live tracking and upfront fares — Ride · Reach · Relax.</p>
          </div>
        </InfoPage>
      );
  }
}
