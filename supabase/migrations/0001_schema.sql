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
