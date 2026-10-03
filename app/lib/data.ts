/* Sample data shared by the Customer app, Driver app and Admin panel.
 * Stand-ins until the REST API from the PRD is live — every screen reads through these shapes. */

export type VehicleKind = "bike" | "auto" | "erick" | "mini" | "sedan" | "taxi" | "suv";

export interface Vehicle {
  id: VehicleKind;
  name: string;
  tagline: string;
  seats: number;
  base: number;     // ₹ base fare
  perKm: number;    // ₹ per km
  perMin: number;   // ₹ per minute
  minFare: number;  // ₹ minimum fare
  cancelFee: number;
  eta: number;      // minutes to pickup
  enabled: boolean;
  ac: boolean;      // offers an AC option (Non-AC is always available and cheaper)
  nearby: number;   // vehicles near the customer right now; 0 → "no cabs"
}

export const VEHICLES: Vehicle[] = [
  { id: "bike",  name: "Bike",  tagline: "Beat the traffic on a bike", seats: 1, base: 20, perKm: 6,  perMin: 1,   minFare: 30,  cancelFee: 15, eta: 3, enabled: true, ac: false, nearby: 9 },
  { id: "auto",  name: "Auto",  tagline: "No bargaining, doorstep pickup", seats: 3, base: 30, perKm: 10, perMin: 1.5, minFare: 45,  cancelFee: 20, eta: 4, enabled: true, ac: false, nearby: 6 },
  { id: "erick", name: "E-Rickshaw", tagline: "Eco-friendly, cheap short hops", seats: 4, base: 20, perKm: 7, perMin: 1, minFare: 30, cancelFee: 10, eta: 5, enabled: true, ac: false, nearby: 7 },
  { id: "mini",  name: "Mini",  tagline: "Comfy, economical cars",   seats: 4, base: 45, perKm: 12, perMin: 2,   minFare: 80,  cancelFee: 30, eta: 7, enabled: true, ac: true, nearby: 5 },
  { id: "sedan", name: "Sedan", tagline: "Top-rated drivers, more legroom", seats: 4, base: 60, perKm: 15, perMin: 2, minFare: 110, cancelFee: 40, eta: 6, enabled: true, ac: true, nearby: 4 },
  { id: "taxi",  name: "Taxi",  tagline: "Classic yellow-top city taxi", seats: 4, base: 40, perKm: 11, perMin: 1.5, minFare: 70,  cancelFee: 25, eta: 0, enabled: true, ac: true, nearby: 0 },
  { id: "suv",   name: "SUV",   tagline: "Extra legroom, 6 seats + luggage", seats: 6, base: 90, perKm: 20, perMin: 2.5, minFare: 160, cancelFee: 50, eta: 8, enabled: true, ac: true, nearby: 3 },
];

/** Non-AC rides are this much of the AC fare. */
export const NON_AC_FACTOR = 0.85;

export const vehicleById = (id: VehicleKind) => VEHICLES.find((v) => v.id === id)!;

export interface Place { id: string; name: string; address: string; kind?: "home" | "work" | "recent" }

export const PLACES: Place[] = [
  { id: "home", name: "Home", address: "B-42, Sector 62, Noida", kind: "home" },
  { id: "work", name: "Work", address: "Tower C, Cyber City, Gurugram", kind: "work" },
  { id: "dlf", name: "DLF Mall of India", address: "Sector 18, Noida", kind: "recent" },
  { id: "airport", name: "IGI Airport T3", address: "New Delhi 110037", kind: "recent" },
  { id: "cp", name: "Connaught Place", address: "Rajiv Chowk, New Delhi" },
  { id: "botanical", name: "Botanical Garden Metro", address: "Sector 38, Noida" },
  { id: "akshardham", name: "Akshardham Temple", address: "NH 24, New Delhi" },
  { id: "gip", name: "Great India Place", address: "Sector 38A, Noida" },
];

export const CURRENT_LOCATION: Place = { id: "cur", name: "Current location", address: "Sector 12, Noida" };

/** Rough trip estimate from the two place ids — stable per pair so the demo feels consistent. */
export function tripEstimate(a: string, b: string) {
  const seed = [...(a + b)].reduce((s, ch) => s + ch.charCodeAt(0), 0);
  const km = 3 + (seed % 170) / 10;          // 3 – 20 km
  const min = Math.round(km * 2.6 + 4);       // city traffic
  return { km: Math.round(km * 10) / 10, min };
}

export function fareFor(v: Vehicle, km: number, min: number, surge = 1, ac = true) {
  const f = Math.max(v.minFare, Math.round((v.base + v.perKm * km + v.perMin * min) * surge));
  return v.ac && !ac ? Math.round(f * NON_AC_FACTOR) : f;
}

/* ───────────── Hourly rentals & parcel delivery ───────────── */

export interface RentalPackage { id: string; hours: number; km: number; price: number; extraKm: number; extraHour: number }

/** Mini prices; other cars scale by RENTAL_SCALE. */
export const RENTAL_PACKAGES: RentalPackage[] = [
  { id: "r1", hours: 1, km: 10, price: 249, extraKm: 12, extraHour: 120 },
  { id: "r2", hours: 2, km: 20, price: 449, extraKm: 12, extraHour: 120 },
  { id: "r4", hours: 4, km: 40, price: 849, extraKm: 12, extraHour: 110 },
  { id: "r8", hours: 8, km: 80, price: 1599, extraKm: 12, extraHour: 100 },
];

export const RENTAL_SCALE: Partial<Record<VehicleKind, number>> = { mini: 1, sedan: 1.25, suv: 1.6 };

export function rentalPrice(p: RentalPackage, v: VehicleKind, ac = true) {
  const f = Math.round(p.price * (RENTAL_SCALE[v] ?? 1));
  return ac ? f : Math.round(f * NON_AC_FACTOR);
}

export type ParcelWeight = "light" | "medium" | "heavy";

/** Bike carries up to 5 kg; heavier parcels go by Auto (base fare + a handling fee). */
export const PARCEL_WEIGHTS: { id: ParcelWeight; label: string; sub: string; vehicle: VehicleKind; fee: number }[] = [
  { id: "light", label: "Up to 1 kg", sub: "Documents, keys, small items", vehicle: "bike", fee: 0 },
  { id: "medium", label: "1 – 5 kg", sub: "Food, clothes, a small box", vehicle: "bike", fee: 15 },
  { id: "heavy", label: "5 – 20 kg", sub: "Big boxes, appliances", vehicle: "auto", fee: 40 },
];

export const PARCEL_TYPES = ["Documents", "Food", "Clothes", "Electronics", "Medicines", "Groceries", "Other"];

export function parcelFare(weight: ParcelWeight, km: number, min: number) {
  const w = PARCEL_WEIGHTS.find((x) => x.id === weight)!;
  return fareFor(VEHICLES.find((x) => x.id === w.vehicle)!, km, min) + w.fee;
}

export interface Coupon { code: string; title: string; body: string; off: number; pct?: boolean; max?: number; expires: string; uses?: number; active?: boolean }

export const COUPONS: Coupon[] = [
  { code: "FIRST50", title: "50% off your first ride", body: "Up to ₹100 off on any vehicle", off: 50, pct: true, max: 100, expires: "31 Oct 2026", uses: 1284, active: true },
  { code: "AUTO20", title: "Flat ₹20 off on Auto", body: "Valid on Auto rides above ₹80", off: 20, expires: "15 Oct 2026", uses: 642, active: true },
  { code: "WEEKEND", title: "15% off weekend rides", body: "Sat & Sun · up to ₹75 off", off: 15, pct: true, max: 75, expires: "30 Nov 2026", uses: 311, active: true },
  { code: "AIRPORT99", title: "₹99 off airport drops", body: "Sedan & SUV to IGI Airport", off: 99, expires: "31 Dec 2026", uses: 87, active: false },
];

export function discountFor(c: Coupon | null, fare: number) {
  if (!c) return 0;
  const d = c.pct ? Math.round((fare * c.off) / 100) : c.off;
  return Math.min(d, c.max ?? d, fare);
}

export type RideStatus = "Searching" | "Assigned" | "Arriving" | "Arrived" | "Started" | "Completed" | "Cancelled" | "Scheduled";

export const RIDE_STEPS: RideStatus[] = ["Searching", "Assigned", "Arriving", "Arrived", "Started", "Completed"];

export type PayMethod = "UPI" | "Cash" | "Card" | "Wallet";

export interface Driver {
  id: string; name: string; initials: string; phone: string; rating: number; trips: number;
  vehicle: VehicleKind; model: string; plate: string; city: string;
  ac: boolean;   // vehicle has working AC (bikes and autos never do)
  kyc: "Approved" | "Pending" | "Rejected"; online: boolean; suspended?: boolean; joined: string; earnings: number;
}

export const DRIVERS: Driver[] = [
  { id: "DRV1001", name: "Rohit Kumar", initials: "RK", phone: "+91 98100 12345", rating: 4.8, trips: 1284, vehicle: "sedan", model: "Maruti Dzire · White", plate: "UP16 AB 1234", ac: true, city: "Noida", kyc: "Approved", online: true, joined: "12 Jan 2026", earnings: 186400 },
  { id: "DRV1002", name: "Suresh Pal", initials: "SP", phone: "+91 98111 45678", rating: 4.6, trips: 842, vehicle: "auto", model: "Bajaj RE · Green", plate: "DL 1C 5678", ac: false, city: "Delhi", kyc: "Approved", online: true, joined: "03 Feb 2026", earnings: 98200 },
  { id: "DRV1003", name: "Rakesh Das", initials: "RD", phone: "+91 98222 90120", rating: 4.2, trips: 311, vehicle: "mini", model: "Hyundai i10 · Grey", plate: "BR01 CD 9012", ac: false, city: "Noida", kyc: "Approved", online: false, joined: "20 Mar 2026", earnings: 54100 },
  { id: "DRV1004", name: "Manoj Tiwari", initials: "MT", phone: "+91 98333 34560", rating: 4.9, trips: 2031, vehicle: "suv", model: "Toyota Innova · Silver", plate: "UP32 EF 3456", ac: true, city: "Lucknow", kyc: "Approved", online: true, joined: "08 Nov 2025", earnings: 312900 },
  { id: "DRV1005", name: "Imran Khan", initials: "IK", phone: "+91 98444 11223", rating: 4.7, trips: 564, vehicle: "bike", model: "Honda Shine · Black", plate: "DL 3S AB 1122", ac: false, city: "Delhi", kyc: "Approved", online: true, joined: "14 Apr 2026", earnings: 41800 },
  { id: "DRV1006", name: "Vikram Singh", initials: "VS", phone: "+91 98555 66778", rating: 0, trips: 0, vehicle: "sedan", model: "Honda Amaze · Blue", plate: "HR26 GH 6677", ac: true, city: "Gurugram", kyc: "Pending", online: false, joined: "26 Sep 2026", earnings: 0 },
  { id: "DRV1007", name: "Arjun Yadav", initials: "AY", phone: "+91 98666 22334", rating: 0, trips: 0, vehicle: "auto", model: "Piaggio Ape · Yellow", plate: "UP16 JK 2233", ac: false, city: "Noida", kyc: "Pending", online: false, joined: "27 Sep 2026", earnings: 0 },
  { id: "DRV1008", name: "Deepak Sharma", initials: "DS", phone: "+91 98777 88990", rating: 3.9, trips: 128, vehicle: "mini", model: "Maruti Swift · Red", plate: "DL 8C LM 8899", ac: true, city: "Delhi", kyc: "Approved", online: false, suspended: true, joined: "02 Jun 2026", earnings: 18700 },
];

export interface Customer {
  id: string; name: string; initials: string; phone: string; email: string; rides: number; spent: number;
  rating: number; joined: string; blocked?: boolean; complaints: number;
}

export const CUSTOMERS: Customer[] = [
  { id: "CUS2001", name: "Amit Sharma", initials: "AS", phone: "+91 98765 43210", email: "amit.sharma@gmail.com", rides: 42, spent: 8420, rating: 4.9, joined: "02 Feb 2026", complaints: 0 },
  { id: "CUS2002", name: "Priya Mehta", initials: "PM", phone: "+91 87654 32109", email: "priya.m@outlook.com", rides: 18, spent: 3960, rating: 4.7, joined: "19 Mar 2026", complaints: 1 },
  { id: "CUS2003", name: "Neha Gupta", initials: "NG", phone: "+91 76543 21098", email: "neha.gupta@yahoo.in", rides: 15, spent: 2710, rating: 4.8, joined: "07 Apr 2026", complaints: 0 },
  { id: "CUS2004", name: "Vikash Singh", initials: "VS", phone: "+91 65432 10987", email: "vikash.s@gmail.com", rides: 6, spent: 1180, rating: 4.1, joined: "22 May 2026", complaints: 2, blocked: true },
  { id: "CUS2005", name: "Kavya Iyer", initials: "KI", phone: "+91 99887 76655", email: "kavya.iyer@gmail.com", rides: 31, spent: 6240, rating: 5.0, joined: "11 Jan 2026", complaints: 0 },
  { id: "CUS2006", name: "Rahul Verma", initials: "RV", phone: "+91 91234 56780", email: "rahul.v@gmail.com", rides: 9, spent: 1560, rating: 4.5, joined: "30 Jun 2026", complaints: 0 },
];

export interface Ride {
  id: string; customer: string; driver: string; vehicle: VehicleKind;
  from: string; to: string; km: number; min: number;
  fare: number; discount: number; pay: PayMethod; paid: boolean;
  status: RideStatus; date: string; time: string; rating?: number; cancelReason?: string;
  label?: string;   // what was booked when it isn't a plain ride, e.g. "Parcel · Bike", "Sedan · Non-AC"
}

export const RIDES: Ride[] = [
  { id: "RD1289", customer: "Amit Sharma", driver: "Rohit Kumar", vehicle: "sedan", from: "Sector 12, Noida", to: "DLF Mall of India", km: 4.2, min: 16, fare: 160, discount: 0, pay: "UPI", paid: true, status: "Completed", date: "28 Sep 2026", time: "10:38 AM", rating: 5 },
  { id: "RD1288", customer: "Priya Mehta", driver: "Suresh Pal", vehicle: "auto", from: "Botanical Garden Metro", to: "Sector 62, Noida", km: 6.8, min: 22, fare: 132, discount: 0, pay: "Cash", paid: false, status: "Started", date: "28 Sep 2026", time: "10:21 AM" },
  { id: "RD1287", customer: "Neha Gupta", driver: "Manoj Tiwari", vehicle: "suv", from: "Connaught Place", to: "IGI Airport T3", km: 16.4, min: 46, fare: 533, discount: 99, pay: "Card", paid: true, status: "Completed", date: "28 Sep 2026", time: "09:52 AM", rating: 4 },
  { id: "RD1286", customer: "Vikash Singh", driver: "Rakesh Das", vehicle: "mini", from: "Great India Place", to: "Akshardham Temple", km: 9.1, min: 28, fare: 180, discount: 0, pay: "Cash", paid: false, status: "Cancelled", date: "28 Sep 2026", time: "09:40 AM", cancelReason: "Driver taking too long" },
  { id: "RD1285", customer: "Kavya Iyer", driver: "Imran Khan", vehicle: "bike", from: "Sector 18, Noida", to: "Sector 50, Noida", km: 5.3, min: 14, fare: 66, discount: 0, pay: "UPI", paid: true, status: "Arriving", date: "28 Sep 2026", time: "10:44 AM" },
  { id: "RD1284", customer: "Amit Sharma", driver: "Suresh Pal", vehicle: "auto", from: "Yesterday · Noida", to: "Okhla, Delhi", km: 11.2, min: 34, fare: 240, discount: 20, pay: "Wallet", paid: true, status: "Completed", date: "27 Sep 2026", time: "08:20 PM", rating: 4 },
  { id: "RD1283", customer: "Rahul Verma", driver: "Rohit Kumar", vehicle: "sedan", from: "Cyber City, Gurugram", to: "Sector 29, Gurugram", km: 5.6, min: 19, fare: 182, discount: 0, pay: "UPI", paid: true, status: "Completed", date: "27 Sep 2026", time: "07:05 PM", rating: 5 },
  { id: "RD1282", customer: "Priya Mehta", driver: "Deepak Sharma", vehicle: "mini", from: "Lajpat Nagar", to: "Saket", km: 6.1, min: 24, fare: 166, discount: 0, pay: "Cash", paid: true, status: "Completed", date: "27 Sep 2026", time: "05:48 PM", rating: 3 },
  { id: "RD1281", customer: "Neha Gupta", driver: "Imran Khan", vehicle: "bike", from: "Sector 62, Noida", to: "Sector 15, Noida", km: 7.2, min: 18, fare: 81, discount: 0, pay: "UPI", paid: true, status: "Completed", date: "26 Sep 2026", time: "09:12 AM", rating: 5 },
  { id: "RD1280", customer: "Kavya Iyer", driver: "Manoj Tiwari", vehicle: "suv", from: "Home", to: "Jewar Airport", km: 38.5, min: 64, fare: 1020, discount: 75, pay: "Card", paid: true, status: "Completed", date: "26 Sep 2026", time: "06:30 AM", rating: 5 },
];

/** The signed-in customer's own trips (Customer app → My Rides). */
export const MY_RIDES: Ride[] = [
  { id: "RD1289", customer: "Amit Sharma", driver: "Rohit Kumar", vehicle: "sedan", from: "Sector 12, Noida", to: "DLF Mall of India", km: 4.2, min: 16, fare: 160, discount: 0, pay: "UPI", paid: true, status: "Completed", date: "Today", time: "10:38 AM", rating: 5 },
  { id: "RD1284", customer: "Amit Sharma", driver: "Suresh Pal", vehicle: "auto", from: "Noida Sector 18", to: "Okhla, Delhi", km: 11.2, min: 34, fare: 240, discount: 20, pay: "Wallet", paid: true, status: "Completed", date: "Yesterday", time: "08:20 PM", rating: 4 },
  { id: "RD1270", customer: "Amit Sharma", driver: "Manoj Tiwari", vehicle: "suv", from: "Airport T3", to: "Home", km: 34.0, min: 58, fare: 380, discount: 0, pay: "Card", paid: true, status: "Completed", date: "18 Sep 2026", time: "11:15 PM", rating: 5 },
  { id: "RD1262", customer: "Amit Sharma", driver: "Imran Khan", vehicle: "bike", from: "Work", to: "Botanical Garden", km: 6.4, min: 17, fare: 70, discount: 0, pay: "Cash", paid: true, status: "Cancelled", date: "12 Sep 2026", time: "06:40 PM", cancelReason: "Changed my plans" },
];

export const USER = { name: "Amit Sharma", initials: "AS", phone: "+91 98765 43210", email: "amit.sharma@gmail.com", rating: 4.9 };

export interface Ticket { id: string; from: string; role: "Customer" | "Driver"; subject: string; ride?: string; status: "Open" | "In Progress" | "Resolved"; at: string; notes: string[] }

export const TICKETS: Ticket[] = [
  { id: "TK501", from: "Priya Mehta", role: "Customer", subject: "Charged twice for ride RD1282", ride: "RD1282", status: "Open", at: "28 Sep, 09:10 AM", notes: [] },
  { id: "TK500", from: "Suresh Pal", role: "Driver", subject: "Payout for 21–27 Sep not received", status: "In Progress", at: "27 Sep, 06:44 PM", notes: ["Checked with finance — settlement batch runs Monday."] },
  { id: "TK499", from: "Vikash Singh", role: "Customer", subject: "Driver was rude, cancelled ride", ride: "RD1286", status: "Open", at: "27 Sep, 03:20 PM", notes: [] },
  { id: "TK498", from: "Kavya Iyer", role: "Customer", subject: "Left my umbrella in the SUV", ride: "RD1280", status: "Resolved", at: "26 Sep, 10:02 AM", notes: ["Driver returned the item on 26 Sep."] },
];

export const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

export const nowTime = () => new Date().toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });

/** Last 7 days — rides and revenue for dashboard charts. */
export const WEEK = [
  { d: "Mon", rides: 1040, revenue: 196000 },
  { d: "Tue", rides: 1122, revenue: 214500 },
  { d: "Wed", rides: 986, revenue: 188200 },
  { d: "Thu", rides: 1190, revenue: 229800 },
  { d: "Fri", rides: 1410, revenue: 276400 },
  { d: "Sat", rides: 1586, revenue: 312900 },
  { d: "Sun", rides: 1248, revenue: 248000 },
];

export interface Txn { id: string; kind: "Ride Fare" | "Commission" | "Driver Payout" | "Refund"; who: string; amount: number; method: PayMethod | "Bank"; at: string; ride?: string }

export const TXNS: Txn[] = [
  { id: "TX9012", kind: "Ride Fare", who: "Amit Sharma", amount: 160, method: "UPI", at: "28 Sep, 10:54 AM", ride: "RD1289" },
  { id: "TX9011", kind: "Commission", who: "Rohit Kumar", amount: -32, method: "UPI", at: "28 Sep, 10:54 AM", ride: "RD1289" },
  { id: "TX9010", kind: "Ride Fare", who: "Neha Gupta", amount: 434, method: "Card", at: "28 Sep, 10:40 AM", ride: "RD1287" },
  { id: "TX9009", kind: "Commission", who: "Manoj Tiwari", amount: -87, method: "Card", at: "28 Sep, 10:40 AM", ride: "RD1287" },
  { id: "TX9008", kind: "Driver Payout", who: "Suresh Pal", amount: -6420, method: "Bank", at: "28 Sep, 09:00 AM" },
  { id: "TX9007", kind: "Refund", who: "Priya Mehta", amount: -166, method: "UPI", at: "27 Sep, 07:30 PM", ride: "RD1282" },
  { id: "TX9006", kind: "Ride Fare", who: "Kavya Iyer", amount: 945, method: "Card", at: "26 Sep, 07:36 AM", ride: "RD1280" },
  { id: "TX9005", kind: "Driver Payout", who: "Rohit Kumar", amount: -12840, method: "Bank", at: "22 Sep, 09:00 AM" },
];

/* ───────────── Rider panel (the person driving) ───────────── */

/** High-demand zones shown to riders who are online. */
export interface Hotspot { id: string; area: string; km: number; surge: number; waiting: number }

export const HOTSPOTS: Hotspot[] = [
  { id: "hs1", area: "Sector 18 Market, Noida", km: 1.4, surge: 1.5, waiting: 23 },
  { id: "hs2", area: "Botanical Garden Metro", km: 2.1, surge: 1.3, waiting: 17 },
  { id: "hs3", area: "Great India Place", km: 2.8, surge: 1.2, waiting: 11 },
  { id: "hs4", area: "Film City, Sector 16A", km: 3.5, surge: 1.1, waiting: 6 },
];

/** Incentive programmes. `kind` decides which counter moves the progress bar. */
export interface Incentive { id: string; title: string; body: string; target: number; reward: number; kind: "today" | "week" | "peak"; ends: string }

export const INCENTIVES: Incentive[] = [
  { id: "in1", title: "Daily Target", body: "Complete 5 trips today", target: 5, reward: 500, kind: "today", ends: "Ends 11:59 PM" },
  { id: "in2", title: "Peak Hour Hero", body: "3 trips between 6 PM – 9 PM", target: 3, reward: 250, kind: "peak", ends: "Today, 6 – 9 PM" },
  { id: "in3", title: "Weekly Streak", body: "Complete 60 trips this week", target: 60, reward: 2000, kind: "week", ends: "Ends Sun, 5 Oct" },
];

export type WalletKind = "Trip Earning" | "Cash Commission" | "Incentive" | "Payout" | "Dues Paid";

export interface WalletTxn { id: string; kind: WalletKind; note: string; amount: number; at: string }

export const RIDER_WALLET: WalletTxn[] = [
  { id: "WT311", kind: "Trip Earning", note: "Ride RD1289 · UPI", amount: 128, at: "Today, 10:54 AM" },
  { id: "WT310", kind: "Cash Commission", note: "Ride RD1283 · 20% of ₹182", amount: -36, at: "Yesterday, 07:24 PM" },
  { id: "WT309", kind: "Incentive", note: "Daily Target bonus", amount: 500, at: "Yesterday, 11:59 PM" },
  { id: "WT308", kind: "Payout", note: "Weekly settlement · HDFC ••4521", amount: -12840, at: "22 Sep, 09:00 AM" },
];

/** Feedback customers left for the signed-in rider. */
export const RIDER_FEEDBACK = [
  { who: "Amit S.", stars: 5, text: "Very polite and drove safely. Car was spotless.", at: "Today" },
  { who: "Rahul V.", stars: 5, text: "Reached on time, knew a shortcut through traffic.", at: "Yesterday" },
  { who: "Neha G.", stars: 4, text: "Good ride, AC could have been cooler.", at: "25 Sep" },
];
