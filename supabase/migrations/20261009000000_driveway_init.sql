-- DriveWay — initial schema, access rules and server-side business logic.
--
-- Every write goes through a SECURITY DEFINER function that checks who is calling, the ride's current
-- state and all business rules. Clients get SELECT on their own rows only (RLS) and no direct
-- INSERT/UPDATE/DELETE on any table.
--
-- Run once in the Supabase SQL Editor (or `supabase db push`). Safe to re-run: objects are created
-- with IF NOT EXISTS / OR REPLACE and seed rows use ON CONFLICT DO NOTHING.

set check_function_bodies = off;

-- An earlier prototype created tables with these names but different columns. Drop them only if they are
-- in that old shape (missing a column this schema needs) and empty; never touches data or this schema's tables.
do $$
declare pair text[]; t text; col text; n bigint;
begin
  foreach pair slice 1 in array array[['vehicles','rental_scale'],['coupons','expires_at'],['incentives','active'],['parcel_weights','vehicle']] loop
    t := pair[1]; col := pair[2];
    if to_regclass('public.' || t) is not null
       and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = t and column_name = col) then
      execute format('select count(*) from public.%I', t) into n;
      if n > 0 then raise exception 'public.% is an old table with % rows — move or delete that data first', t, n; end if;
      execute format('drop table public.%I cascade', t);
    end if;
  end loop;
end $$;

-- ───────────────────────────── Reference data ─────────────────────────────

create table if not exists public.settings (
  id boolean primary key default true check (id),
  commission_pct numeric(5,2) not null default 20 check (commission_pct between 0 and 50),
  surge_on boolean not null default false,
  surge_mult numeric(4,2) not null default 1.3 check (surge_mult between 1 and 3),
  non_ac_factor numeric(4,3) not null default 0.85 check (non_ac_factor > 0 and non_ac_factor <= 1),
  free_wait_sec int not null default 180 check (free_wait_sec >= 0),
  wait_fee_per_min int not null default 2 check (wait_fee_per_min >= 0),
  cancel_grace_sec int not null default 0 check (cancel_grace_sec >= 0),
  search_timeout_sec int not null default 90 check (search_timeout_sec between 15 and 900),
  otp_max_attempts int not null default 5 check (otp_max_attempts between 1 and 20),
  driver_heartbeat_sec int not null default 60 check (driver_heartbeat_sec between 10 and 600),
  min_payout int not null default 100 check (min_payout >= 0),
  payout_fee int not null default 5 check (payout_fee >= 0),
  updated_at timestamptz not null default now()
);
insert into public.settings (id) values (true) on conflict do nothing;

create table if not exists public.vehicles (
  id text primary key check (id in ('bike','auto','erick','mini','sedan','taxi','suv')),
  name text not null,
  tagline text not null default '',
  seats int not null check (seats between 1 and 8),
  base int not null check (base >= 0),
  per_km numeric(6,2) not null check (per_km >= 0),
  per_min numeric(6,2) not null check (per_min >= 0),
  min_fare int not null check (min_fare >= 0),
  cancel_fee int not null check (cancel_fee >= 0),
  eta int not null default 5 check (eta between 0 and 60),
  ac boolean not null,
  enabled boolean not null default true,
  rental_scale numeric(4,2) check (rental_scale is null or rental_scale > 0),
  sort int not null default 0,
  updated_at timestamptz not null default now()
);
insert into public.vehicles (id, name, tagline, seats, base, per_km, per_min, min_fare, cancel_fee, eta, ac, rental_scale, sort) values
  ('bike',  'Bike',       'Beat the traffic on a bike',        1, 20,  6, 1,   30,  15, 3, false, null, 1),
  ('auto',  'Auto',       'No bargaining, doorstep pickup',    3, 30, 10, 1.5, 45,  20, 4, false, null, 2),
  ('erick', 'E-Rickshaw', 'Eco-friendly, cheap short hops',    4, 20,  7, 1,   30,  10, 5, false, null, 3),
  ('mini',  'Mini',       'Comfy, economical cars',            4, 45, 12, 2,   80,  30, 7, true,  1,    4),
  ('sedan', 'Sedan',      'Top-rated drivers, more legroom',   4, 60, 15, 2,   110, 40, 6, true,  1.25, 5),
  ('taxi',  'Taxi',       'Classic yellow-top city taxi',      4, 40, 11, 1.5, 70,  25, 6, true,  null, 6),
  ('suv',   'XL',         'Extra legroom, 6 seats + luggage',  6, 90, 20, 2.5, 160, 50, 8, true,  1.6,  7)
on conflict do nothing;

create table if not exists public.places (
  id text primary key check (id ~ '^[a-z0-9_-]{2,30}$'),
  name text not null,
  address text not null,
  kind text check (kind in ('home','work','recent','current'))
);
insert into public.places (id, name, address, kind) values
  ('cur', 'Current location', 'Sector 12, Noida', 'current'),
  ('home', 'Sector 62', 'B-42, Sector 62, Noida', 'recent'),
  ('work', 'Cyber City', 'Tower C, Cyber City, Gurugram', 'recent'),
  ('dlf', 'DLF Mall of India', 'Sector 18, Noida', 'recent'),
  ('airport', 'IGI Airport T3', 'New Delhi 110037', 'recent'),
  ('cp', 'Connaught Place', 'Rajiv Chowk, New Delhi', null),
  ('botanical', 'Botanical Garden Metro', 'Sector 38, Noida', null),
  ('akshardham', 'Akshardham Temple', 'NH 24, New Delhi', null),
  ('gip', 'Great India Place', 'Sector 38A, Noida', null)
on conflict do nothing;

create table if not exists public.rental_packages (
  id text primary key,
  hours int not null check (hours > 0),
  km int not null check (km > 0),
  price int not null check (price > 0),
  extra_km int not null check (extra_km >= 0),
  extra_hour int not null check (extra_hour >= 0)
);
insert into public.rental_packages values
  ('r1', 1, 10, 249, 12, 120), ('r2', 2, 20, 449, 12, 120), ('r4', 4, 40, 849, 12, 110), ('r8', 8, 80, 1599, 12, 100)
on conflict do nothing;

create table if not exists public.parcel_weights (
  id text primary key check (id in ('light','medium','heavy')),
  label text not null, sub text not null,
  vehicle text not null references public.vehicles(id),
  fee int not null check (fee >= 0),
  sort int not null default 0
);
insert into public.parcel_weights values
  ('light', 'Up to 1 kg', 'Documents, keys, small items', 'bike', 0, 1),
  ('medium', '1 – 5 kg', 'Food, clothes, a small box', 'bike', 15, 2),
  ('heavy', '5 – 20 kg', 'Big boxes, appliances', 'auto', 40, 3)
on conflict do nothing;

create table if not exists public.incentives (
  id text primary key,
  title text not null, body text not null,
  kind text not null check (kind in ('today','peak','week')),   -- peak = 6–9 PM IST; week = Monday–Sunday IST
  target int not null check (target > 0),
  reward int not null check (reward >= 0),
  active boolean not null default true,
  sort int not null default 0
);
insert into public.incentives values
  ('daily', 'Daily Target', 'Complete 5 trips today', 'today', 5, 500, true, 1),
  ('peak', 'Peak Hour Hero', '3 trips between 6 PM – 9 PM', 'peak', 3, 250, true, 2),
  ('week', 'Weekly Streak', 'Complete 60 trips this week', 'week', 60, 2000, true, 3)
on conflict do nothing;

-- Trips a driver completed in an incentive's window (IST).
create or replace function public.incentive_progress(p_driver uuid, p_kind text)
returns int language sql stable security definer set search_path = public, pg_temp as $$
  select count(*)::int from public.rides r
  where r.driver_id = p_driver and r.status = 'Completed' and case p_kind
    when 'today' then (r.completed_at at time zone 'Asia/Kolkata')::date = (now() at time zone 'Asia/Kolkata')::date
    when 'peak' then (r.completed_at at time zone 'Asia/Kolkata')::date = (now() at time zone 'Asia/Kolkata')::date
                 and extract(hour from r.completed_at at time zone 'Asia/Kolkata') between 18 and 20
    when 'week' then r.completed_at at time zone 'Asia/Kolkata' >= date_trunc('week', now() at time zone 'Asia/Kolkata')
    else false end
$$;

create table if not exists public.coupons (
  code text primary key check (code ~ '^[A-Z0-9]{3,20}$'),
  title text not null,
  body text not null default '',
  off int not null check (off > 0),
  pct boolean not null default false,
  max_off int check (max_off is null or max_off > 0),
  min_fare int not null default 0 check (min_fare >= 0),
  vehicles text[],                 -- null = any vehicle
  days int[],                      -- 0 = Sunday … 6 = Saturday (IST); null = any day
  dest_places text[],              -- null = any destination
  first_ride_only boolean not null default false,
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  active boolean not null default true,
  total_limit int check (total_limit is null or total_limit > 0),
  per_user_limit int not null default 1 check (per_user_limit > 0),
  uses int not null default 0 check (uses >= 0),
  created_at timestamptz not null default now(),
  check (not pct or off <= 100),
  check (expires_at > starts_at)
);
insert into public.coupons (code, title, body, off, pct, max_off, min_fare, vehicles, days, dest_places, first_ride_only, starts_at, expires_at, active, per_user_limit) values
  ('FIRST50', '50% off your first ride', 'Up to ₹100 off on any vehicle', 50, true, 100, 0, null, null, null, true, '2026-01-01+05:30', '2026-10-31 23:59:59+05:30', true, 1),
  ('AUTO20', 'Flat ₹20 off on Auto', 'Valid on Auto rides above ₹80', 20, false, null, 81, '{auto}', null, null, false, '2026-01-01+05:30', '2026-10-15 23:59:59+05:30', true, 5),
  ('WEEKEND', '15% off weekend rides', 'Sat & Sun · up to ₹75 off', 15, true, 75, 0, null, '{0,6}', null, false, '2026-01-01+05:30', '2026-11-30 23:59:59+05:30', true, 4),
  ('AIRPORT99', '₹99 off airport drops', 'Sedan & XL to IGI Airport', 99, false, null, 0, '{sedan,suv}', null, '{airport}', false, '2026-01-01+05:30', '2026-12-31 23:59:59+05:30', false, 2)
on conflict do nothing;

-- ───────────────────────────── People ─────────────────────────────

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '' check (char_length(name) <= 80),
  email text check (email is null or (char_length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  phone text,
  is_admin boolean not null default false,       -- set only from the SQL editor, never by clients
  blocked boolean not null default false,
  rating numeric(2,1),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.profiles (id, phone, email) values (new.id, new.phone, nullif(new.email, ''))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table if not exists public.drivers (
  id uuid primary key references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  vehicle text not null references public.vehicles(id),
  model text not null check (char_length(model) between 2 and 60),
  plate text not null check (char_length(plate) between 4 and 15),
  ac boolean not null default false,
  city text not null check (city in ('Noida','Delhi','Gurugram','Lucknow')),
  kyc text not null default 'Pending' check (kyc in ('Pending','Approved','Rejected')),
  kyc_note text,
  docs jsonb not null default '{}'::jsonb,
  upi text check (upi is null or upi ~ '^[a-zA-Z0-9._-]{2,64}@[a-zA-Z]{2,32}$'),
  suspended boolean not null default false,
  online boolean not null default false,
  last_seen timestamptz,
  rating numeric(2,1),
  trips int not null default 0,
  offers_accepted int not null default 0,
  offers_declined int not null default 0,
  cancellations int not null default 0,
  created_at timestamptz not null default now(),
  check (ac = false or vehicle not in ('bike','auto','erick'))
);
create unique index if not exists drivers_plate_unique on public.drivers (upper(regexp_replace(plate, '\s', '', 'g')));

-- ───────────────────────────── Rides ─────────────────────────────

create sequence if not exists public.ride_code_seq start 1300;

create table if not exists public.rides (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default ('RD' || nextval('public.ride_code_seq')),
  customer_id uuid not null references public.profiles(id),
  driver_id uuid references public.drivers(id),
  service text not null check (service in ('ride','any','rental','parcel')),
  requested_vehicles text[] not null,
  vehicle text references public.vehicles(id),          -- assigned category (set on accept)
  ac boolean not null default false,
  from_place text not null references public.places(id),
  to_place text not null references public.places(id),
  km numeric(6,1) not null check (km >= 0),
  mins int not null check (mins >= 0),
  fare int not null check (fare >= 0),                    -- quoted fare before discount
  discount int not null default 0 check (discount >= 0),
  coupon_code text references public.coupons(code),
  wait_fee int not null default 0 check (wait_fee >= 0),
  cancel_fee int not null default 0 check (cancel_fee >= 0),
  total int not null default 0 check (total >= 0),        -- amount the customer owes
  pay_method text not null check (pay_method in ('Cash','UPI','Card','Wallet')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','pending','paid','refunded','partially_refunded')),
  refunded int not null default 0 check (refunded >= 0),
  status text not null check (status in ('Scheduled','Searching','Arriving','Arrived','Started','Completed','Cancelled','NoDrivers')),
  scheduled_for timestamptz,
  passenger jsonb,
  parcel jsonb,
  rental jsonb,
  cancel_reason text check (cancel_reason is null or char_length(cancel_reason) <= 200),
  cancelled_by text check (cancelled_by in ('customer','driver','admin','system')),
  rating int check (rating between 1 and 5),
  rating_tags text[],
  customer_rating int check (customer_rating between 1 and 5),
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 64),
  created_at timestamptz not null default now(),
  searching_since timestamptz,
  assigned_at timestamptz, arrived_at timestamptz, started_at timestamptz,
  completed_at timestamptz, cancelled_at timestamptz,
  customer_closed_at timestamptz,                         -- customer has left the finished-ride screen
  driver_closed_at timestamptz,                           -- driver has left the finished-trip screen
  updated_at timestamptz not null default now(),
  unique (customer_id, idempotency_key),
  check (from_place <> to_place),
  check (discount <= fare),
  check (refunded <= total)
);
-- Invariants: one active booking per customer, one active trip per driver.
create unique index if not exists rides_one_active_per_customer on public.rides (customer_id)
  where status in ('Searching','Arriving','Arrived','Started');
create unique index if not exists rides_one_active_per_driver on public.rides (driver_id)
  where status in ('Arriving','Arrived','Started');
create index if not exists rides_searching on public.rides (status, created_at) where status = 'Searching';

create table if not exists public.ride_otps (
  ride_id uuid primary key references public.rides(id) on delete cascade,
  otp text not null check (otp ~ '^\d{4}$'),
  attempts int not null default 0,
  verified_at timestamptz
);

create table if not exists public.ride_events (
  id bigint generated always as identity primary key,
  ride_id uuid not null references public.rides(id) on delete cascade,
  from_status text, to_status text not null,
  actor uuid, at timestamptz not null default now()
);

create table if not exists public.driver_declines (
  ride_id uuid references public.rides(id) on delete cascade,
  driver_id uuid references public.drivers(id) on delete cascade,
  at timestamptz not null default now(),
  primary key (ride_id, driver_id)
);

create table if not exists public.coupon_redemptions (
  ride_id uuid primary key references public.rides(id) on delete cascade,
  code text not null references public.coupons(code),
  user_id uuid not null references public.profiles(id),
  released boolean not null default false,
  created_at timestamptz not null default now()
);

-- Every money movement. `idem` makes each side effect happen at most once.
create table if not exists public.ledger (
  id bigint generated always as identity primary key,
  idem text not null unique,
  ride_id uuid references public.rides(id),
  user_id uuid references public.profiles(id),          -- null = platform
  party text not null check (party in ('customer','driver','platform')),
  kind text not null check (kind in ('payment','wallet_debit','wallet_credit','refund','driver_earning','cash_collected',
                                     'commission','discount','cancel_fee','incentive','payout','payout_fee','dues_paid','adjustment')),
  amount int not null,
  method text,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists ledger_user on public.ledger (user_id, created_at desc);

create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default ('TK' || nextval('public.ride_code_seq')),
  user_id uuid not null references public.profiles(id),
  role text not null check (role in ('Customer','Driver')),
  subject text not null check (char_length(subject) between 1 and 200),
  ride_id uuid references public.rides(id),
  status text not null default 'Open' check (status in ('Open','In Progress','Resolved')),
  notes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  actor uuid, action text not null, target text, details jsonb, at timestamptz not null default now()
);

-- ───────────────────────────── State machine guard ─────────────────────────────

create or replace function public.rides_guard() returns trigger
language plpgsql set search_path = public, pg_temp as $$
declare ok boolean;
begin
  if new.status is distinct from old.status then
    ok := case old.status
      when 'Scheduled' then new.status in ('Searching','Cancelled')
      when 'Searching' then new.status in ('Arriving','Cancelled','NoDrivers')
      when 'Arriving'  then new.status in ('Arrived','Cancelled','Searching')
      when 'Arrived'   then new.status in ('Started','Cancelled','Searching')
      when 'Started'   then new.status in ('Completed')
      else false end;                                   -- Completed / Cancelled / NoDrivers are terminal
    if not ok then raise exception 'invalid ride transition % -> %', old.status, new.status using errcode = 'P0001'; end if;
    insert into public.ride_events (ride_id, from_status, to_status, actor) values (new.id, old.status, new.status, auth.uid());
  end if;
  if new.payment_status is distinct from old.payment_status then
    ok := case old.payment_status
      when 'unpaid' then new.payment_status in ('pending','paid')
      when 'pending' then new.payment_status in ('paid','unpaid')
      when 'paid' then new.payment_status in ('refunded','partially_refunded')
      when 'partially_refunded' then new.payment_status in ('refunded','partially_refunded')
      else false end;
    if not ok then raise exception 'invalid payment transition % -> %', old.payment_status, new.payment_status using errcode = 'P0001'; end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists rides_guard on public.rides;
create trigger rides_guard before update on public.rides for each row execute function public.rides_guard();

-- ───────────────────────────── Helpers ─────────────────────────────

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.require_user() returns uuid
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  return uid;
end $$;

create or replace function public.require_admin() returns uuid
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare uid uuid := public.require_user();
begin
  if not public.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  return uid;
end $$;

create or replace function public.audit(p_action text, p_target text, p_details jsonb) returns void
language sql security definer set search_path = public, pg_temp as $$
  insert into public.audit_log (actor, action, target, details) values (auth.uid(), p_action, p_target, p_details)
$$;

-- Distance/time stand-in until a routing API is wired up. Same pair → same estimate.
create or replace function public.trip_estimate(a text, b text, out km numeric, out mins int)
language plpgsql immutable as $$
declare seed int := 0; ch text; raw numeric;
begin
  if a = b then km := 0; mins := 0; return; end if;
  foreach ch in array regexp_split_to_array(a || b, '') loop seed := seed + ascii(ch); end loop;
  raw := 3 + (seed % 170) / 10.0;
  km := round(raw, 1);
  mins := round(raw * 2.6 + 4)::int;
end $$;

-- Fare with an itemised breakdown whose lines always add up to the total.
create or replace function public.fare_quote(v public.vehicles, p_km numeric, p_mins int, p_ac boolean)
returns jsonb language plpgsql stable set search_path = public, pg_temp as $$
declare s public.settings; b int; d int; t int; sub int; surge_amt int := 0; topup int := 0; nonac int := 0; total int; lines jsonb;
begin
  if p_km is null or p_mins is null or p_km < 0 or p_km > 300 or p_mins < 0 or p_mins > 1440 or p_km = 'NaN'::numeric then
    raise exception 'invalid distance or time' using errcode = '22023';
  end if;
  select * into s from public.settings;
  b := v.base; d := round(v.per_km * p_km); t := round(v.per_min * p_mins);
  sub := b + d + t;
  if s.surge_on and s.surge_mult > 1 then surge_amt := round(sub * s.surge_mult) - sub; end if;
  if sub + surge_amt < v.min_fare then topup := v.min_fare - (sub + surge_amt); end if;
  total := sub + surge_amt + topup;
  if v.ac and not p_ac then nonac := round(total * s.non_ac_factor) - total; total := total + nonac; end if;
  lines := jsonb_build_array(
    jsonb_build_object('label', 'Base fare', 'amount', b),
    jsonb_build_object('label', format('Distance (%s km × ₹%s)', p_km, v.per_km), 'amount', d),
    jsonb_build_object('label', format('Ride time (%s min × ₹%s)', p_mins, v.per_min), 'amount', t));
  if surge_amt <> 0 then lines := lines || jsonb_build_object('label', format('High demand (×%s)', s.surge_mult), 'amount', surge_amt); end if;
  if topup <> 0 then lines := lines || jsonb_build_object('label', format('Minimum fare top-up (min ₹%s)', v.min_fare), 'amount', topup); end if;
  if nonac <> 0 then lines := lines || jsonb_build_object('label', format('Non-AC discount (%s%%)', round((1 - s.non_ac_factor) * 100)), 'amount', nonac); end if;
  return jsonb_build_object('fare', total, 'lines', lines);
end $$;

-- Coupon rules: active, dates, weekday (IST), vehicle, destination, minimum fare, first ride, limits.
create or replace function public.coupon_eval(p_code text, p_user uuid, p_vehicle text, p_fare int, p_to text, p_ignore_ride uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare c public.coupons; ist timestamp := now() at time zone 'Asia/Kolkata'; used int; done int; d int;
begin
  select * into c from public.coupons where code = upper(trim(p_code));
  if not found then return jsonb_build_object('ok', false, 'reason', 'That code isn''t valid.'); end if;
  if not c.active then return jsonb_build_object('ok', false, 'reason', 'This offer is no longer active.'); end if;
  if now() < c.starts_at then return jsonb_build_object('ok', false, 'reason', 'This offer hasn''t started yet.'); end if;
  if now() > c.expires_at then return jsonb_build_object('ok', false, 'reason', 'This offer has expired.'); end if;
  if c.days is not null and not (extract(dow from ist)::int = any (c.days)) then
    return jsonb_build_object('ok', false, 'reason', 'Not valid today.'); end if;
  if c.vehicles is not null and not (p_vehicle = any (c.vehicles)) then
    return jsonb_build_object('ok', false, 'reason', 'Not valid on this vehicle.'); end if;
  if c.dest_places is not null and not (p_to = any (c.dest_places)) then
    return jsonb_build_object('ok', false, 'reason', 'Not valid for this destination.'); end if;
  if p_fare < c.min_fare then return jsonb_build_object('ok', false, 'reason', format('Valid on fares of ₹%s or more.', c.min_fare)); end if;
  if c.total_limit is not null and c.uses >= c.total_limit then return jsonb_build_object('ok', false, 'reason', 'This offer is fully redeemed.'); end if;
  select count(*) into used from public.coupon_redemptions r where r.code = c.code and r.user_id = p_user and not r.released and r.ride_id is distinct from p_ignore_ride;
  if used >= c.per_user_limit then return jsonb_build_object('ok', false, 'reason', 'You''ve already used this offer.'); end if;
  if c.first_ride_only then
    select count(*) into done from public.rides where customer_id = p_user and status = 'Completed';
    if done > 0 then return jsonb_build_object('ok', false, 'reason', 'Only valid on your first ride.'); end if;
  end if;
  d := case when c.pct then round(p_fare * c.off / 100.0)::int else c.off end;
  if c.max_off is not null then d := least(d, c.max_off); end if;
  d := greatest(0, least(d, p_fare));
  return jsonb_build_object('ok', true, 'discount', d, 'code', c.code, 'title', c.title);
end $$;

-- Drivers who could take a ride right now.
create or replace function public.available_drivers(p_vehicle text, p_ac boolean)
returns int language sql stable security definer set search_path = public, pg_temp as $$
  select count(*)::int from public.drivers d
  join public.profiles p on p.id = d.id
  join public.settings s on true
  join public.vehicles v on v.id = d.vehicle
  where d.vehicle = p_vehicle and d.kyc = 'Approved' and not d.suspended and not p.blocked and d.online
    and d.last_seen > now() - make_interval(secs => s.driver_heartbeat_sec)
    and (not p_ac or not v.ac or d.ac)
    and not exists (select 1 from public.rides r where r.driver_id = d.id and r.status in ('Arriving','Arrived','Started'))
$$;

-- ───────────────────────────── Customer API ─────────────────────────────

create or replace function public.update_my_profile(p_name text, p_email text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := public.require_user();
begin
  if p_name is null or char_length(trim(p_name)) = 0 or char_length(p_name) > 80 then raise exception 'name is required (max 80 characters)' using errcode = '22023'; end if;
  update public.profiles set name = trim(p_name), email = nullif(trim(coalesce(p_email, '')), '') where id = uid;
end $$;

create or replace function public.my_profile() returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object('id', p.id, 'name', p.name, 'email', p.email, 'phone', p.phone, 'rating', p.rating,
    'blocked', p.blocked, 'is_admin', p.is_admin, 'is_driver', exists (select 1 from public.drivers d where d.id = p.id),
    'completed', (select count(*) from public.rides r where r.customer_id = p.id and r.status = 'Completed'),
    'wallet', coalesce((select sum(amount) from public.ledger l where l.user_id = p.id and l.kind in ('wallet_credit','wallet_debit')), 0))
  from public.profiles p where p.id = auth.uid()
$$;

-- Prices for every option between two places, with coupon effect per option.
create or replace function public.quote(p_from text, p_to text, p_ac boolean default true, p_coupon text default null)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare uid uuid := public.require_user(); est record; v public.vehicles; q jsonb; opts jsonb := '[]'::jsonb; any_best jsonb;
        rentals jsonb := '[]'::jsonb; parcels jsonb := '[]'::jsonb; rp public.rental_packages; pw public.parcel_weights; f int; c jsonb; disc int;
begin
  if not exists (select 1 from public.places where id = p_from) or not exists (select 1 from public.places where id = p_to) then
    raise exception 'unknown place' using errcode = '22023'; end if;
  if p_from = p_to then raise exception 'pickup and drop must be different' using errcode = '22023'; end if;
  select * into est from public.trip_estimate(p_from, p_to);
  for v in select * from public.vehicles where enabled order by sort loop
    q := public.fare_quote(v, est.km, est.mins, p_ac);
    disc := 0; c := null;
    if p_coupon is not null and p_coupon <> '' then c := public.coupon_eval(p_coupon, uid, v.id, (q->>'fare')::int, p_to); disc := coalesce((c->>'discount')::int, 0); end if;
    opts := opts || jsonb_build_object('id', v.id, 'name', v.name, 'tagline', v.tagline, 'seats', v.seats, 'ac', v.ac, 'eta', v.eta,
      'cancel_fee', v.cancel_fee, 'fare', (q->>'fare')::int, 'alt_fare', (public.fare_quote(v, est.km, est.mins, not p_ac)->>'fare')::int,
      'lines', q->'lines', 'available', public.available_drivers(v.id, p_ac), 'discount', disc, 'coupon', c);
  end loop;
  -- "Book Any": the price is the cheapest of Mini / Sedan / XL; the customer is never charged more than quoted.
  select o.value into any_best from jsonb_array_elements(opts) as o(value) where o.value->>'id' in ('mini','sedan','suv') order by (o.value->>'fare')::int limit 1;
  for rp in select * from public.rental_packages order by hours loop
    for v in select * from public.vehicles where enabled and rental_scale is not null order by sort loop
      f := round(rp.price * v.rental_scale);
      if v.ac and not p_ac then f := round(f * (select non_ac_factor from public.settings)); end if;
      disc := 0; c := null;
      if p_coupon is not null and p_coupon <> '' then c := public.coupon_eval(p_coupon, uid, v.id, f, p_to); disc := coalesce((c->>'discount')::int, 0); end if;
      rentals := rentals || jsonb_build_object('pkg', rp.id, 'hours', rp.hours, 'km', rp.km, 'extra_km', rp.extra_km, 'extra_hour', rp.extra_hour, 'car', v.id, 'fare', f,
        'discount', disc, 'coupon', c, 'available', public.available_drivers(v.id, p_ac));
    end loop;
  end loop;
  for pw in select * from public.parcel_weights order by sort loop
    select * into v from public.vehicles where id = pw.vehicle;
    f := (public.fare_quote(v, est.km, est.mins, false)->>'fare')::int + pw.fee;
    disc := 0; c := null;
    if p_coupon is not null and p_coupon <> '' then c := public.coupon_eval(p_coupon, uid, v.id, f, p_to); disc := coalesce((c->>'discount')::int, 0); end if;
    parcels := parcels || jsonb_build_object('id', pw.id, 'label', pw.label, 'sub', pw.sub, 'vehicle', pw.vehicle, 'fee', pw.fee, 'fare', f, 'discount', disc, 'coupon', c,
      'available', public.available_drivers(pw.vehicle, false));
  end loop;
  return jsonb_build_object('km', est.km, 'mins', est.mins, 'options', opts, 'any', any_best, 'rentals', rentals, 'parcels', parcels,
    'any_available', (select coalesce(sum(public.available_drivers(x, p_ac)), 0) from unnest(array['mini','sedan','suv']) x));
end $$;

-- Book a ride. Every price is recomputed here; the client only says what it wants.
-- p: { option, from, to, ac, pay, coupon, when, passenger:{name,phone}, parcel:{type,weight,receiver:{name,phone},note}, rental:{pkg,car}, idem }
create or replace function public.book_ride(p jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := public.require_user(); prof public.profiles; v_opt text := p->>'option'; v public.vehicles; est record; q jsonb;
        v_req text[]; v_svc text; v_fare int; v_disc int := 0; c jsonb; v_code text; v_coupon_vehicle text; r public.rides; existing public.rides;
        v_when timestamptz; pw public.parcel_weights; rp public.rental_packages; v_ac boolean := coalesce((p->>'ac')::boolean, true);
        v_km numeric; v_mins int; v_parcel jsonb; v_rental jsonb; v_passenger jsonb; v_pay text := p->>'pay'; v_idem text := p->>'idem';
begin
  select * into prof from public.profiles where id = uid for update;          -- serialises bookings per customer
  if prof.blocked then raise exception 'your account is blocked — contact support' using errcode = '42501'; end if;
  if prof.phone is null then raise exception 'sign in with your mobile number to book' using errcode = '42501'; end if;
  if v_idem is null or char_length(v_idem) not between 8 and 64 then raise exception 'missing idempotency key' using errcode = '22023'; end if;
  select * into existing from public.rides where customer_id = uid and idempotency_key = v_idem;
  if found then return jsonb_build_object('id', existing.id, 'code', existing.code, 'status', existing.status, 'duplicate', true); end if;
  if v_pay not in ('Cash','UPI','Card','Wallet') then raise exception 'invalid payment method' using errcode = '22023'; end if;
  if p->>'from' = p->>'to' then raise exception 'pickup and drop must be different' using errcode = '22023'; end if;
  if not exists (select 1 from public.places where id = p->>'from') or not exists (select 1 from public.places where id = p->>'to') then
    raise exception 'unknown place' using errcode = '22023'; end if;
  select * into est from public.trip_estimate(p->>'from', p->>'to');
  v_km := est.km; v_mins := est.mins;

  if p ? 'passenger' and jsonb_typeof(p->'passenger') = 'object' then
    if coalesce(p->'passenger'->>'phone', '') !~ '^[6-9]\d{9}$' or char_length(trim(coalesce(p->'passenger'->>'name', ''))) not between 1 and 80 then
      raise exception 'invalid passenger details' using errcode = '22023'; end if;
    v_passenger := jsonb_build_object('name', trim(p->'passenger'->>'name'), 'phone', p->'passenger'->>'phone');
  end if;

  if v_opt = 'any' then
    v_svc := 'any'; v_req := array['mini','sedan','suv'];
    select min((public.fare_quote(x, v_km, v_mins, v_ac)->>'fare')::int) into v_fare from public.vehicles x where x.id = any (v_req) and x.enabled;
    if v_fare is null then raise exception 'no vehicles available for Book Any' using errcode = '22023'; end if;
    v_coupon_vehicle := 'mini';
  elsif v_opt = 'rental' then
    v_svc := 'rental';
    select * into rp from public.rental_packages where id = p->'rental'->>'pkg';
    select * into v from public.vehicles where id = p->'rental'->>'car' and enabled and rental_scale is not null;
    if rp.id is null or v.id is null then raise exception 'invalid rental package or car' using errcode = '22023'; end if;
    v_req := array[v.id]; v_coupon_vehicle := v.id;
    v_fare := round(rp.price * v.rental_scale);
    if v.ac and not v_ac then v_fare := round(v_fare * (select non_ac_factor from public.settings)); end if;
    v_km := rp.km; v_mins := rp.hours * 60;
    v_rental := jsonb_build_object('pkg', rp.id, 'hours', rp.hours, 'km', rp.km, 'extra_km', rp.extra_km, 'extra_hour', rp.extra_hour);
  elsif v_opt = 'parcel' then
    v_svc := 'parcel'; v_ac := false;
    if v_pay = 'Card' then raise exception 'card is not available for parcels' using errcode = '22023'; end if;
    select * into pw from public.parcel_weights where id = p->'parcel'->>'weight';
    if pw.id is null then raise exception 'invalid parcel weight' using errcode = '22023'; end if;
    if coalesce(p->'parcel'->'receiver'->>'phone', '') !~ '^[6-9]\d{9}$' or char_length(trim(coalesce(p->'parcel'->'receiver'->>'name', ''))) not between 1 and 80 then
      raise exception 'invalid receiver details' using errcode = '22023'; end if;
    if char_length(coalesce(p->'parcel'->>'note', '')) > 160 or char_length(coalesce(p->'parcel'->>'type', '')) not between 1 and 30 then
      raise exception 'invalid parcel details' using errcode = '22023'; end if;
    select * into v from public.vehicles where id = pw.vehicle;
    v_req := array[v.id]; v_coupon_vehicle := v.id;
    v_fare := (public.fare_quote(v, v_km, v_mins, false)->>'fare')::int + pw.fee;
    v_parcel := jsonb_build_object('type', p->'parcel'->>'type', 'weight', pw.id, 'weight_label', pw.label,
      'receiver', jsonb_build_object('name', trim(p->'parcel'->'receiver'->>'name'), 'phone', p->'parcel'->'receiver'->>'phone'),
      'note', coalesce(p->'parcel'->>'note', ''), 'sender', jsonb_build_object('name', prof.name, 'phone', prof.phone));
  else
    v_svc := 'ride';
    select * into v from public.vehicles where id = v_opt and enabled;
    if v.id is null then raise exception 'unknown or disabled vehicle' using errcode = '22023'; end if;
    v_req := array[v.id]; v_coupon_vehicle := v.id;
    if not v.ac then v_ac := false; end if;
    v_fare := (public.fare_quote(v, v_km, v_mins, v_ac)->>'fare')::int;
  end if;

  v_code := nullif(upper(trim(coalesce(p->>'coupon', ''))), '');
  if v_code is not null then
    perform 1 from public.coupons where coupons.code = v_code for update;     -- serialise the last available use
    c := public.coupon_eval(v_code, uid, v_coupon_vehicle, v_fare, p->>'to');
    if not (c->>'ok')::boolean then raise exception 'coupon: %', c->>'reason' using errcode = '22023'; end if;
    v_disc := (c->>'discount')::int;
  end if;

  if p->>'when' is not null then
    v_when := (p->>'when')::timestamptz;
    if v_when < now() + interval '20 minutes' or v_when > now() + interval '7 days' then
      raise exception 'scheduled time must be between 20 minutes and 7 days from now' using errcode = '22023'; end if;
  end if;

  begin
    insert into public.rides (customer_id, service, requested_vehicles, vehicle, ac, from_place, to_place, km, mins, fare, discount, coupon_code,
      total, pay_method, status, scheduled_for, passenger, parcel, rental, idempotency_key, searching_since)
    values (uid, v_svc, v_req, case when v_svc = 'any' then null else v_req[1] end, v_ac, p->>'from', p->>'to', v_km, v_mins, v_fare, v_disc, v_code,
      v_fare - v_disc, v_pay, case when v_when is null then 'Searching' else 'Scheduled' end, v_when, v_passenger, v_parcel, v_rental, v_idem,
      case when v_when is null then now() end)
    returning * into r;
  exception when unique_violation then
    raise exception 'you already have a ride in progress' using errcode = '23505';
  end;
  insert into public.ride_otps (ride_id, otp) values (r.id, lpad((abs(('x' || substr(md5(gen_random_uuid()::text), 1, 8))::bit(32)::int) % 10000)::text, 4, '0'));
  if v_code is not null then
    insert into public.coupon_redemptions (ride_id, code, user_id) values (r.id, v_code, uid);
    update public.coupons set uses = uses + 1 where coupons.code = v_code;
  end if;
  insert into public.ride_events (ride_id, from_status, to_status, actor) values (r.id, null, r.status, uid);
  return jsonb_build_object('id', r.id, 'code', r.code, 'status', r.status, 'duplicate', false);
end $$;

-- Customer-facing view of one ride (driver contact only while the trip is live).
create or replace function public.ride_view(r public.rides, for_customer boolean)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare d public.drivers; dp public.profiles; cp public.profiles; s public.settings; f public.places; t public.places; live boolean;
begin
  select * into s from public.settings;
  select * into f from public.places where id = r.from_place;
  select * into t from public.places where id = r.to_place;
  select * into cp from public.profiles where id = r.customer_id;
  if r.driver_id is not null then select * into d from public.drivers where id = r.driver_id; select * into dp from public.profiles where id = r.driver_id; end if;
  live := r.status in ('Arriving','Arrived','Started');
  return jsonb_build_object(
    'id', r.id, 'code', r.code, 'status', r.status, 'service', r.service, 'vehicle', coalesce(r.vehicle, r.requested_vehicles[1]),
    'requested', r.requested_vehicles, 'ac', r.ac,
    'from', jsonb_build_object('id', f.id, 'name', f.name, 'address', f.address),
    'to', jsonb_build_object('id', t.id, 'name', t.name, 'address', t.address),
    'km', r.km, 'mins', r.mins, 'fare', r.fare, 'discount', r.discount, 'coupon', r.coupon_code, 'wait_fee', r.wait_fee,
    'cancel_fee', r.cancel_fee, 'total', r.total, 'pay', r.pay_method, 'payment_status', r.payment_status, 'refunded', r.refunded,
    'scheduled_for', r.scheduled_for, 'passenger', r.passenger, 'parcel', r.parcel, 'rental', r.rental,
    'cancel_reason', r.cancel_reason, 'cancelled_by', r.cancelled_by, 'rating', r.rating,
    'created_at', r.created_at, 'assigned_at', r.assigned_at, 'arrived_at', r.arrived_at, 'started_at', r.started_at, 'completed_at', r.completed_at,
    'search_timeout_sec', s.search_timeout_sec, 'free_wait_sec', s.free_wait_sec, 'wait_fee_per_min', s.wait_fee_per_min,
    'commission_pct', s.commission_pct,
    'cancel_fee_now', case when r.status in ('Arriving','Arrived') and r.assigned_at <= now() - make_interval(secs => s.cancel_grace_sec)
                        then (select cancel_fee from public.vehicles where id = r.vehicle) else 0 end,
    'otp', case when for_customer and r.status in ('Searching','Arriving','Arrived') then (select otp from public.ride_otps where ride_id = r.id) end,
    'driver', case when d.id is null then null else jsonb_build_object('name', d.name, 'vehicle', d.vehicle, 'model', d.model, 'plate', d.plate,
       'rating', d.rating, 'trips', d.trips, 'phone', case when live then dp.phone end) end,
    'customer', case when for_customer then null else jsonb_build_object('name', cp.name, 'rating', cp.rating,
       'phone', case when live then coalesce(r.passenger->>'phone', cp.phone) end) end);
end $$;

create or replace function public.my_active_ride() returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := public.require_user(); r public.rides; s public.settings;
begin
  select * into s from public.settings;
  -- Searches that ran out of time end as NoDrivers (also enforced in accept_ride).
  update public.rides set status = 'NoDrivers', cancelled_by = 'system', cancelled_at = now()
    where customer_id = uid and status = 'Searching' and searching_since < now() - make_interval(secs => s.search_timeout_sec);
  -- Release coupons of rides that ended without a trip.
  update public.coupon_redemptions cr set released = true from public.rides x
    where cr.ride_id = x.id and x.customer_id = uid and x.status = 'NoDrivers' and not cr.released;
  -- Scheduled rides move to Searching 15 minutes before pickup.
  update public.rides set status = 'Searching', searching_since = now()
    where customer_id = uid and status = 'Scheduled' and scheduled_for <= now() + interval '15 minutes'
      and not exists (select 1 from public.rides a where a.customer_id = uid and a.status in ('Searching','Arriving','Arrived','Started'))
      and id = (select id from public.rides where customer_id = uid and status = 'Scheduled' order by scheduled_for limit 1);
  select * into r from public.rides where customer_id = uid and
    (status in ('Searching','Arriving','Arrived','Started')
     or (status = 'Completed' and payment_status in ('unpaid','pending'))
     or (status = 'Completed' and customer_closed_at is null and completed_at > now() - interval '1 hour')
     or (status = 'NoDrivers' and customer_closed_at is null and cancelled_at > now() - interval '10 minutes'))
    order by created_at desc limit 1;
  if not found then return null; end if;
  return public.ride_view(r, true);
end $$;

create or replace function public.my_rides() returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(jsonb_agg(public.ride_view(r, true) order by coalesce(r.scheduled_for, r.created_at) desc), '[]'::jsonb)
  from public.rides r where r.customer_id = auth.uid()
$$;

-- Customer leaves the finished screen (completed & paid, or no drivers).
create or replace function public.close_ride(p_ride uuid) returns void
language sql security definer set search_path = public, pg_temp as $$
  update public.rides set customer_closed_at = now()
  where id = p_ride and customer_id = auth.uid() and customer_closed_at is null
    and (status = 'NoDrivers' or (status = 'Completed' and payment_status not in ('unpaid','pending')))
$$;

-- Cancel by the customer. Repeating the call is a no-op. Fee applies once a driver is on the way.
create or replace function public.cancel_ride(p_ride uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := public.require_user(); r public.rides; s public.settings; fee int := 0; v public.vehicles; earn int;
begin
  select * into s from public.settings;
  select * into r from public.rides where id = p_ride and customer_id = uid for update;
  if not found then raise exception 'ride not found' using errcode = 'P0002'; end if;
  if r.status = 'Cancelled' then return public.ride_view(r, true); end if;
  if r.status not in ('Scheduled','Searching','Arriving','Arrived') then raise exception 'this ride can no longer be cancelled' using errcode = 'P0001'; end if;
  if char_length(coalesce(p_reason, '')) not between 1 and 200 then raise exception 'pick a reason' using errcode = '22023'; end if;
  if r.status in ('Arriving','Arrived') and r.assigned_at <= now() - make_interval(secs => s.cancel_grace_sec) then
    select * into v from public.vehicles where id = r.vehicle;
    fee := v.cancel_fee;
  end if;
  update public.rides set status = 'Cancelled', cancel_reason = p_reason, cancelled_by = 'customer', cancelled_at = now(),
    cancel_fee = fee, discount = 0, total = fee, payment_status = case when fee > 0 then 'pending' else payment_status end
    where id = r.id returning * into r;
  update public.coupon_redemptions set released = true where ride_id = r.id;
  update public.coupons set uses = greatest(0, uses - 1) where code = r.coupon_code;
  if fee > 0 then
    earn := round(fee * (1 - s.commission_pct / 100.0));
    insert into public.ledger (idem, ride_id, user_id, party, kind, amount, note) values
      ('ride:' || r.id || ':cancel_fee_driver', r.id, r.driver_id, 'driver', 'cancel_fee', earn, 'Cancellation fee · ' || r.code),
      ('ride:' || r.id || ':cancel_fee_commission', r.id, null, 'platform', 'commission', fee - earn, 'Cancellation fee commission · ' || r.code)
    on conflict (idem) do nothing;
  end if;
  return public.ride_view(r, true);
end $$;

-- Pay what is owed on a completed ride (or a cancellation fee). Simulated provider: UPI/Card succeed;
-- Wallet checks and debits the balance atomically. Repeating after success is a no-op.
create or replace function public.pay_ride(p_ride uuid, p_method text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := public.require_user(); r public.rides; bal int;
begin
  if p_method not in ('UPI','Card','Wallet') then raise exception 'choose UPI, card or wallet' using errcode = '22023'; end if;
  perform 1 from public.profiles where id = uid for update;                  -- serialises wallet spends
  select * into r from public.rides where id = p_ride and customer_id = uid for update;
  if not found then raise exception 'ride not found' using errcode = 'P0002'; end if;
  if r.payment_status = 'paid' then return public.ride_view(r, true); end if;
  if r.payment_status <> 'pending' or r.total <= 0 then raise exception 'nothing to pay on this ride' using errcode = 'P0001'; end if;
  if p_method = 'Wallet' then
    select coalesce(sum(amount), 0) into bal from public.ledger where user_id = uid and kind in ('wallet_credit','wallet_debit');
    if bal < r.total then raise exception 'insufficient wallet balance (₹%)', bal using errcode = 'P0001'; end if;
    insert into public.ledger (idem, ride_id, user_id, party, kind, amount, method, note)
      values ('ride:' || r.id || ':wallet_debit', r.id, uid, 'customer', 'wallet_debit', -r.total, 'Wallet', 'Paid ' || r.code);
  end if;
  insert into public.ledger (idem, ride_id, user_id, party, kind, amount, method, note)
    values ('ride:' || r.id || ':payment', r.id, uid, 'customer', 'payment', r.total, p_method, 'Payment for ' || r.code);
  update public.rides set payment_status = 'paid', pay_method = p_method where id = r.id returning * into r;
  return public.ride_view(r, true);
end $$;

create or replace function public.rate_ride(p_ride uuid, p_stars int, p_tags text[])
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := public.require_user(); r public.rides;
begin
  if p_stars not between 1 and 5 then raise exception 'rating must be 1–5' using errcode = '22023'; end if;
  if coalesce(array_length(p_tags, 1), 0) > 6 or exists (select 1 from unnest(coalesce(p_tags, '{}')) t where char_length(t) > 30) then
    raise exception 'too many tags' using errcode = '22023'; end if;
  update public.rides set rating = p_stars, rating_tags = p_tags, customer_closed_at = coalesce(customer_closed_at, now())
    where id = p_ride and customer_id = uid and status = 'Completed' and rating is null returning * into r;
  if not found then return; end if;                                          -- already rated / not eligible: no-op
  update public.drivers d set rating = (select round(avg(rating)::numeric, 1) from public.rides where driver_id = d.id and rating is not null)
    where d.id = r.driver_id;
end $$;

create or replace function public.my_wallet() returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'balance', coalesce((select sum(amount) from public.ledger where user_id = auth.uid() and kind in ('wallet_credit','wallet_debit')), 0),
    'txns', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'kind', kind, 'amount', amount, 'note', note, 'at', created_at) order by created_at desc)
      from public.ledger where user_id = auth.uid() and party = 'customer' and kind in ('wallet_credit','wallet_debit','refund')), '[]'::jsonb))
$$;

create or replace function public.support_message(p_body text, p_role text, p_ride uuid default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := public.require_user(); t public.tickets; note jsonb;
begin
  if char_length(coalesce(trim(p_body), '')) not between 1 and 1000 then raise exception 'message must be 1–1000 characters' using errcode = '22023'; end if;
  if p_role not in ('Customer','Driver') then raise exception 'invalid role' using errcode = '22023'; end if;
  if p_role = 'Driver' and not exists (select 1 from public.drivers where id = uid) then raise exception 'not a driver' using errcode = '42501'; end if;
  if p_ride is not null and not exists (select 1 from public.rides where id = p_ride and (customer_id = uid or driver_id = uid)) then
    raise exception 'ride not found' using errcode = 'P0002'; end if;
  note := jsonb_build_object('from', 'user', 'body', trim(p_body), 'at', now());
  select * into t from public.tickets where user_id = uid and role = p_role and status <> 'Resolved' order by created_at desc limit 1 for update;
  if found then
    update public.tickets set notes = notes || note, updated_at = now() where id = t.id returning * into t;
  else
    insert into public.tickets (user_id, role, subject, ride_id, notes) values (uid, p_role, left(trim(p_body), 200), p_ride, jsonb_build_array(note)) returning * into t;
  end if;
  return jsonb_build_object('id', t.id, 'code', t.code, 'status', t.status);
end $$;

-- ───────────────────────────── Driver API ─────────────────────────────

create or replace function public.register_driver(p jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := public.require_user(); v public.vehicles; d public.drivers;
begin
  if (select phone from public.profiles where id = uid) is null then raise exception 'sign in with your mobile number to apply' using errcode = '42501'; end if;
  select * into d from public.drivers where id = uid;
  if found and d.kyc <> 'Rejected' then raise exception 'you have already applied' using errcode = '23505'; end if;
  select * into v from public.vehicles where id = p->>'vehicle';
  if v.id is null then raise exception 'unknown vehicle type' using errcode = '22023'; end if;
  if coalesce((p->>'ac')::boolean, false) and v.id in ('bike','auto','erick') then raise exception 'this vehicle type cannot be AC' using errcode = '22023'; end if;
  -- Each document is a file this driver uploaded to the private driver-docs bucket (path starts with their user id).
  if exists (select 1 from unnest(array['photo','licence','rc','insurance','aadhaar']) k
             where coalesce(p->'docs'->>k, '') not like uid::text || '/%' or char_length(p->'docs'->>k) > 200) then
    raise exception 'all five documents are required' using errcode = '22023'; end if;
  begin
    insert into public.drivers (id, name, vehicle, model, plate, ac, city, docs, upi, kyc, kyc_note)
    values (uid, trim(p->>'name'), v.id, trim(p->>'model'), upper(trim(p->>'plate')), coalesce((p->>'ac')::boolean, false), p->>'city',
            p->'docs', nullif(trim(coalesce(p->>'upi', '')), ''), 'Pending', null)
    on conflict (id) do update set name = excluded.name, vehicle = excluded.vehicle, model = excluded.model, plate = excluded.plate,
      ac = excluded.ac, city = excluded.city, docs = excluded.docs, upi = excluded.upi, kyc = 'Pending', kyc_note = null
    returning * into d;
  exception when unique_violation then raise exception 'this number plate is already registered' using errcode = '23505';
  end;
  update public.profiles set name = d.name where id = uid and name = '';
  return to_jsonb(d);
end $$;

create or replace function public.my_driver() returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := public.require_user(); d public.drivers; s public.settings; today date := (now() at time zone 'Asia/Kolkata')::date; bal int;
begin
  select * into d from public.drivers where id = uid;
  if not found then return null; end if;
  select * into s from public.settings;
  select coalesce(sum(amount), 0) into bal from public.ledger where user_id = uid and party = 'driver';
  return to_jsonb(d) - 'docs' || jsonb_build_object(
    'phone', (select phone from public.profiles where id = uid),
    'balance', bal,
    'commission_pct', s.commission_pct, 'free_wait_sec', s.free_wait_sec, 'wait_fee_per_min', s.wait_fee_per_min,
    'min_payout', s.min_payout, 'payout_fee', s.payout_fee,
    'today', jsonb_build_object(
      'trips', (select count(*) from public.rides where driver_id = uid and status = 'Completed' and (completed_at at time zone 'Asia/Kolkata')::date = today),
      'earnings', coalesce((select sum(amount) from public.ledger where user_id = uid and kind in ('driver_earning','cancel_fee','incentive') and (created_at at time zone 'Asia/Kolkata')::date = today), 0)),
    'week_trips', public.incentive_progress(uid, 'week'),
    'earnings', jsonb_build_object(
      'week', coalesce((select sum(amount) from public.ledger where user_id = uid and kind in ('driver_earning','cancel_fee','incentive')
                 and created_at at time zone 'Asia/Kolkata' >= date_trunc('week', now() at time zone 'Asia/Kolkata')), 0),
      'month', coalesce((select sum(amount) from public.ledger where user_id = uid and kind in ('driver_earning','cancel_fee','incentive')
                 and created_at at time zone 'Asia/Kolkata' >= date_trunc('month', now() at time zone 'Asia/Kolkata')), 0),
      'incentives_week', coalesce((select sum(amount) from public.ledger where user_id = uid and kind = 'incentive'
                 and created_at at time zone 'Asia/Kolkata' >= date_trunc('week', now() at time zone 'Asia/Kolkata')), 0)),
    'incentives', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'title', i.title, 'body', i.body, 'kind', i.kind, 'target', i.target,
                 'reward', i.reward, 'progress', public.incentive_progress(uid, i.kind)) order by i.sort) from public.incentives i where i.active), '[]'::jsonb),
    'txns', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'kind', kind, 'amount', amount, 'note', note, 'at', created_at) order by created_at desc)
      from (select * from public.ledger where user_id = uid and party = 'driver' order by created_at desc limit 50) x), '[]'::jsonb));
end $$;

create or replace function public.set_online(p_online boolean)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := public.require_user(); d public.drivers;
begin
  select * into d from public.drivers where id = uid for update;
  if not found then raise exception 'driver account not found' using errcode = 'P0002'; end if;
  if p_online and d.kyc <> 'Approved' then raise exception 'your account is not approved yet' using errcode = '42501'; end if;
  if p_online and d.suspended then raise exception 'your account is suspended — contact support' using errcode = '42501'; end if;
  if p_online and exists (select 1 from public.profiles where id = uid and blocked) then raise exception 'your account is blocked' using errcode = '42501'; end if;
  update public.drivers set online = p_online, last_seen = now() where id = uid returning * into d;
  return jsonb_build_object('online', d.online);
end $$;

-- Ride requests this driver may accept right now (also acts as the heartbeat).
create or replace function public.driver_offers() returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := public.require_user(); d public.drivers; s public.settings; dv public.vehicles;
begin
  select * into s from public.settings;
  update public.drivers set last_seen = now() where id = uid and online returning * into d;
  if not found or d.kyc <> 'Approved' or d.suspended then return '[]'::jsonb; end if;
  if exists (select 1 from public.rides where driver_id = uid and status in ('Arriving','Arrived','Started')) then return '[]'::jsonb; end if;
  select * into dv from public.vehicles where id = d.vehicle;
  return coalesce((select jsonb_agg(public.ride_view(r, false) || jsonb_build_object('fare', r.fare, 'earn',
      round(r.fare * (1 - s.commission_pct / 100.0))) order by r.created_at)
    from public.rides r
    where r.status = 'Searching' and d.vehicle = any (r.requested_vehicles)
      and r.searching_since > now() - make_interval(secs => s.search_timeout_sec)
      and (not r.ac or not dv.ac or d.ac)
      and r.customer_id <> uid
      and not exists (select 1 from public.driver_declines x where x.ride_id = r.id and x.driver_id = uid)), '[]'::jsonb);
end $$;

create or replace function public.decline_ride(p_ride uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := public.require_user();
begin
  insert into public.driver_declines (ride_id, driver_id) values (p_ride, uid) on conflict do nothing;
  if found then update public.drivers set offers_declined = offers_declined + 1 where id = uid; end if;
end $$;

-- Accept: exactly one driver wins; stale/expired/cancelled requests are refused.
create or replace function public.accept_ride(p_ride uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := public.require_user(); d public.drivers; dv public.vehicles; r public.rides; s public.settings;
begin
  select * into s from public.settings;
  select * into d from public.drivers where id = uid for update;               -- one accept at a time per driver
  if not found or d.kyc <> 'Approved' then raise exception 'your account is not approved' using errcode = '42501'; end if;
  if d.suspended then raise exception 'your account is suspended' using errcode = '42501'; end if;
  if not d.online then raise exception 'go online to accept rides' using errcode = 'P0001'; end if;
  select * into dv from public.vehicles where id = d.vehicle;
  begin
    update public.rides set status = 'Arriving', driver_id = uid, vehicle = d.vehicle, assigned_at = now()
      where id = p_ride and status = 'Searching' and driver_id is null and d.vehicle = any (requested_vehicles)
        and searching_since > now() - make_interval(secs => s.search_timeout_sec)
        and (not ac or not dv.ac or d.ac) and customer_id <> uid
      returning * into r;
  exception when unique_violation then
    raise exception 'finish your current trip first' using errcode = 'P0001';
  end;
  if not found then raise exception 'this ride is no longer available' using errcode = 'P0001'; end if;
  -- "Book Any" is charged what was quoted, whichever car arrives.
  update public.drivers set offers_accepted = offers_accepted + 1 where id = uid;
  return public.ride_view(r, false);
end $$;

create or replace function public.my_trip() returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := public.require_user(); r public.rides;
begin
  select * into r from public.rides where driver_id = uid and (status in ('Arriving','Arrived','Started')
      or (status = 'Completed' and payment_status = 'pending' and pay_method = 'Cash')
      or (status = 'Completed' and driver_closed_at is null and completed_at > now() - interval '1 hour'))
    order by assigned_at desc limit 1;
  if not found then return null; end if;
  return public.ride_view(r, false);
end $$;

create or replace function public.driver_arrived(p_ride uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := public.require_user(); r public.rides;
begin
  update public.rides set status = 'Arrived', arrived_at = now() where id = p_ride and driver_id = uid and status = 'Arriving' returning * into r;
  if not found then
    select * into r from public.rides where id = p_ride and driver_id = uid;
    if r.status = 'Arrived' then return public.ride_view(r, false); end if;
    raise exception 'cannot mark arrived now' using errcode = 'P0001';
  end if;
  return public.ride_view(r, false);
end $$;

-- Start needs the customer's OTP. Wrong attempts are counted; too many locks the OTP.
create or replace function public.start_ride(p_ride uuid, p_otp text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := public.require_user(); r public.rides; o public.ride_otps; s public.settings; wait int; fee int;
begin
  select * into s from public.settings;
  select * into r from public.rides where id = p_ride and driver_id = uid for update;
  if not found then raise exception 'ride not found' using errcode = 'P0002'; end if;
  if r.status = 'Started' then return public.ride_view(r, false); end if;
  if r.status <> 'Arrived' then raise exception 'mark arrived before starting' using errcode = 'P0001'; end if;
  select * into o from public.ride_otps where ride_id = r.id for update;
  if o.attempts >= s.otp_max_attempts then raise exception 'too many wrong OTPs — ask the customer to contact support' using errcode = '42501'; end if;
  if coalesce(p_otp, '') <> o.otp then
    update public.ride_otps set attempts = attempts + 1 where ride_id = r.id;
    return jsonb_build_object('error', 'wrong_otp', 'attempts_left', s.otp_max_attempts - o.attempts - 1);
  end if;
  update public.ride_otps set verified_at = now() where ride_id = r.id;
  wait := extract(epoch from (now() - r.arrived_at))::int;
  fee := greatest(0, ceil((wait - s.free_wait_sec) / 60.0))::int * s.wait_fee_per_min;
  update public.rides set status = 'Started', started_at = now(), wait_fee = fee where id = r.id returning * into r;
  return public.ride_view(r, false);
end $$;

-- Complete: one transaction, idempotent. Driver earns (fare + waiting) minus commission; the platform
-- funds coupon discounts, so the driver's earning does not depend on the customer's coupon.
create or replace function public.complete_ride(p_ride uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := public.require_user(); r public.rides; s public.settings; gross int; earn int; today date := (now() at time zone 'Asia/Kolkata')::date; inc public.incentives;
begin
  select * into s from public.settings;
  select * into r from public.rides where id = p_ride and driver_id = uid for update;
  if not found then raise exception 'ride not found' using errcode = 'P0002'; end if;
  if r.status = 'Completed' then return public.ride_view(r, false); end if;
  if r.status <> 'Started' then raise exception 'the trip has not started' using errcode = 'P0001'; end if;
  gross := r.fare + r.wait_fee;
  earn := round(gross * (1 - s.commission_pct / 100.0));
  update public.rides set status = 'Completed', completed_at = now(), total = r.fare - r.discount + r.wait_fee,
    payment_status = case when r.fare - r.discount + r.wait_fee = 0 then 'paid' else 'pending' end
    where id = r.id returning * into r;
  insert into public.ledger (idem, ride_id, user_id, party, kind, amount, note) values
    ('ride:' || r.id || ':driver_earning', r.id, uid, 'driver', 'driver_earning', earn, 'Trip ' || r.code),
    ('ride:' || r.id || ':commission', r.id, null, 'platform', 'commission', gross - earn, 'Commission ' || r.code)
  on conflict (idem) do nothing;
  if r.discount > 0 then
    insert into public.ledger (idem, ride_id, user_id, party, kind, amount, note)
    values ('ride:' || r.id || ':discount', r.id, null, 'platform', 'discount', -r.discount, 'Coupon ' || r.coupon_code || ' · ' || r.code)
    on conflict (idem) do nothing;
  end if;
  update public.drivers set trips = trips + 1 where id = uid;
  -- Incentives: each pays at most once per window (idempotency key includes the window).
  for inc in select * from public.incentives where active loop
    if public.incentive_progress(uid, inc.kind) >= inc.target then
      insert into public.ledger (idem, user_id, party, kind, amount, note)
      values ('incentive:' || inc.id || ':' || uid || ':' ||
              case inc.kind when 'week' then to_char(date_trunc('week', now() at time zone 'Asia/Kolkata'), 'YYYY-MM-DD') else today::text end,
              uid, 'driver', 'incentive', inc.reward, inc.title || ' bonus')
      on conflict (idem) do nothing;
    end if;
  end loop;
  return public.ride_view(r, false);
end $$;

-- Cash: the driver confirms the customer paid. The cash stays with the driver, so it is deducted from
-- their wallet (they already earned their share at completion) — a negative balance is dues owed.
create or replace function public.confirm_cash(p_ride uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := public.require_user(); r public.rides;
begin
  select * into r from public.rides where id = p_ride and driver_id = uid for update;
  if not found then raise exception 'ride not found' using errcode = 'P0002'; end if;
  if r.payment_status = 'paid' then return public.ride_view(r, false); end if;
  if r.status <> 'Completed' or r.pay_method <> 'Cash' or r.payment_status <> 'pending' then raise exception 'no cash to confirm' using errcode = 'P0001'; end if;
  insert into public.ledger (idem, ride_id, user_id, party, kind, amount, method, note) values
    ('ride:' || r.id || ':cash_collected', r.id, uid, 'driver', 'cash_collected', -r.total, 'Cash', 'Cash collected · ' || r.code),
    ('ride:' || r.id || ':payment', r.id, r.customer_id, 'customer', 'payment', r.total, 'Cash', 'Payment for ' || r.code)
  on conflict (idem) do nothing;
  update public.rides set payment_status = 'paid' where id = r.id returning * into r;
  return public.ride_view(r, false);
end $$;

create or replace function public.rate_customer(p_ride uuid, p_stars int) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := public.require_user(); r public.rides;
begin
  if p_stars not between 1 and 5 then raise exception 'rating must be 1–5' using errcode = '22023'; end if;
  update public.rides set customer_rating = p_stars, driver_closed_at = coalesce(driver_closed_at, now())
    where id = p_ride and driver_id = uid and status = 'Completed' and customer_rating is null returning * into r;
  if found then
    update public.profiles p set rating = (select round(avg(customer_rating)::numeric, 1) from public.rides where customer_id = p.id and customer_rating is not null)
      where p.id = r.customer_id;
  end if;
end $$;

create or replace function public.driver_close_ride(p_ride uuid) returns void
language sql security definer set search_path = public, pg_temp as $$
  update public.rides set driver_closed_at = now()
  where id = p_ride and driver_id = auth.uid() and status = 'Completed' and driver_closed_at is null
    and not (pay_method = 'Cash' and payment_status = 'pending')
$$;

-- Driver cancels: the ride goes back to Searching so another driver can take it (no fee to the customer).
create or replace function public.driver_cancel_ride(p_ride uuid, p_reason text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := public.require_user(); r public.rides;
begin
  if char_length(coalesce(p_reason, '')) not between 1 and 200 then raise exception 'pick a reason' using errcode = '22023'; end if;
  select * into r from public.rides where id = p_ride and driver_id = uid for update;
  if not found then return; end if;                                          -- already reassigned/cancelled: no-op
  if r.status not in ('Arriving','Arrived') then raise exception 'this trip can no longer be cancelled' using errcode = 'P0001'; end if;
  update public.rides set status = 'Searching', driver_id = null, vehicle = case when service = 'any' then null else vehicle end,
    assigned_at = null, arrived_at = null, searching_since = now() where id = r.id;
  insert into public.driver_declines (ride_id, driver_id) values (r.id, uid) on conflict do nothing;
  update public.drivers set cancellations = cancellations + 1 where id = uid;
  insert into public.audit_log (actor, action, target, details) values (uid, 'driver_cancel', r.code, jsonb_build_object('reason', p_reason));
end $$;

create or replace function public.my_driver_trips() returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(jsonb_agg(public.ride_view(r, false) order by r.assigned_at desc), '[]'::jsonb)
  from (select * from public.rides where driver_id = auth.uid() order by assigned_at desc limit 100) r
$$;

create or replace function public.update_my_upi(p_upi text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := public.require_user();
begin
  update public.drivers set upi = nullif(trim(coalesce(p_upi, '')), '') where id = uid;   -- CHECK validates the format
  if not found then raise exception 'driver account not found' using errcode = 'P0002'; end if;
end $$;

create or replace function public.request_payout(p_idem text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := public.require_user(); s public.settings; bal int; d public.drivers;
begin
  if p_idem is null or char_length(p_idem) not between 8 and 64 then raise exception 'missing idempotency key' using errcode = '22023'; end if;
  if exists (select 1 from public.ledger where idem = 'payout:' || p_idem) then return jsonb_build_object('duplicate', true); end if;
  select * into s from public.settings;
  select * into d from public.drivers where id = uid for update;               -- serialises payouts per driver
  if not found or d.kyc <> 'Approved' then raise exception 'driver account not approved' using errcode = '42501'; end if;
  select coalesce(sum(amount), 0) into bal from public.ledger where user_id = uid and party = 'driver';
  if bal < s.min_payout then raise exception 'minimum ₹% withdrawable balance for payout', s.min_payout using errcode = 'P0001'; end if;
  insert into public.ledger (idem, user_id, party, kind, amount, method, note) values
    ('payout:' || p_idem, uid, 'driver', 'payout', -(bal - s.payout_fee), 'Bank', 'Instant payout · ' || coalesce(d.upi, 'bank')),
    ('payout_fee:' || p_idem, uid, 'driver', 'payout_fee', -s.payout_fee, 'Bank', 'Instant payout fee');
  return jsonb_build_object('paid_out', bal - s.payout_fee, 'fee', s.payout_fee);
end $$;

-- Clear dues (negative balance) — simulated UPI collection until a payment provider is connected.
create or replace function public.pay_dues(p_idem text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := public.require_user(); bal int;
begin
  if p_idem is null or char_length(p_idem) not between 8 and 64 then raise exception 'missing idempotency key' using errcode = '22023'; end if;
  perform 1 from public.drivers where id = uid for update;
  if not found then raise exception 'driver account not found' using errcode = 'P0002'; end if;
  select coalesce(sum(amount), 0) into bal from public.ledger where user_id = uid and party = 'driver';
  if bal >= 0 then return jsonb_build_object('cleared', 0); end if;
  insert into public.ledger (idem, user_id, party, kind, amount, method, note)
    values ('dues:' || p_idem, uid, 'driver', 'dues_paid', -bal, 'UPI', 'Dues paid via UPI') on conflict (idem) do nothing;
  return jsonb_build_object('cleared', -bal);
end $$;

-- ───────────────────────────── Admin API (every call is audited) ─────────────────────────────

create or replace function public.admin_set_kyc(p_driver uuid, p_kyc text, p_note text default null) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.require_admin();
  if p_kyc not in ('Approved','Rejected','Pending') then raise exception 'invalid status' using errcode = '22023'; end if;
  update public.drivers set kyc = p_kyc, kyc_note = p_note, online = case when p_kyc = 'Approved' then online else false end where id = p_driver;
  if not found then raise exception 'driver not found' using errcode = 'P0002'; end if;
  perform public.audit('set_kyc', p_driver::text, jsonb_build_object('kyc', p_kyc, 'note', p_note));
end $$;

create or replace function public.admin_set_suspended(p_driver uuid, p_suspended boolean) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.require_admin();
  -- Suspension takes the driver offline immediately; a trip already in progress may finish.
  update public.drivers set suspended = p_suspended, online = case when p_suspended then false else online end where id = p_driver;
  if not found then raise exception 'driver not found' using errcode = 'P0002'; end if;
  perform public.audit('set_suspended', p_driver::text, jsonb_build_object('suspended', p_suspended));
end $$;

create or replace function public.admin_set_blocked(p_user uuid, p_blocked boolean) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.require_admin();
  if p_user = auth.uid() then raise exception 'you cannot block yourself' using errcode = '22023'; end if;
  update public.profiles set blocked = p_blocked where id = p_user;
  if not found then raise exception 'user not found' using errcode = 'P0002'; end if;
  update public.drivers set online = false where id = p_user and p_blocked;
  perform public.audit('set_blocked', p_user::text, jsonb_build_object('blocked', p_blocked));
end $$;

create or replace function public.admin_update_vehicle(p_id text, p jsonb) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.require_admin();
  update public.vehicles set
    base = coalesce((p->>'base')::int, base), per_km = coalesce((p->>'per_km')::numeric, per_km),
    per_min = coalesce((p->>'per_min')::numeric, per_min), min_fare = coalesce((p->>'min_fare')::int, min_fare),
    cancel_fee = coalesce((p->>'cancel_fee')::int, cancel_fee), ac = coalesce((p->>'ac')::boolean, ac),
    enabled = coalesce((p->>'enabled')::boolean, enabled), updated_at = now()
  where id = p_id;                                                             -- CHECK constraints reject negatives
  if not found then raise exception 'vehicle not found' using errcode = 'P0002'; end if;
  perform public.audit('update_vehicle', p_id, p);
end $$;

create or replace function public.admin_update_settings(p jsonb) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.require_admin();
  update public.settings set
    commission_pct = coalesce((p->>'commission_pct')::numeric, commission_pct),
    surge_on = coalesce((p->>'surge_on')::boolean, surge_on), surge_mult = coalesce((p->>'surge_mult')::numeric, surge_mult),
    updated_at = now();
  perform public.audit('update_settings', 'settings', p);
end $$;

create or replace function public.admin_upsert_coupon(p jsonb) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare c text := upper(trim(p->>'code'));
begin
  perform public.require_admin();
  insert into public.coupons (code, title, body, off, pct, max_off, min_fare, expires_at, active, per_user_limit, total_limit)
  values (c, coalesce(p->>'title', c), coalesce(p->>'body', ''), (p->>'off')::int, coalesce((p->>'pct')::boolean, false),
    nullif(p->>'max_off', '')::int, coalesce((p->>'min_fare')::int, 0), coalesce((p->>'expires_at')::timestamptz, now() + interval '30 days'),
    coalesce((p->>'active')::boolean, true), coalesce((p->>'per_user_limit')::int, 1), nullif(p->>'total_limit', '')::int);
  perform public.audit('create_coupon', c, p);
exception when unique_violation then raise exception 'a coupon with this code already exists' using errcode = '23505';
end $$;

create or replace function public.admin_set_coupon_active(p_code text, p_active boolean) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.require_admin();
  update public.coupons set active = p_active where code = p_code;
  perform public.audit('set_coupon_active', p_code, jsonb_build_object('active', p_active));
end $$;

create or replace function public.admin_cancel_ride(p_ride uuid, p_reason text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.rides;
begin
  perform public.require_admin();
  update public.rides set status = 'Cancelled', cancelled_by = 'admin', cancel_reason = p_reason, cancelled_at = now()
    where id = p_ride and status in ('Scheduled','Searching','Arriving','Arrived') returning * into r;
  if not found then raise exception 'ride is not cancellable' using errcode = 'P0001'; end if;
  update public.coupon_redemptions set released = true where ride_id = r.id;
  update public.coupons set uses = greatest(0, uses - 1) where code = r.coupon_code;
  perform public.audit('cancel_ride', r.code, jsonb_build_object('reason', p_reason));
end $$;

-- Refund to the customer's DriveWay wallet. Idempotent per key; never more than was paid.
create or replace function public.admin_refund(p_ride uuid, p_amount int, p_reason text, p_idem text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.rides;
begin
  perform public.require_admin();
  if p_idem is null or char_length(p_idem) not between 8 and 64 then raise exception 'missing idempotency key' using errcode = '22023'; end if;
  if exists (select 1 from public.ledger where idem = 'refund:' || p_idem) then return; end if;
  select * into r from public.rides where id = p_ride for update;
  if not found then raise exception 'ride not found' using errcode = 'P0002'; end if;
  if r.payment_status not in ('paid','partially_refunded') then raise exception 'only paid rides can be refunded' using errcode = 'P0001'; end if;
  if p_amount is null or p_amount <= 0 or p_amount > r.total - r.refunded then raise exception 'refund must be between ₹1 and ₹%', r.total - r.refunded using errcode = '22023'; end if;
  insert into public.ledger (idem, ride_id, user_id, party, kind, amount, method, note) values
    ('refund:' || p_idem, r.id, r.customer_id, 'customer', 'wallet_credit', p_amount, 'Wallet', 'Refund · ' || r.code || ' · ' || coalesce(p_reason, '')),
    ('refund_cost:' || p_idem, r.id, null, 'platform', 'refund', -p_amount, 'Wallet', 'Refund · ' || r.code);
  update public.rides set refunded = refunded + p_amount,
    payment_status = case when refunded + p_amount >= total then 'refunded' else 'partially_refunded' end where id = r.id;
  perform public.audit('refund', r.code, jsonb_build_object('amount', p_amount, 'reason', p_reason));
end $$;

create or replace function public.admin_update_ticket(p_ticket uuid, p_status text, p_note text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.require_admin();
  if p_status not in ('Open','In Progress','Resolved') then raise exception 'invalid status' using errcode = '22023'; end if;
  if char_length(coalesce(p_note, '')) > 1000 then raise exception 'note too long' using errcode = '22023'; end if;
  update public.tickets set status = p_status, updated_at = now(),
    notes = case when coalesce(trim(p_note), '') = '' then notes else notes || jsonb_build_object('from', 'agent', 'body', trim(p_note), 'at', now()) end
    where id = p_ticket;
  perform public.audit('update_ticket', p_ticket::text, jsonb_build_object('status', p_status));
end $$;

-- ───────────────────────────── Background housekeeping ─────────────────────────────
-- Run every minute by pg_cron (see docs/SETUP.md). Clients also trigger the same rules for their own
-- rides, so nothing breaks if the job isn't scheduled — it just makes timing independent of app usage.
create or replace function public.system_tick() returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare s public.settings; expired int; activated int;
begin
  select * into s from public.settings;
  with x as (
    update public.rides set status = 'NoDrivers', cancelled_by = 'system', cancelled_at = now()
    where status = 'Searching' and searching_since < now() - make_interval(secs => s.search_timeout_sec) returning id)
  select count(*) into expired from x;
  update public.coupon_redemptions cr set released = true from public.rides r
    where cr.ride_id = r.id and r.status = 'NoDrivers' and not cr.released;
  with x as (
    update public.rides r set status = 'Searching', searching_since = now()
    where r.status = 'Scheduled' and r.scheduled_for <= now() + interval '15 minutes'
      and not exists (select 1 from public.rides a where a.customer_id = r.customer_id and a.status in ('Searching','Arriving','Arrived','Started'))
    returning id)
  select count(*) into activated from x;
  -- Drivers whose app stopped sending heartbeats are taken offline.
  update public.drivers set online = false where online and last_seen < now() - make_interval(secs => s.driver_heartbeat_sec * 5);
  return jsonb_build_object('expired', expired, 'activated', activated);
end $$;

-- ───────────────────────────── Row Level Security ─────────────────────────────

do $$
declare t text;
begin
  foreach t in array array['settings','vehicles','places','rental_packages','parcel_weights','incentives','coupons','profiles','drivers','rides',
                           'ride_otps','ride_events','driver_declines','coupon_redemptions','ledger','tickets','audit_log'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- Read-only reference data for signed-in users.
grant select on public.settings, public.vehicles, public.places, public.rental_packages, public.parcel_weights, public.incentives to authenticated;
drop policy if exists ref_read on public.incentives;      create policy ref_read on public.incentives for select to authenticated using (true);
drop policy if exists ref_read on public.settings;        create policy ref_read on public.settings for select to authenticated using (true);
drop policy if exists ref_read on public.vehicles;        create policy ref_read on public.vehicles for select to authenticated using (true);
drop policy if exists ref_read on public.places;          create policy ref_read on public.places for select to authenticated using (true);
drop policy if exists ref_read on public.rental_packages; create policy ref_read on public.rental_packages for select to authenticated using (true);
drop policy if exists ref_read on public.parcel_weights;  create policy ref_read on public.parcel_weights for select to authenticated using (true);

-- Own rows for users; everything for admins. No client writes anywhere.
grant select on public.coupons, public.profiles, public.drivers, public.rides, public.ledger, public.tickets, public.audit_log, public.ride_events to authenticated;
drop policy if exists coupons_read on public.coupons;   create policy coupons_read on public.coupons for select to authenticated using (active or public.is_admin());
drop policy if exists own_read on public.profiles;      create policy own_read on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
drop policy if exists own_read on public.drivers;       create policy own_read on public.drivers for select to authenticated using (id = auth.uid() or public.is_admin());
drop policy if exists own_read on public.rides;         create policy own_read on public.rides for select to authenticated using (customer_id = auth.uid() or driver_id = auth.uid() or public.is_admin());
drop policy if exists own_read on public.ledger;        create policy own_read on public.ledger for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists own_read on public.tickets;       create policy own_read on public.tickets for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists admin_read on public.audit_log;   create policy admin_read on public.audit_log for select to authenticated using (public.is_admin());
drop policy if exists admin_read on public.ride_events; create policy admin_read on public.ride_events for select to authenticated using (public.is_admin());
-- ride_otps, driver_declines, coupon_redemptions: no client access at all (functions only).

-- Functions: signed-in users only; internal helpers not callable directly.
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' loop
    execute format('revoke all on function %s from public, anon', f.sig);
    if f.proname in ('rides_guard','handle_new_user','audit','ride_view','fare_quote','coupon_eval','available_drivers','require_user','require_admin','incentive_progress','system_tick') then
      execute format('revoke all on function %s from authenticated', f.sig);
    else
      execute format('grant execute on function %s to authenticated', f.sig);
    end if;
  end loop;
end $$;

-- Live updates for ride rows (RLS still applies to what each client receives).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'rides') then
    alter publication supabase_realtime add table public.rides;
  end if;
end $$;

-- ───────────────────────────── KYC document storage ─────────────────────────────
-- Private bucket: drivers write only under their own folder; only they and admins can read.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('driver-docs', 'driver-docs', false, 5242880, array['image/jpeg','image/png','application/pdf'])
    on conflict (id) do nothing;
    drop policy if exists driver_docs_insert on storage.objects;
    create policy driver_docs_insert on storage.objects for insert to authenticated
      with check (bucket_id = 'driver-docs' and (storage.foldername(name))[1] = auth.uid()::text);
    drop policy if exists driver_docs_read on storage.objects;
    create policy driver_docs_read on storage.objects for select to authenticated
      using (bucket_id = 'driver-docs' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
  end if;
end $$;
