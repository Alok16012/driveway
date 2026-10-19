"use client";

import { Capacitor, CapacitorHttp, registerPlugin } from "@capacitor/core";
import type { BackgroundGeolocationPlugin } from "@capacitor-community/background-geolocation";
import { reportLocation } from "./api";
import { distanceM, type LatLng } from "./location";
import { supabase } from "./supabase/client";

/* Shares the driver's GPS with the customer while a trip is live: every 4 s, or sooner after 25 m.
 * In the rider APK fixes come from a foreground service, so they keep flowing with the screen off or Google Maps
 * in front (Android shows a notification meanwhile), and each report goes out over native HTTP, which Android
 * doesn't throttle in the background the way it does the WebView's own requests. Reports are sent straight from
 * the fix callback, not through React state, because a backgrounded WebView can hold renders back.
 * In a browser it is the page's own GPS watch, which pauses while the tab is hidden. */

const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>("BackgroundGeolocation");
const nativeTracking = () => Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("BackgroundGeolocation");

type Fix = { pos: LatLng; accuracy: number; heading: number | null };

async function send(f: Fix) {
  const heading = f.heading !== null && f.heading >= 0 && f.heading < 360 ? f.heading : null;
  if (!nativeTracking()) return reportLocation({ lat: f.pos.lat, lng: f.pos.lng, heading, accuracy: f.accuracy });
  const token = (await supabase().auth.getSession()).data.session?.access_token;
  if (!token) return;
  const res = await CapacitorHttp.post({
    url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/report_location`,
    headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "", Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    data: { p_lat: f.pos.lat, p_lng: f.pos.lng, p_heading: heading, p_accuracy: f.accuracy },
  });
  if (res.status >= 300) throw new Error(`report_location failed (${res.status})`);
}

/** Starts sharing; call the returned function when the trip ends. */
export function startTripTracking(): () => void {
  let stopped = false;
  let last: { pos: LatLng; at: number } | null = null;
  const onFix = (f: Fix) => {
    if (stopped) return;
    if (last && Date.now() - last.at < 4000 && distanceM(last.pos, f.pos) < 25) return;
    last = { pos: f.pos, at: Date.now() };
    send(f).catch(() => { last = null; });   // retry on the next fix
  };

  if (nativeTracking()) {
    let id: string | null = null;
    void BackgroundGeolocation.addWatcher(
      {
        backgroundTitle: "Trip in progress",
        backgroundMessage: "Sharing your location with the customer until the trip ends.",
        requestPermissions: true, stale: false, distanceFilter: 0,
      },
      (loc, err) => {
        if (err || !loc) return;
        onFix({ pos: { lat: loc.latitude, lng: loc.longitude }, accuracy: loc.accuracy, heading: loc.bearing ?? null });
      },
    ).then((w) => { if (stopped) void BackgroundGeolocation.removeWatcher({ id: w }); else id = w; });
    return () => { stopped = true; if (id) void BackgroundGeolocation.removeWatcher({ id }); };
  }

  if (typeof navigator === "undefined" || !("geolocation" in navigator)) return () => {};
  const w = navigator.geolocation.watchPosition(
    (p) => onFix({ pos: { lat: p.coords.latitude, lng: p.coords.longitude }, accuracy: p.coords.accuracy, heading: p.coords.heading }),
    () => {},
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
  );
  return () => { stopped = true; navigator.geolocation.clearWatch(w); };
}
