"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import BottomNav, { ChatGlyph, HomeGlyph, OffersGlyph, ProfileGlyph, RidesGlyph } from "../components/BottomNav";
import { OtpStep, PermissionStep, PhoneLogin, ProfileSetup, SplashScreen } from "../components/Auth";
import HomeScreen from "../components/customer/HomeScreen";
import { ChooseRidePage, LiveRidePage, ParcelPage, SearchPage, TripDonePage } from "../components/customer/BookingScreens";
import { ChatScreen, InfoPage, OffersScreen, ProfileScreen, RideDetailPage, RidesScreen, type ChatMessage, type ProfileKey } from "../components/customer/AccountScreens";
import type { RideOption } from "../components/customer/types";
import { LoadState, Toast, card } from "../components/ui";
import { CardIcon, UpiIcon, WalletIcon } from "../components/icons";
import { inr, type PayMethod } from "../lib/data";
import { NATIVE_APP } from "../lib/native";
import {
  cancelRide, closeRide, fmtWhen, getSession, myActiveRide, myProfile, myRides, myWallet, onAuthChange, payRide, places as fetchPlaces,
  signOut, supportMessage, updateMyProfile, watchResume, watchRides, type Place, type Profile, type Quote, type RideView, type Txn,
} from "../lib/api";
import { supabase } from "../lib/supabase/client";

const SHELL_MAX_W = 430;
const LIVE: RideView["status"][] = ["Searching", "Arriving", "Arrived", "Started"];

type Tab = "home" | "rides" | "offers" | "support" | "profile";
type Stage = "loading" | "splash" | "phone" | "otp" | "setup" | "perm" | "app";

type Detail =
  | { k: "search"; to?: Place; prefer?: RideOption }
  | { k: "choose"; from: Place; to: Place; prefer?: RideOption }
  | { k: "parcel"; from: Place; to: Place; quote: Quote; pay: PayMethod; coupon: string | null }
  | { k: "live" }
  | { k: "ride"; id: string }
  | { k: "rides" }
  | { k: "chat" }
  | { k: "info"; key: ProfileKey | "notifications" };

const initialsOf = (n: string) => n.split(/\s+/).filter(Boolean).map((s) => s[0]).join("").slice(0, 2).toUpperCase() || "DW";
const optionOf = (r: RideView): RideOption => (r.service === "ride" ? r.vehicle : r.service);

export default function CustomerApp() {
  const [stage, setStage] = useState<Stage>("loading");
  const [phone, setPhone] = useState("");
  const [me, setMe] = useState<Profile | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [tab, setTab] = useState<Tab>("home");
  const [stack, setStack] = useState<Detail[]>([]);
  const [active, setActive] = useState<RideView | null>(null);
  const [rides, setRides] = useState<RideView[] | null>(null);
  const [ridesErr, setRidesErr] = useState<string | null>(null);
  const [wallet, setWallet] = useState<{ balance: number; txns: Txn[] }>({ balance: 0, txns: [] });
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [acPref, setAcPref] = useState(true);
  const [ridesTab, setRidesTab] = useState<"past" | "upcoming">("past");
  const [pendingCoupon, setPendingCoupon] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [bootErr, setBootErr] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastStatus = useRef<string | null>(null);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  /* ── session ── */
  const boot = useCallback(async () => {
    setBootErr(null);
    try {
      if (!(await getSession())) { setStage("splash"); return; }
      const p = await myProfile();
      setMe(p);
      setStage(p && p.name ? "app" : "setup");
    } catch (e) { setBootErr((e as Error).message); }
  }, []);
  useEffect(() => { void boot(); }, [boot]);
  useEffect(() => onAuthChange((signedIn) => { if (!signedIn) { setStage("splash"); setActive(null); setRides(null); setStack([]); } }), []);

  /* ── server state ── */
  const refreshActive = useCallback(async () => {
    try { setActive(await myActiveRide()); } catch { /* keep last known state; next poll retries */ }
  }, []);
  const refreshRides = useCallback(async () => {
    setRidesErr(null);
    try { setRides(await myRides()); } catch (e) { setRidesErr((e as Error).message); }
  }, []);
  const refreshMe = useCallback(async () => {
    try { setMe(await myProfile()); setWallet(await myWallet()); } catch { /* shown on next action */ }
  }, []);

  useEffect(() => {
    if (stage !== "app") return;
    fetchPlaces().then(setPlaces, (e) => flash((e as Error).message));
    void refreshActive(); void refreshRides(); void refreshMe();
    const stop = watchRides(() => { void refreshActive(); });
    const t = setInterval(() => { void refreshActive(); }, 4000);   // fallback if the realtime socket drops
    const unResume = watchResume(() => { void refreshActive(); void refreshRides(); });
    return () => { stop(); clearInterval(t); unResume(); };
  }, [stage, refreshActive, refreshRides, refreshMe, flash]);

  // Status-change toasts (works the same after an app restart — state comes from the server).
  useEffect(() => {
    const s = active?.status ?? null;
    if (s && lastStatus.current && s !== lastStatus.current) {
      const parcel = active?.service === "parcel";
      const msg: Record<string, string> = {
        Arriving: parcel ? "Delivery partner assigned! 📦" : "Driver assigned! 🎉",
        Arrived: parcel ? "Partner is at pickup — share the OTP" : "Your driver has arrived — share the OTP",
        Started: parcel ? "Parcel picked up and on its way" : "Trip started. Have a safe ride!",
        Completed: parcel ? "Your parcel has been delivered" : "You've reached your destination",
        NoDrivers: "No drivers accepted — you haven't been charged",
      };
      if (msg[s]) flash(msg[s]);
      if (s === "Completed" || s === "NoDrivers") { void refreshRides(); void refreshMe(); }
    }
    lastStatus.current = s;
  }, [active?.status, active?.service, flash, refreshRides, refreshMe]);

  const detail = stack[stack.length - 1];
  const detailKey = detail ? detail.k + ("id" in detail ? detail.id : "") : tab;
  useEffect(() => { scrollRef.current?.scrollTo({ top: 0 }); }, [detailKey]);

  const push = (d: Detail) => setStack((s) => [...s, d]);
  const back = () => setStack((s) => s.slice(0, -1));
  const goTab = (t: Tab) => { setStack([]); setTab(t); if (t !== "rides") setRidesTab("past"); if (t === "rides") void refreshRides(); };

  const startBooking = (to?: Place, prefer?: RideOption) => {
    if (active && LIVE.includes(active.status)) { push({ k: "live" }); flash("You already have a ride in progress"); return; }
    push({ k: "search", to, prefer });
  };

  const onBooked = async (scheduled: boolean) => {
    setPendingCoupon(null);
    if (scheduled) { await refreshRides(); setRidesTab("upcoming"); goTab("rides"); flash("Ride scheduled — we'll find a driver 15 minutes before pickup"); return; }
    await refreshActive();
    setStack([{ k: "live" }]);
  };

  /* ── support chat backed by a ticket ── */
  const loadChat = useCallback(async () => {
    const { data } = await supabase().from("tickets").select("code,status,notes").eq("role", "Customer").order("created_at", { ascending: false }).limit(1);
    const t = data?.[0] as { code: string; status: string; notes: { from: string; body: string; at: string }[] } | undefined;
    const welcome: ChatMessage = { id: 0, from: "agent", body: "Hi! 👋 Tell us what went wrong — include the ride ID (e.g. RD1301) if it's about a trip. A support agent will reply here.", at: "" };
    setChat([welcome, ...(t?.notes ?? []).map((n, i) => ({ id: i + 1, from: (n.from === "user" ? "me" : "agent") as ChatMessage["from"], body: n.body, at: new Date(n.at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }) }))]);
  }, []);
  const chatOpen = stage === "app" && ((!detail && tab === "support") || detail?.k === "chat");
  useEffect(() => {
    if (!chatOpen) return;
    void loadChat();
    const t = setInterval(() => void loadChat(), 8000);
    return () => clearInterval(t);
  }, [chatOpen, loadChat]);
  const sendChat = async (body: string) => {
    try { const t = await supportMessage(body, "Customer"); await loadChat(); flash(`Sent · ticket ${t.code}`); } catch (e) { flash((e as Error).message); }
  };

  const logout = async () => { await signOut(); setStack([]); setTab("home"); };

  const showNav = stage === "app" && !detail;
  const firstName = (me?.name ?? "").split(" ")[0] || "there";

  /* ── pages ── */
  const livePage = () => {
    if (!active) return <LoadState label="No ride in progress." />;
    if (active.status === "Completed") {
      return <TripDonePage ride={active} walletBalance={wallet.balance}
        onDone={() => { void refreshActive(); void refreshRides(); void refreshMe(); goTab("home"); flash(active.service === "parcel" ? "Thanks for sending with DriveWay Parcel 📦" : "Thanks for riding with DriveWay"); }}
        onReceipt={() => push({ k: "ride", id: active.id })} />;
    }
    return <LiveRidePage ride={active} onBack={() => goTab("home")} onChat={() => push({ k: "chat" })}
      onCancelled={() => { void refreshActive(); void refreshRides(); goTab("home"); flash(active.cancel_fee_now > 0 ? `Ride cancelled · ${inr(active.cancel_fee_now)} fee due` : "Ride cancelled — no charge"); }}
      onShare={() => flash("Trip sharing and SOS alerts need the notifications service — call 112 in an emergency")}
      onRetry={() => { const to = active.to; const prefer = optionOf(active); void closeRide(active.id).then(refreshActive); setStack([{ k: "search", to: places.find((p) => p.id === to.id), prefer }]); }}
      onDismiss={() => { void closeRide(active.id).then(refreshActive); goTab("home"); }} />;
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "var(--app-bg)", display: "flex", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: SHELL_MAX_W, height: "100%", position: "relative", background: "var(--app-bg)", overflow: "hidden", boxShadow: "var(--shadow-float)", display: "flex", flexDirection: "column" }}>

        {stage === "loading" && <LoadState error={bootErr} onRetry={() => void boot()} />}
        {stage === "splash" && (
          <SplashScreen tagline="Ride · Reach · Relax" onStart={() => setStage("phone")}
            footer={NATIVE_APP ? undefined :
              <p style={{ margin: "14px 0 0", textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.55)" }}>
                <Link href="/rider" style={{ color: "var(--gold)" }}>Drive with DriveWay</Link>
              </p>
            } />
        )}
        {stage === "phone" && <PhoneLogin title="Welcome to" accent="DriveWay" onSent={(p) => { setPhone(p); setStage("otp"); }} />}
        {stage === "otp" && <OtpStep phone={phone} onBack={() => setStage("phone")} onVerified={() => void boot()} />}
        {stage === "setup" && (
          <ProfileSetup onDone={async ({ name, email }) => { await updateMyProfile(name, email); setMe(await myProfile()); setStage("perm"); }} />
        )}
        {stage === "perm" && <PermissionStep onDone={() => setStage("app")} />}

        {stage === "app" && (chatOpen ? (
          <div style={{ flex: 1, minHeight: 0, paddingBottom: showNav ? "calc(76px + env(safe-area-inset-bottom))" : undefined }}>
            <ChatScreen title="DriveWay Support" subtitle="Agents reply here · usually within a few hours" messages={chat} typing={false} onSend={(b) => void sendChat(b)} onBack={detail ? back : undefined} />
          </div>
        ) : (
          <div ref={scrollRef} className="no-scroll" style={{
            flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain",
            paddingBottom: showNav ? "calc(76px + env(safe-area-inset-bottom))" : undefined,
          }}>
            {detail?.k === "search" && (
              places.length ? <SearchPage places={places} initialTo={detail.to} onBack={back} onDone={(from, to) => push({ k: "choose", from, to, prefer: detail.prefer })} /> : <LoadState />
            )}
            {detail?.k === "choose" && (
              <ChooseRidePage from={detail.from} to={detail.to} prefer={detail.prefer} initialCoupon={pendingCoupon}
                initialAc={acPref} onAcChange={setAcPref} onBack={back} onEditRoute={back}
                onBooked={(s) => void onBooked(s)}
                onParcel={(x) => push({ k: "parcel", from: detail.from, to: detail.to, ...x })} />
            )}
            {detail?.k === "parcel" && (
              <ParcelPage from={detail.from} to={detail.to} quote={detail.quote} pay={detail.pay} coupon={detail.coupon} onBack={back} onBooked={() => void onBooked(false)} />
            )}
            {detail?.k === "live" && livePage()}

            {detail?.k === "rides" && <RidesScreen rides={rides} error={ridesErr} onRetry={() => void refreshRides()} onBack={back} onOpen={(r) => push({ k: "ride", id: r.id })} onBook={() => startBooking()} />}
            {detail?.k === "ride" && (() => {
              const r = rides?.find((x) => x.id === detail.id) ?? (active?.id === detail.id ? active : null);
              return r ? <RideDetailPage ride={r} onBack={back} onHelp={() => push({ k: "chat" })}
                onPay={() => void payRide(r.id, r.pay === "Wallet" ? "Wallet" : "UPI").then(() => { void refreshRides(); void refreshMe(); flash("Payment received"); }, (e) => flash((e as Error).message))}
                onCancel={() => void cancelRide(r.id, "Changed my plans").then(() => { void refreshRides(); back(); flash("Scheduled ride cancelled"); }, (e) => flash((e as Error).message))} />
                : <LoadState error={ridesErr} onRetry={() => void refreshRides()} />;
            })()}
            {detail?.k === "info" && <ProfileInfo which={detail.key} rides={rides ?? []} wallet={wallet} onBack={back} />}

            {!detail && tab === "home" && (
              <HomeScreen
                firstName={firstName} places={places} active={active} unread={0}
                ac={acPref} onAc={(v) => { setAcPref(v); flash(v ? "AC vehicles selected" : "Non-AC vehicles selected — cheaper car fares"); }}
                onSearch={(prefer) => startBooking(undefined, prefer)}
                onQuick={(to) => startBooking(to)}
                onTrack={() => push({ k: "live" })}
                onOffers={() => goTab("offers")}
                onNotifications={() => push({ k: "info", key: "notifications" })}
              />
            )}
            {!detail && tab === "rides" && <RidesScreen key={ridesTab} initialTab={ridesTab} rides={rides} error={ridesErr} onRetry={() => void refreshRides()} onOpen={(r) => push({ k: "ride", id: r.id })} onBook={() => startBooking()} />}
            {!detail && tab === "offers" && (
              <OffersScreen onUse={(code) => { setPendingCoupon(code); flash(`${code} will be applied to your next ride`); startBooking(); }} />
            )}
            {!detail && tab === "profile" && me && (
              <ProfileScreen
                user={{ name: me.name, email: me.email ?? "", phone: me.phone ? `+${me.phone}` : "", rating: me.rating, initials: initialsOf(me.name) }}
                stats={{ rides: me.completed, saved: 0, coupons: 0 }}
                onMenu={(key) => push(key === "rides" ? { k: "rides" } : key === "help" ? { k: "chat" } : { k: "info", key })}
                onLogout={() => void logout()}
                onDelete={() => void supportMessage("Please delete my DriveWay account and personal data.", "Customer").then(() => flash("Deletion request sent to support — we'll confirm by SMS"), (e) => flash((e as Error).message))}
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

/* Profile-menu pages. */
function ProfileInfo({ which, rides, wallet, onBack }: { which: ProfileKey | "notifications"; rides: RideView[]; wallet: { balance: number; txns: Txn[] }; onBack: () => void }) {
  const row: React.CSSProperties = { ...card, padding: 14, display: "flex", alignItems: "center", gap: 12 };
  const small: React.CSSProperties = { margin: "2px 0 0", fontSize: 12.5, color: "var(--ink-soft)", lineHeight: 1.5 };

  switch (which) {
    case "places":
      return (
        <InfoPage title="Saved Places" onBack={onBack}>
          <div style={{ ...card, padding: 16 }}><p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>No saved places yet</p><p style={small}>Saving Home and Work arrives with map search. Until then, pick from the places list when you book.</p></div>
        </InfoPage>
      );
    case "payments":
      return (
        <InfoPage title="Payment Methods" onBack={onBack}>
          <div style={row}><UpiIcon s={22} c="var(--blue)" /><div><p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>UPI</p><p style={small}>Choose at booking; pay after the trip</p></div></div>
          <div style={row}><CardIcon s={22} c="var(--blue)" /><div><p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Credit / Debit Card</p><p style={small}>Card details are handled by the payment gateway, never stored by DriveWay</p></div></div>
          <div style={row}><WalletIcon s={22} c="var(--blue)" /><div><p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>DriveWay Wallet</p><p style={small}>Balance {inr(wallet.balance)} · refunds land here</p></div></div>
        </InfoPage>
      );
    case "wallet":
      return (
        <InfoPage title="Wallet" onBack={onBack}>
          <div style={{ borderRadius: 20, padding: 18, background: "linear-gradient(150deg,var(--blue-dark),var(--blue))", color: "white", boxShadow: "0 10px 28px rgba(11,92,255,0.28)" }}>
            <p style={{ margin: 0, fontSize: 12.5, color: "rgba(255,255,255,0.75)" }}>Available balance</p>
            <p style={{ margin: "4px 0 0", fontSize: 30, fontWeight: 800 }}>{inr(wallet.balance)}</p>
          </div>
          {wallet.txns.length === 0 && <p style={{ ...small, textAlign: "center" }}>No wallet activity yet. Refunds and wallet payments will show here.</p>}
          {wallet.txns.map((t) => (
            <div key={t.id} style={row}><WalletIcon s={20} c="var(--ink-soft)" /><div style={{ flex: 1 }}><p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{t.note ?? t.kind}</p><p style={small}>{fmtWhen(t.at)}</p></div><span style={{ fontWeight: 700, color: t.amount > 0 ? "var(--success-text)" : "var(--ink)" }}>{t.amount > 0 ? "+ " : "− "}{inr(Math.abs(t.amount))}</span></div>
          ))}
        </InfoPage>
      );
    case "notifications":
      return (
        <InfoPage title="Notifications" onBack={onBack}>
          {rides.length === 0 && <p style={{ ...small, textAlign: "center" }}>Ride updates will appear here.</p>}
          {rides.slice(0, 10).map((r) => (
            <div key={r.id} style={row}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: "var(--blue)", flexShrink: 0 }} />
              <div style={{ flex: 1 }}><p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{r.code} · {r.status === "NoDrivers" ? "No drivers" : r.status}</p><p style={small}>{r.from.name} → {r.to.name}{r.payment_status === "pending" ? ` · ${inr(r.total)} due` : ""}</p></div>
              <span style={{ fontSize: 11.5, color: "var(--ink-mute)" }}>{fmtWhen(r.created_at).split(", ")[0]}</span>
            </div>
          ))}
        </InfoPage>
      );
    case "report":
      return (
        <InfoPage title="Report an Issue" onBack={onBack}>
          <p style={small}>Open Help &amp; Support and describe the problem — include the ride ID. Each message creates or updates your support ticket.</p>
        </InfoPage>
      );
    case "legal":
      return (
        <InfoPage title="Terms & Privacy" onBack={onBack}>
          {[["Terms of Service", "Rules for using DriveWay as a rider — bookings, cancellations, fares and conduct."], ["Privacy Policy", "What we collect (location during trips, contact details), why, and how long we keep it."], ["Refund Policy", "Approved refunds are credited to your DriveWay wallet."]].map(([q, a]) => (
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
            <p style={small}>Book a Bike, Auto, E-Rickshaw, Mini, Sedan or XL in a few taps. Verified drivers and upfront fares — Ride · Reach · Relax.</p>
          </div>
        </InfoPage>
      );
  }
}
