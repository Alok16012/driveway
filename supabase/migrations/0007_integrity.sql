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

-- B13: riders and customers no longer read each other's full profile rows directly; the server sends
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
