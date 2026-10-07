-- DriveWay: complete database setup in ONE run (Supabase -> SQL Editor -> paste this whole file -> Run).
-- Same as running setup.sql and then migrations 0002 to 0007 in order.
-- WARNING: drops and recreates the DriveWay tables. Use on a fresh database only, never once there is real data.


-- ================= setup.sql =================
-- One-shot setup for a FRESH DriveWay database: clears any partial run, creates the schema, loads sample data.
-- ⚠ Drops the DriveWay tables — do not run once there is real data.
drop table if exists ticket_notes, tickets, wallet_txns, transactions, feedback, rides, places, drivers, customers,
  incentives, hotspots, coupons, parcel_weights, vehicles cascade;
drop type if exists vehicle_kind, service_kind, ride_status, pay_method, kyc_status, parcel_type, ticket_status,
  ticket_role, txn_kind, txn_method, wallet_kind, incentive_kind, place_kind cascade;

-- DriveWay schema — mirrors the shapes in app/lib/data.ts.
-- Run this whole file in Supabase → SQL Editor, then run supabase/seed.sql.

-- ───────────── Enums ─────────────
create type vehicle_kind   as enum ('bike', 'auto', 'mini', 'sedan', 'suv');
create type service_kind   as enum ('ride', 'parcel');
create type ride_status    as enum ('Searching', 'Assigned', 'Arriving', 'Arrived', 'Started', 'Completed', 'Cancelled', 'Scheduled');
create type pay_method     as enum ('UPI', 'Cash', 'Card', 'Wallet');
create type kyc_status     as enum ('Approved', 'Pending', 'Rejected');
create type parcel_type    as enum ('Documents', 'Food', 'Clothes', 'Electronics', 'Groceries', 'Medicines', 'Other');
create type ticket_status  as enum ('Open', 'In Progress', 'Resolved');
create type ticket_role    as enum ('Customer', 'Driver');
create type txn_kind       as enum ('Ride Fare', 'Commission', 'Driver Payout', 'Refund');
create type txn_method     as enum ('UPI', 'Cash', 'Card', 'Wallet', 'Bank');
create type wallet_kind    as enum ('Trip Earning', 'Cash Commission', 'Incentive', 'Payout', 'Dues Paid');
create type incentive_kind as enum ('today', 'week', 'peak');
create type place_kind     as enum ('home', 'work', 'recent');

-- ───────────── Catalog (admin-managed pricing & config) ─────────────
create table vehicles (
  id            vehicle_kind primary key,
  name          text    not null,
  tagline       text    not null default '',
  seats         int     not null,
  base          numeric not null,  -- ₹ base fare
  per_km        numeric not null,  -- ₹ per km
  per_min       numeric not null,  -- ₹ per minute
  min_fare      numeric not null,
  cancel_fee    numeric not null,
  eta           int     not null,  -- minutes to pickup
  enabled       boolean not null default true,
  ac_option     boolean not null default false,  -- offered as both AC and Non-AC
  parcel_max_kg int     not null default 0,      -- 0 = no parcels
  sort          int     not null default 0
);

create table parcel_weights (
  id    text primary key,
  label text    not null,
  kg    numeric not null,
  extra numeric not null,  -- handling charge on top of the distance fare
  sort  int     not null default 0
);

create table coupons (
  code       text primary key,
  title      text    not null,
  body       text    not null default '',
  off        numeric not null,
  pct        boolean not null default false,
  max        numeric,
  expires    date    not null,
  uses       int     not null default 0,
  active     boolean not null default true
);

create table hotspots (
  id      text primary key,
  area    text    not null,
  km      numeric not null,
  surge   numeric not null default 1,
  waiting int     not null default 0
);

create table incentives (
  id     text primary key,
  title  text           not null,
  body   text           not null default '',
  target int            not null,
  reward numeric        not null,
  kind   incentive_kind not null,
  ends   text           not null
);

-- ───────────── People ─────────────
-- user_id links a row to a Supabase Auth account once sign-in is wired up.
create table customers (
  id         text primary key,
  user_id    uuid unique references auth.users (id) on delete set null,
  name       text    not null,
  phone      text    not null unique,
  email      text,
  rating     numeric not null default 5,
  blocked    boolean not null default false,
  complaints int     not null default 0,
  joined     timestamptz not null default now()
);

create table drivers (
  id        text primary key,
  user_id   uuid unique references auth.users (id) on delete set null,
  name      text         not null,
  phone     text         not null unique,
  rating    numeric      not null default 0,
  vehicle   vehicle_kind not null references vehicles (id),
  model     text         not null,
  plate     text         not null unique,
  city      text         not null,
  kyc       kyc_status   not null default 'Pending',
  online    boolean      not null default false,
  suspended boolean      not null default false,
  joined    timestamptz  not null default now()
);

create table places (
  id          uuid primary key default gen_random_uuid(),
  customer_id text not null references customers (id) on delete cascade,
  name        text not null,
  address     text not null,
  kind        place_kind,
  created_at  timestamptz not null default now()
);

-- ───────────── Trips ─────────────
create table rides (
  id            text primary key,
  service       service_kind not null default 'ride',
  customer_id   text         not null references customers (id),
  driver_id     text         references drivers (id),
  vehicle       vehicle_kind not null references vehicles (id),
  ac            boolean,     -- only for AC-optional vehicles
  from_address  text         not null,
  to_address    text         not null,
  km            numeric      not null,
  min           int          not null,
  fare          numeric      not null,
  discount      numeric      not null default 0,
  coupon_code   text         references coupons (code),
  pay           pay_method   not null,
  paid          boolean      not null default false,
  status        ride_status  not null default 'Searching',
  otp           text,
  rating        int          check (rating between 1 and 5),
  cancel_reason text,
  -- parcel details (service = 'parcel')
  parcel_type           parcel_type,
  parcel_weight         text references parcel_weights (id),
  parcel_receiver       text,
  parcel_receiver_phone text,
  parcel_note           text,
  created_at    timestamptz not null default now()
);
create index rides_customer_idx on rides (customer_id, created_at desc);
create index rides_driver_idx   on rides (driver_id, created_at desc);
create index rides_status_idx   on rides (status);

create table feedback (
  id         uuid primary key default gen_random_uuid(),
  ride_id    text references rides (id) on delete set null,
  driver_id  text not null references drivers (id) on delete cascade,
  customer_id text references customers (id) on delete set null,
  stars      int  not null check (stars between 1 and 5),
  text       text not null default '',
  created_at timestamptz not null default now()
);

-- ───────────── Money ─────────────
create table transactions (
  id         text primary key,
  kind       txn_kind   not null,
  who        text       not null,  -- display name of customer / driver
  amount     numeric    not null,  -- negative = money out
  method     txn_method not null,
  ride_id    text references rides (id) on delete set null,
  created_at timestamptz not null default now()
);

create table wallet_txns (
  id         text primary key,
  driver_id  text        not null references drivers (id) on delete cascade,
  kind       wallet_kind not null,
  note       text        not null default '',
  amount     numeric     not null,
  created_at timestamptz not null default now()
);

-- ───────────── Support ─────────────
create table tickets (
  id         text primary key,
  from_name  text          not null,
  role       ticket_role   not null,
  subject    text          not null,
  ride_id    text references rides (id) on delete set null,
  status     ticket_status not null default 'Open',
  created_at timestamptz   not null default now()
);

create table ticket_notes (
  id         uuid primary key default gen_random_uuid(),
  ticket_id  text not null references tickets (id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now()
);

-- ───────────── Row Level Security ─────────────
-- Everything is locked by default. The service-role key (server code) bypasses RLS.
-- Catalog tables are readable by anyone so the apps can show prices and offers.
alter table vehicles       enable row level security;
alter table parcel_weights enable row level security;
alter table coupons        enable row level security;
alter table hotspots       enable row level security;
alter table incentives     enable row level security;
alter table customers      enable row level security;
alter table drivers        enable row level security;
alter table places         enable row level security;
alter table rides          enable row level security;
alter table feedback       enable row level security;
alter table transactions   enable row level security;
alter table wallet_txns    enable row level security;
alter table tickets        enable row level security;
alter table ticket_notes   enable row level security;

create policy "public read" on vehicles       for select using (true);
create policy "public read" on parcel_weights for select using (true);
create policy "public read" on coupons        for select using (active);
create policy "public read" on hotspots       for select using (true);
create policy "public read" on incentives     for select using (true);

-- Sample data from app/lib/data.ts. Run after migrations/0001_schema.sql.
-- Generated — re-running fails on duplicate keys; truncate tables first if needed.

insert into vehicles (id, name, tagline, seats, base, per_km, per_min, min_fare, cancel_fee, eta, enabled, ac_option, parcel_max_kg, sort) values
  ('bike', 'Bike', 'Beat the traffic', 1, 20, 6, 1, 30, 15, 2, true, false, 10, 0),
  ('auto', 'Auto', 'No bargaining', 3, 30, 10, 1.5, 45, 20, 4, true, false, 50, 1),
  ('mini', 'Mini', 'Compact hatchbacks', 4, 45, 12, 2, 80, 30, 5, true, true, 100, 2),
  ('sedan', 'Sedan', 'Comfy rides, extra legroom', 4, 60, 15, 2, 110, 40, 6, true, true, 0, 3),
  ('suv', 'XL', 'Extra legroom, 6 seats + luggage', 6, 90, 20, 2.5, 160, 50, 8, true, true, 0, 4);

insert into parcel_weights (id, label, kg, extra, sort) values
  ('w1', 'Up to 1 kg', 1, 0, 0),
  ('w5', '1 – 5 kg', 5, 10, 1),
  ('w10', '5 – 10 kg', 10, 25, 2),
  ('w20', '10 – 20 kg', 20, 45, 3),
  ('w50', '20 – 50 kg', 50, 80, 4);

insert into coupons (code, title, body, off, pct, max, expires, uses, active) values
  ('FIRST50', '50% off your first ride', 'Up to ₹100 off on any vehicle', 50, true, 100, '2026-10-31', 1284, true),
  ('AUTO20', 'Flat ₹20 off on Auto', 'Valid on Auto rides above ₹80', 20, false, null, '2026-10-15', 642, true),
  ('WEEKEND', '15% off weekend rides', 'Sat & Sun · up to ₹75 off', 15, true, 75, '2026-11-30', 311, true),
  ('AIRPORT99', '₹99 off airport drops', 'Sedan & XL to IGI Airport', 99, false, null, '2026-12-31', 87, false);

insert into hotspots (id, area, km, surge, waiting) values
  ('hs1', 'Sector 18 Market, Noida', 1.4, 1.5, 23),
  ('hs2', 'Botanical Garden Metro', 2.1, 1.3, 17),
  ('hs3', 'Great India Place', 2.8, 1.2, 11),
  ('hs4', 'Film City, Sector 16A', 3.5, 1.1, 6);

insert into incentives (id, title, body, target, reward, kind, ends) values
  ('in1', 'Daily Target', 'Complete 5 trips today', 5, 500, 'today', 'Ends 11:59 PM'),
  ('in2', 'Peak Hour Hero', '3 trips between 6 PM – 9 PM', 3, 250, 'peak', 'Today, 6 – 9 PM'),
  ('in3', 'Weekly Streak', 'Complete 60 trips this week', 60, 2000, 'week', 'Ends Sun, 5 Oct');

insert into customers (id, name, phone, email, rating, blocked, complaints, joined) values
  ('CUS2001', 'Amit Sharma', '+91 98765 43210', 'amit.sharma@gmail.com', 4.9, false, 0, '2026-02-02 00:00:00+05:30'),
  ('CUS2002', 'Priya Mehta', '+91 87654 32109', 'priya.m@outlook.com', 4.7, false, 1, '2026-03-19 00:00:00+05:30'),
  ('CUS2003', 'Neha Gupta', '+91 76543 21098', 'neha.gupta@yahoo.in', 4.8, false, 0, '2026-04-07 00:00:00+05:30'),
  ('CUS2004', 'Vikash Singh', '+91 65432 10987', 'vikash.s@gmail.com', 4.1, true, 2, '2026-05-22 00:00:00+05:30'),
  ('CUS2005', 'Kavya Iyer', '+91 99887 76655', 'kavya.iyer@gmail.com', 5, false, 0, '2026-01-11 00:00:00+05:30'),
  ('CUS2006', 'Rahul Verma', '+91 91234 56780', 'rahul.v@gmail.com', 4.5, false, 0, '2026-06-30 00:00:00+05:30');

insert into drivers (id, name, phone, rating, vehicle, model, plate, city, kyc, online, suspended, joined) values
  ('DRV1001', 'Rohit Kumar', '+91 98100 12345', 4.8, 'sedan', 'Maruti Dzire · White', 'UP16 AB 1234', 'Noida', 'Approved', true, false, '2026-01-12 00:00:00+05:30'),
  ('DRV1002', 'Suresh Pal', '+91 98111 45678', 4.6, 'auto', 'Bajaj RE · Green', 'DL 1C 5678', 'Delhi', 'Approved', true, false, '2026-02-03 00:00:00+05:30'),
  ('DRV1003', 'Rakesh Das', '+91 98222 90120', 4.2, 'mini', 'Hyundai i10 · Grey', 'BR01 CD 9012', 'Noida', 'Approved', false, false, '2026-03-20 00:00:00+05:30'),
  ('DRV1004', 'Manoj Tiwari', '+91 98333 34560', 4.9, 'suv', 'Toyota Innova · Silver', 'UP32 EF 3456', 'Lucknow', 'Approved', true, false, '2025-11-08 00:00:00+05:30'),
  ('DRV1005', 'Imran Khan', '+91 98444 11223', 4.7, 'bike', 'Honda Shine · Black', 'DL 3S AB 1122', 'Delhi', 'Approved', true, false, '2026-04-14 00:00:00+05:30'),
  ('DRV1006', 'Vikram Singh', '+91 98555 66778', 0, 'sedan', 'Honda Amaze · Blue', 'HR26 GH 6677', 'Gurugram', 'Pending', false, false, '2026-09-26 00:00:00+05:30'),
  ('DRV1007', 'Arjun Yadav', '+91 98666 22334', 0, 'auto', 'Piaggio Ape · Yellow', 'UP16 JK 2233', 'Noida', 'Pending', false, false, '2026-09-27 00:00:00+05:30'),
  ('DRV1008', 'Deepak Sharma', '+91 98777 88990', 3.9, 'mini', 'Maruti Swift · Red', 'DL 8C LM 8899', 'Delhi', 'Approved', false, true, '2026-06-02 00:00:00+05:30');

insert into places (customer_id, name, address, kind) values
  ('CUS2001', 'Home', 'B-42, Sector 62, Noida', 'home'),
  ('CUS2001', 'Work', 'Tower C, Cyber City, Gurugram', 'work'),
  ('CUS2001', 'DLF Mall of India', 'Sector 18, Noida', 'recent'),
  ('CUS2001', 'IGI Airport T3', 'New Delhi 110037', 'recent'),
  ('CUS2001', 'Connaught Place', 'Rajiv Chowk, New Delhi', null),
  ('CUS2001', 'Botanical Garden Metro', 'Sector 38, Noida', null),
  ('CUS2001', 'Akshardham Temple', 'NH 24, New Delhi', null),
  ('CUS2001', 'Great India Place', 'Sector 38A, Noida', null);

insert into rides (id, service, customer_id, driver_id, vehicle, ac, from_address, to_address, km, min, fare, discount, coupon_code, pay, paid, status, rating, cancel_reason, parcel_type, parcel_weight, parcel_receiver, parcel_receiver_phone, parcel_note, created_at) values
  ('PD1291', 'parcel', 'CUS2006', 'DRV1005', 'bike', null, 'Sector 29, Gurugram', 'Cyber City, Gurugram', 4.8, 15, 62, 0, null, 'UPI', true, 'Started', null, null, 'Documents', 'w1', 'Sneha Verma', '+91 98100 77881', null, '2026-09-28 10:50:00+05:30'),
  ('PD1290', 'parcel', 'CUS2005', 'DRV1002', 'auto', null, 'Sector 18, Noida', 'Okhla, Delhi', 9.4, 29, 196, 0, null, 'Cash', true, 'Completed', 5, null, 'Groceries', 'w20', 'Lata Iyer', '+91 98111 22334', 'Ring the bell twice', '2026-09-28 09:15:00+05:30'),
  ('RD1289', 'ride', 'CUS2001', 'DRV1001', 'sedan', true, 'Sector 12, Noida', 'DLF Mall of India', 4.2, 16, 160, 0, null, 'UPI', true, 'Completed', 5, null, null, null, null, null, null, '2026-09-28 10:38:00+05:30'),
  ('RD1288', 'ride', 'CUS2002', 'DRV1002', 'auto', null, 'Botanical Garden Metro', 'Sector 62, Noida', 6.8, 22, 132, 0, null, 'Cash', false, 'Started', null, null, null, null, null, null, null, '2026-09-28 10:21:00+05:30'),
  ('RD1287', 'ride', 'CUS2003', 'DRV1004', 'suv', true, 'Connaught Place', 'IGI Airport T3', 16.4, 46, 533, 99, 'AIRPORT99', 'Card', true, 'Completed', 4, null, null, null, null, null, null, '2026-09-28 09:52:00+05:30'),
  ('RD1286', 'ride', 'CUS2004', 'DRV1003', 'mini', false, 'Great India Place', 'Akshardham Temple', 9.1, 28, 180, 0, null, 'Cash', false, 'Cancelled', null, 'Driver taking too long', null, null, null, null, null, '2026-09-28 09:40:00+05:30'),
  ('RD1285', 'ride', 'CUS2005', 'DRV1005', 'bike', null, 'Sector 18, Noida', 'Sector 50, Noida', 5.3, 14, 66, 0, null, 'UPI', true, 'Arriving', null, null, null, null, null, null, null, '2026-09-28 10:44:00+05:30'),
  ('RD1284', 'ride', 'CUS2001', 'DRV1002', 'auto', null, 'Yesterday · Noida', 'Okhla, Delhi', 11.2, 34, 240, 20, 'AUTO20', 'Wallet', true, 'Completed', 4, null, null, null, null, null, null, '2026-09-27 20:20:00+05:30'),
  ('RD1283', 'ride', 'CUS2006', 'DRV1001', 'sedan', false, 'Cyber City, Gurugram', 'Sector 29, Gurugram', 5.6, 19, 182, 0, null, 'UPI', true, 'Completed', 5, null, null, null, null, null, null, '2026-09-27 19:05:00+05:30'),
  ('RD1282', 'ride', 'CUS2002', 'DRV1008', 'mini', true, 'Lajpat Nagar', 'Saket', 6.1, 24, 166, 0, null, 'Cash', true, 'Completed', 3, null, null, null, null, null, null, '2026-09-27 17:48:00+05:30'),
  ('RD1281', 'ride', 'CUS2003', 'DRV1005', 'bike', null, 'Sector 62, Noida', 'Sector 15, Noida', 7.2, 18, 81, 0, null, 'UPI', true, 'Completed', 5, null, null, null, null, null, null, '2026-09-26 09:12:00+05:30'),
  ('RD1280', 'ride', 'CUS2005', 'DRV1004', 'suv', true, 'Home', 'Jewar Airport', 38.5, 64, 1020, 75, 'WEEKEND', 'Card', true, 'Completed', 5, null, null, null, null, null, null, '2026-09-26 06:30:00+05:30'),
  ('RD1270', 'ride', 'CUS2001', 'DRV1004', 'suv', true, 'Airport T3', 'Home', 34, 58, 380, 0, null, 'Card', true, 'Completed', 5, null, null, null, null, null, null, '2026-09-18 23:15:00+05:30'),
  ('PD1276', 'parcel', 'CUS2001', 'DRV1005', 'bike', null, 'Home', 'Work', 21, 52, 182, 0, null, 'UPI', true, 'Completed', 5, null, 'Documents', 'w1', 'Ravi (Reception)', '+91 99990 12345', null, '2026-09-22 13:10:00+05:30'),
  ('RD1262', 'ride', 'CUS2001', 'DRV1005', 'bike', null, 'Work', 'Botanical Garden', 6.4, 17, 70, 0, null, 'Cash', true, 'Cancelled', null, 'Changed my plans', null, null, null, null, null, '2026-09-12 18:40:00+05:30');

insert into feedback (driver_id, customer_id, stars, text, created_at) values
  ('DRV1001', 'CUS2001', 5, 'Very polite and drove safely. Car was spotless.', '2026-09-28 00:00:00+05:30'),
  ('DRV1001', 'CUS2006', 5, 'Reached on time, knew a shortcut through traffic.', '2026-09-27 00:00:00+05:30'),
  ('DRV1001', 'CUS2003', 4, 'Good ride, AC could have been cooler.', '2026-09-25 00:00:00+05:30');

insert into transactions (id, kind, who, amount, method, ride_id, created_at) values
  ('TX9012', 'Ride Fare', 'Amit Sharma', 160, 'UPI', 'RD1289', '2026-09-28 10:54:00+05:30'),
  ('TX9011', 'Commission', 'Rohit Kumar', -32, 'UPI', 'RD1289', '2026-09-28 10:54:00+05:30'),
  ('TX9010', 'Ride Fare', 'Neha Gupta', 434, 'Card', 'RD1287', '2026-09-28 10:40:00+05:30'),
  ('TX9009', 'Commission', 'Manoj Tiwari', -87, 'Card', 'RD1287', '2026-09-28 10:40:00+05:30'),
  ('TX9008', 'Driver Payout', 'Suresh Pal', -6420, 'Bank', null, '2026-09-28 09:00:00+05:30'),
  ('TX9007', 'Refund', 'Priya Mehta', -166, 'UPI', 'RD1282', '2026-09-27 19:30:00+05:30'),
  ('TX9006', 'Ride Fare', 'Kavya Iyer', 945, 'Card', 'RD1280', '2026-09-26 07:36:00+05:30'),
  ('TX9005', 'Driver Payout', 'Rohit Kumar', -12840, 'Bank', null, '2026-09-22 09:00:00+05:30');

insert into wallet_txns (id, driver_id, kind, note, amount, created_at) values
  ('WT311', 'DRV1001', 'Trip Earning', 'Ride RD1289 · UPI', 128, '2026-09-28 10:54:00+05:30'),
  ('WT310', 'DRV1001', 'Cash Commission', 'Ride RD1283 · 20% of ₹182', -36, '2026-09-27 19:24:00+05:30'),
  ('WT309', 'DRV1001', 'Incentive', 'Daily Target bonus', 500, '2026-09-27 23:59:00+05:30'),
  ('WT308', 'DRV1001', 'Payout', 'Weekly settlement · HDFC ••4521', -12840, '2026-09-22 09:00:00+05:30');

insert into tickets (id, from_name, role, subject, ride_id, status, created_at) values
  ('TK501', 'Priya Mehta', 'Customer', 'Charged twice for ride RD1282', 'RD1282', 'Open', '2026-09-28 09:10:00+05:30'),
  ('TK500', 'Suresh Pal', 'Driver', 'Payout for 21–27 Sep not received', null, 'In Progress', '2026-09-27 18:44:00+05:30'),
  ('TK499', 'Vikash Singh', 'Customer', 'Driver was rude, cancelled ride', 'RD1286', 'Open', '2026-09-27 15:20:00+05:30'),
  ('TK498', 'Kavya Iyer', 'Customer', 'Left my umbrella in the XL', 'RD1280', 'Resolved', '2026-09-26 10:02:00+05:30');

insert into ticket_notes (ticket_id, body) values
  ('TK500', 'Checked with finance — settlement batch runs Monday.'),
  ('TK498', 'Driver returned the item on 26 Sep.');



-- ================= 0002_auth.sql =================
-- Step 3: customer & rider sign-in (Supabase phone OTP) with row-level security.
-- Run this whole file in Supabase → SQL Editor after 0001_schema.sql + seed.sql.
-- Safe to re-run.

-- ───────────── IDs for rows the apps create ─────────────
create sequence if not exists customer_seq start 3001;
create sequence if not exists driver_seq start 1101;
alter table customers alter column id set default 'CUS' || nextval('customer_seq');
alter table drivers   alter column id set default 'DRV' || nextval('driver_seq');
grant usage on sequence customer_seq, driver_seq to authenticated;

-- ───────────── Helpers ─────────────
-- Phone numbers are compared by digits only: "+91 98765 43210" = "919876543210" (how auth.users stores it).
create or replace function public.digits(t text) returns text
language sql immutable as $$ select regexp_replace(coalesce(t, ''), '\D', '', 'g') $$;

-- The verified phone of the signed-in user, as digits.
create or replace function public.my_phone() returns text
language sql stable security definer set search_path = public, auth as $$
  select public.digits(phone) from auth.users where id = auth.uid()
$$;

create or replace function public.my_customer_id() returns text
language sql stable security definer set search_path = public as $$
  select id from customers where user_id = auth.uid()
$$;

create or replace function public.my_driver_id() returns text
language sql stable security definer set search_path = public as $$
  select id from drivers where user_id = auth.uid()
$$;

-- Links customer/driver rows that were created before sign-up (seed data, or added by an admin)
-- to the signed-in user when the verified phone matches. Called by the apps right after OTP.
create or replace function public.claim_profiles() returns void
language plpgsql security definer set search_path = public as $$
declare p text := public.my_phone();
begin
  if auth.uid() is null or coalesce(p, '') = '' then return; end if;
  update customers set user_id = auth.uid() where user_id is null and public.digits(phone) = p;
  update drivers   set user_id = auth.uid() where user_id is null and public.digits(phone) = p;
end $$;

revoke execute on function public.my_phone(), public.my_customer_id(), public.my_driver_id(), public.claim_profiles() from public, anon;
grant  execute on function public.my_phone(), public.my_customer_id(), public.my_driver_id(), public.claim_profiles() to authenticated;

-- ───────────── Column privileges ─────────────
-- Signed-in users may only write the columns listed here; everything else (blocked, kyc, suspended,
-- rating, …) stays admin-only. Reads are still filtered row by row by the policies below.
revoke insert, update, delete on customers, drivers, places, rides, feedback, wallet_txns, transactions, tickets, ticket_notes from anon, authenticated;
grant insert (user_id, name, phone, email) on customers to authenticated;
grant update (name, email)                 on customers to authenticated;
grant insert (user_id, name, phone, vehicle, model, plate, city) on drivers to authenticated;
grant update (online)                                           on drivers to authenticated;
grant insert, update, delete on places to authenticated;

-- ───────────── Policies ─────────────
-- Customers: their own row; riders also see the customers they have driven.
drop policy if exists "own row" on customers;
create policy "own row" on customers for select to authenticated using (user_id = auth.uid());
drop policy if exists "riders see their passengers" on customers;
create policy "riders see their passengers" on customers for select to authenticated
  using (exists (select 1 from rides r where r.customer_id = customers.id and r.driver_id = public.my_driver_id()));
drop policy if exists "sign up" on customers;
create policy "sign up" on customers for insert to authenticated
  with check (user_id = auth.uid() and public.digits(phone) = public.my_phone());
drop policy if exists "edit own profile" on customers;
create policy "edit own profile" on customers for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Drivers: their own row; customers also see the drivers who drove them.
drop policy if exists "own row" on drivers;
create policy "own row" on drivers for select to authenticated using (user_id = auth.uid());
drop policy if exists "customers see their drivers" on drivers;
create policy "customers see their drivers" on drivers for select to authenticated
  using (exists (select 1 from rides r where r.driver_id = drivers.id and r.customer_id = public.my_customer_id()));
drop policy if exists "register" on drivers;
create policy "register" on drivers for insert to authenticated
  with check (user_id = auth.uid() and public.digits(phone) = public.my_phone());
-- Only approved, non-suspended riders can go online.
drop policy if exists "go online" on drivers;
create policy "go online" on drivers for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and (online = false or (kyc = 'Approved' and suspended = false)));

-- Saved places: only the ones the customer owns.
drop policy if exists "own places" on places;
create policy "own places" on places for all to authenticated
  using (customer_id = public.my_customer_id()) with check (customer_id = public.my_customer_id());

-- Rides: visible to the customer who booked and the driver who drove. (Creating and updating rides
-- from the apps comes with the live ride flow.)
drop policy if exists "own rides" on rides;
create policy "own rides" on rides for select to authenticated
  using (customer_id = public.my_customer_id() or driver_id = public.my_driver_id());

-- Rider wallet and feedback: only the ones the rider owns.
drop policy if exists "own wallet" on wallet_txns;
create policy "own wallet" on wallet_txns for select to authenticated using (driver_id = public.my_driver_id());
drop policy if exists "own feedback" on feedback;
create policy "own feedback" on feedback for select to authenticated using (driver_id = public.my_driver_id());


-- ================= 0003_settings.sql =================
-- Platform settings and broadcast announcements, managed from the admin panel.
-- Safe to re-run. (Comments avoid apostrophes: the Supabase SQL editor has tripped on them.)

create table if not exists app_settings (
  id             int primary key default 1 check (id = 1),
  commission_pct numeric not null default 20 check (commission_pct between 0 and 100),
  surge_on       boolean not null default true,
  surge_mult     numeric not null default 1.3 check (surge_mult between 1 and 5),
  cash           boolean not null default true,
  online         boolean not null default true,
  auto_assign    boolean not null default true,
  sos            boolean not null default true,
  scheduled      boolean not null default false,
  maintenance    boolean not null default false,
  service_areas  jsonb   not null default '[{"city":"Noida","active":true},{"city":"Delhi","active":true},{"city":"Gurugram","active":true},{"city":"Lucknow","active":true},{"city":"Ghaziabad","active":false},{"city":"Faridabad","active":false}]',
  updated_at     timestamptz not null default now()
);
insert into app_settings (id) values (1) on conflict (id) do nothing;

create table if not exists announcements (
  id         uuid primary key default gen_random_uuid(),
  audience   text not null check (audience in ('All customers', 'All drivers', 'Noida only', 'Inactive riders')),
  title      text not null,
  body       text not null,
  created_at timestamptz not null default now()
);

-- The apps read settings (fares, payment options, maintenance) and broadcasts; only the admin writes.
alter table app_settings  enable row level security;
alter table announcements enable row level security;
drop policy if exists "public read" on app_settings;
create policy "public read" on app_settings for select using (true);
drop policy if exists "public read" on announcements;
create policy "public read" on announcements for select using (true);
revoke insert, update, delete on app_settings, announcements from anon, authenticated;

insert into announcements (audience, title, body, created_at)
select * from (values
  ('All customers', 'Weekend offer', 'Use code WEEKEND for 15 percent off Saturday and Sunday rides.', timestamptz '2026-09-27 10:00:00+05:30'),
  ('All drivers',   'Complete 5 rides, get 500', 'Finish 5 trips today to unlock the Daily Target bonus.', timestamptz '2026-09-28 07:00:00+05:30')
) v where not exists (select 1 from announcements);


-- ================= 0004_email_auth.sql =================
-- Step 3b: customers and riders sign up with name, email, mobile and password (Supabase email auth).
-- The mobile number is collected for calls during rides but is not verified, so sign-up policies
-- check ownership (user_id = auth.uid()) instead of matching a verified phone.
-- Safe to re-run. (Comments avoid apostrophes: the Supabase SQL editor has tripped on them.)

alter table drivers add column if not exists email text;

grant insert (user_id, name, phone, email) on customers to authenticated;
grant insert (user_id, name, phone, email, vehicle, model, plate, city) on drivers to authenticated;

drop policy if exists "sign up" on customers;
create policy "sign up" on customers for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "register" on drivers;
create policy "register" on drivers for insert to authenticated
  with check (user_id = auth.uid() and kyc = 'Pending' and online = false and suspended = false);


-- ================= 0005_restore_policies.sql =================
-- Restores the row-level security policies from 0002 that never got created (the diagnostic showed
-- only the customers own-row policy). Simple ownership policies first, cross-table ones last.
-- Safe to re-run. (Comments avoid apostrophes: the Supabase SQL editor has tripped on them.)

drop policy if exists "own row" on drivers;
create policy "own row" on drivers for select to authenticated using (user_id = auth.uid());

drop policy if exists "edit own profile" on customers;
create policy "edit own profile" on customers for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "go online" on drivers;
create policy "go online" on drivers for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and (online = false or (kyc = 'Approved' and suspended = false)));

drop policy if exists "own places" on places;
create policy "own places" on places for all to authenticated
  using (customer_id = public.my_customer_id()) with check (customer_id = public.my_customer_id());

drop policy if exists "own rides" on rides;
create policy "own rides" on rides for select to authenticated
  using (customer_id = public.my_customer_id() or driver_id = public.my_driver_id());

drop policy if exists "own wallet" on wallet_txns;
create policy "own wallet" on wallet_txns for select to authenticated using (driver_id = public.my_driver_id());

drop policy if exists "own feedback" on feedback;
create policy "own feedback" on feedback for select to authenticated using (driver_id = public.my_driver_id());

drop policy if exists "riders see their passengers" on customers;
create policy "riders see their passengers" on customers for select to authenticated
  using (exists (select 1 from rides r where r.customer_id = customers.id and r.driver_id = public.my_driver_id()));

drop policy if exists "customers see their drivers" on drivers;
create policy "customers see their drivers" on drivers for select to authenticated
  using (exists (select 1 from rides r where r.driver_id = drivers.id and r.customer_id = public.my_customer_id()));


-- ================= 0006_live_rides.sql =================
-- Live rides: customer bookings are saved and offered to one available rider at a time.
-- Server actions do the reads and writes (service-role key, after checking the caller), so no new
-- policies are needed. Safe to re-run. (Comments avoid apostrophes: the SQL editor has tripped on them.)

alter table rides add column if not exists offered_to       text references drivers (id) on delete set null;
alter table rides add column if not exists offer_expires_at timestamptz;
alter table rides add column if not exists declined_by      text[] not null default '{}';
alter table rides add column if not exists wait_fee         numeric not null default 0;

-- New bookings get RDnnnn (rides) or PDnnnn (parcels) ids.
create sequence if not exists ride_seq start 2001;
create or replace function public.set_ride_id() returns trigger language plpgsql as $$
begin
  if new.id is null then
    new.id := (case when new.service = 'parcel' then 'PD' else 'RD' end) || nextval('ride_seq');
  end if;
  return new;
end $$;
drop trigger if exists set_ride_id on rides;
create trigger set_ride_id before insert on rides for each row execute function public.set_ride_id();

create index if not exists rides_offered_idx on rides (offered_to) where status = 'Searching';
create index if not exists rides_active_driver_idx on rides (driver_id) where status in ('Assigned', 'Arriving', 'Arrived', 'Started');


-- ================= 0007_integrity.sql =================
-- QA audit fixes B1 to B4: database rules that make duplicate money records, double assignment,
-- double booking and OTP disclosure impossible, whatever the application code does.
-- Safe to re-run. (Comments avoid apostrophes: the Supabase SQL editor has tripped on them.)

-- B1: one wallet entry and one platform transaction of each kind per ride.
alter table wallet_txns add column if not exists ride_id text references rides (id) on delete set null;
create unique index if not exists wallet_txns_one_per_ride_kind on wallet_txns (ride_id, kind) where ride_id is not null;
create unique index if not exists transactions_one_per_ride_kind on transactions (ride_id, kind) where ride_id is not null;

-- B2 needs existing data to obey the rule first: if a rider has several active rides,
-- keep the newest and close the others as cancelled.
update rides set status = 'Cancelled', cancel_reason = 'Closed during data cleanup: rider had another active ride'
where id in (
  select id from (
    select id, row_number() over (partition by driver_id order by created_at desc) as n
    from rides where driver_id is not null and status in ('Assigned', 'Arriving', 'Arrived', 'Started')
  ) ranked where n > 1
);

-- B2: a rider holds at most one live offer and at most one active ride.
create unique index if not exists rides_one_offer_per_rider on rides (offered_to)
  where status = 'Searching' and offered_to is not null;
create unique index if not exists rides_one_active_per_rider on rides (driver_id)
  where status in ('Assigned', 'Arriving', 'Arrived', 'Started');

-- B3: a customer has at most one live booking.
create unique index if not exists rides_one_live_per_customer on rides (customer_id)
  where status in ('Searching', 'Assigned', 'Arriving', 'Arrived', 'Started');

-- B4: signed-in users can read their rides but never the OTP column (the customer gets their
-- OTP from the server; the rider must ask the customer for it).
revoke select on rides from authenticated;
grant select (
  id, service, customer_id, driver_id, vehicle, ac, from_address, to_address, km, min, fare, discount,
  coupon_code, pay, paid, status, rating, cancel_reason, parcel_type, parcel_weight, parcel_receiver,
  parcel_receiver_phone, parcel_note, created_at, wait_fee
) on rides to authenticated;

-- B5: the server measures waiting time from the moment the rider marks arrival.
alter table rides add column if not exists arrived_at timestamptz;

-- B11: wrong ride-OTP attempts are counted; the OTP locks after a few failures.
alter table rides add column if not exists otp_attempts int not null default 0;

-- B7: admin sign-in attempts, for rate limiting (server-only table: RLS on, no policies).
create table if not exists admin_login_attempts (
  id  bigserial primary key,
  ip  text not null,
  ok  boolean not null,
  at  timestamptz not null default now()
);
create index if not exists admin_login_attempts_ip_at on admin_login_attempts (ip, at desc);
alter table admin_login_attempts enable row level security;
revoke all on admin_login_attempts from anon, authenticated;

-- B10: coupon rules the coupon texts promise, now stored as data and enforced by the server.
alter table coupons add column if not exists vehicles        vehicle_kind[];          -- null = any vehicle
alter table coupons add column if not exists min_fare        numeric not null default 0;
alter table coupons add column if not exists first_ride_only boolean not null default false;
alter table coupons add column if not exists weekend_only    boolean not null default false;
alter table coupons add column if not exists per_user_limit  int;                     -- null = no limit
alter table coupons add column if not exists max_uses        int;                     -- null = no limit
update coupons set vehicles = '{auto}', min_fare = 80 where code = 'AUTO20' and vehicles is null;
update coupons set first_ride_only = true, per_user_limit = 1 where code = 'FIRST50';
update coupons set weekend_only = true where code = 'WEEKEND';
update coupons set vehicles = '{sedan,suv}' where code = 'AIRPORT99' and vehicles is null;

-- B13: riders and customers no longer read the full profile rows of each other directly; the server sends
-- only the fields a trip needs (name, phone, rating, vehicle).
drop policy if exists "riders see their passengers" on customers;
drop policy if exists "customers see their drivers" on drivers;

-- B18: when a rider cancels before the trip starts, the ride goes back to searching; this marks when the
-- current search began so the 75-second limit restarts.
alter table rides add column if not exists search_started_at timestamptz;

-- B17: remove the temporary diagnostic and the phone-sign-in helpers that nothing uses any more.
drop function if exists public.debug_rls();
drop function if exists public.claim_profiles();
drop function if exists public.my_phone();
drop function if exists public.digits(text);

