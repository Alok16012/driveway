-- Sharing: a customer can book a seat (or two) in a car, auto or e-rickshaw at a lower price, and the rider can
-- pick up other sharing customers going the same way until the seats are full. Bikes are never shared.
--   · Admin: which vehicle types can be shared, the sharing discount and how far a rider may go to pick up the next passenger.
--   · Each passenger is still their own ride (own OTP, fare, payment, rating); a rider can hold several shared rides at once.
--   · A private ride is never mixed with a shared one.

alter table public.vehicles add column if not exists share_on boolean not null default false;
update public.vehicles set share_on = true where id <> 'bike' and not share_on
  and not exists (select 1 from public.vehicles where share_on);                  -- first run only: everything but the bike
alter table public.vehicles drop constraint if exists vehicles_bike_not_shared;
alter table public.vehicles add constraint vehicles_bike_not_shared check (not share_on or id <> 'bike');

alter table public.settings add column if not exists share_off int not null default 30;
alter table public.settings add column if not exists share_pickup_km numeric(4,1) not null default 3;
alter table public.settings drop constraint if exists settings_share_check;
alter table public.settings add constraint settings_share_check check (share_off between 0 and 60 and share_pickup_km between 0.5 and 10);

alter table public.rides add column if not exists shared boolean not null default false;
alter table public.rides add column if not exists seats int not null default 1;
alter table public.rides drop constraint if exists rides_seats_check;
alter table public.rides add constraint rides_seats_check check (seats between 1 and 2 and (shared or seats = 1));

-- One private trip at a time per rider; shared trips are counted by accept_ride instead.
drop index if exists public.rides_one_active_per_driver;
create unique index if not exists rides_one_active_per_driver on public.rides (driver_id)
  where status in ('Arriving','Arrived','Started') and not shared;

/** The price of `seats` shared seats: the admin's discount per seat, never more than the whole vehicle. */
create or replace function public.share_fare(p_full int, p_seats int) returns int
language sql stable security definer set search_path = public, pg_temp as $$
  select least(p_full, (ceil(p_full * (100 - s.share_off) / 100.0) * p_seats)::int) from public.settings s
$$;
revoke all on function public.share_fare(int, int) from public, anon, authenticated;

create or replace function public.km_between(a_lat double precision, a_lng double precision, b_lat double precision, b_lng double precision)
returns double precision language sql immutable as $$
  select 2 * 6371 * asin(sqrt(sin(radians(b_lat - a_lat) / 2) ^ 2 + cos(radians(a_lat)) * cos(radians(b_lat)) * sin(radians(b_lng - a_lng) / 2) ^ 2))
$$;
revoke all on function public.km_between(double precision, double precision, double precision, double precision) from public, anon, authenticated;

create or replace function public.bearing(a_lat double precision, a_lng double precision, b_lat double precision, b_lng double precision)
returns double precision language sql immutable as $$
  select degrees(atan2(sin(radians(b_lng - a_lng)) * cos(radians(b_lat)),
    cos(radians(a_lat)) * sin(radians(b_lat)) - sin(radians(a_lat)) * cos(radians(b_lat)) * cos(radians(b_lng - a_lng))))
$$;
revoke all on function public.bearing(double precision, double precision, double precision, double precision) from public, anon, authenticated;

/** Is shared request `r` on the way for this rider? Its pickup is within the admin's distance of where the rider is
 *  now, and it heads the same way (within 60°) as every passenger already on board or being picked up. Points we
 *  don't know (an old fixed place without a position) don't block the match. */
create or replace function public.share_fits(p_driver uuid, r public.rides) returns boolean
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare s public.settings; me record; a record; p_lat double precision; p_lng double precision; d_lat double precision; d_lng double precision; diff double precision;
begin
  select * into s from public.settings;
  select coalesce(r.pickup_lat, f.lat) as plat, coalesce(r.pickup_lng, f.lng) as plng, coalesce(r.drop_lat, t.lat) as dlat, coalesce(r.drop_lng, t.lng) as dlng
    into a from public.places f, public.places t where f.id = r.from_place and t.id = r.to_place;
  p_lat := a.plat; p_lng := a.plng; d_lat := a.dlat; d_lng := a.dlng;
  -- Where the rider is: the latest GPS report on any live trip, else the first passenger's pickup.
  select t.lat, t.lng into me from public.ride_tracks t where t.driver_id = p_driver order by t.at desc limit 1;
  if me.lat is null then
    select coalesce(x.pickup_lat, f.lat) as lat, coalesce(x.pickup_lng, f.lng) as lng into me
      from public.rides x join public.places f on f.id = x.from_place
      where x.driver_id = p_driver and x.status in ('Arriving','Arrived','Started') order by x.assigned_at limit 1;
  end if;
  if me.lat is not null and p_lat is not null and public.km_between(me.lat, me.lng, p_lat, p_lng) > s.share_pickup_km then return false; end if;
  if p_lat is null or d_lat is null then return true; end if;
  for a in select coalesce(x.pickup_lat, f.lat) as plat, coalesce(x.pickup_lng, f.lng) as plng, coalesce(x.drop_lat, t.lat) as dlat, coalesce(x.drop_lng, t.lng) as dlng
      from public.rides x join public.places f on f.id = x.from_place join public.places t on t.id = x.to_place
      where x.driver_id = p_driver and x.status in ('Arriving','Arrived','Started') loop
    if a.plat is null or a.dlat is null then continue; end if;
    diff := abs(public.bearing(a.plat, a.plng, a.dlat, a.dlng) - public.bearing(p_lat, p_lng, d_lat, d_lng));
    if least(diff, 360 - diff) > 60 then return false; end if;
  end loop;
  return true;
end $$;
revoke all on function public.share_fits(uuid, public.rides) from public, anon, authenticated;

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
    'from', jsonb_build_object('id', f.id, 'name', coalesce(r.pickup_name, case when r.pickup_lat is not null then 'Pickup point' else f.name end),
                               'address', coalesce(r.pickup_address, f.address))
            || case when r.pickup_lat is not null then jsonb_build_object('lat', r.pickup_lat, 'lng', r.pickup_lng) else '{}'::jsonb end,
    'to', jsonb_build_object('id', t.id, 'name', coalesce(r.drop_name, t.name), 'address', coalesce(r.drop_address, t.address))
          || case when r.drop_lat is not null then jsonb_build_object('lat', r.drop_lat, 'lng', r.drop_lng) else '{}'::jsonb end,
    'km', r.km, 'mins', r.mins, 'fare', r.fare, 'discount', r.discount, 'coupon', r.coupon_code, 'wait_fee', r.wait_fee, 'add_on', r.add_on,
    'cancel_fee', r.cancel_fee, 'booking_fee', r.booking_fee, 'shared', r.shared, 'seats', r.seats,
    'co_riders', case when r.shared and r.driver_id is not null and live then (select count(*) from public.rides x
       where x.driver_id = r.driver_id and x.shared and x.id <> r.id and x.status in ('Arriving','Arrived','Started')) else 0 end, 'total', r.total, 'pay', r.pay_method, 'payment_status', r.payment_status, 'refunded', r.refunded,
    'scheduled_for', r.scheduled_for, 'passenger', r.passenger, 'parcel', r.parcel, 'rental', r.rental,
    'cancel_reason', r.cancel_reason, 'cancelled_by', r.cancelled_by, 'rating', r.rating,
    'created_at', r.created_at, 'assigned_at', r.assigned_at, 'arrived_at', r.arrived_at, 'started_at', r.started_at, 'completed_at', r.completed_at,
    'search_timeout_sec', s.search_timeout_sec, 'free_wait_sec', s.free_wait_sec, 'wait_fee_per_min', s.wait_fee_per_min,
    -- What DriveWay takes from the driver's share: the fee charged, a pre-migration ride's percentage, or the current fee.
    'platform_fee', case when r.platform_fee is not null then r.platform_fee
                         when r.commission_pct is not null then round((r.fare + r.wait_fee) * r.commission_pct / 100.0)::int
                         else least(public.platform_fee_for(coalesce(r.vehicle, r.requested_vehicles[1]), r.ac), r.fare + r.wait_fee) end,
    'cancel_fee_now', case when r.status in ('Arriving','Arrived') and r.assigned_at <= now() - make_interval(secs => s.cancel_grace_sec)
                        then (select cancel_fee from public.vehicles where id = r.vehicle) else 0 end,
    'otp', case when for_customer and r.status in ('Searching','Arriving','Arrived') then (select otp from public.ride_otps where ride_id = r.id) end,
    'driver', case when d.id is null then null else jsonb_build_object('name', d.name, 'vehicle', d.vehicle, 'model', d.model, 'plate', d.plate,
       'rating', d.rating, 'trips', d.trips, 'phone', case when live then dp.phone end) end,
    'customer', case when for_customer then null else jsonb_build_object('name', cp.name, 'rating', cp.rating,
       'phone', case when live then coalesce(r.passenger->>'phone', cp.phone) end) end);
end $$;

create or replace function public.quote(p_from text, p_to text, p_ac boolean default true, p_coupon text default null,
  p_from_pos jsonb default null, p_to_pos jsonb default null, p_road jsonb default null)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare uid uuid := public.require_user(); est record; v public.vehicles; q jsonb; opts jsonb := '[]'::jsonb; any_best jsonb;
        rentals jsonb := '[]'::jsonb; parcels jsonb := '[]'::jsonb; rp public.rental_packages; pw public.parcel_weights; f int; c jsonb; disc int;
        a record; b record; s public.settings;
begin
  select * into s from public.settings;
  if not exists (select 1 from public.places where id = p_from) or not exists (select 1 from public.places where id = p_to) then
    raise exception 'unknown place' using errcode = '22023'; end if;
  if p_from = p_to then raise exception 'pickup and drop must be different' using errcode = '22023'; end if;
  select * into a from public.client_pos(p_from_pos, p_from = 'cur', false);
  select * into b from public.client_pos(p_to_pos, p_to = 'pin', p_to = 'pin');
  select * into est from public.trip_estimate_road(p_from, a.lat, a.lng, p_to, b.lat, b.lng, p_road);
  for v in select * from public.vehicles where enabled order by sort loop
    q := public.fare_quote(v, est.km, est.mins, p_ac);
    disc := 0; c := null;
    if p_coupon is not null and p_coupon <> '' then c := public.coupon_eval(p_coupon, uid, v.id, (q->>'fare')::int, p_to); disc := coalesce((c->>'discount')::int, 0); end if;
    opts := opts || jsonb_build_object('id', v.id, 'name', v.name, 'tagline', v.tagline, 'seats', v.seats, 'ac', v.ac, 'eta', v.eta,
      'cancel_fee', v.cancel_fee, 'fare', (q->>'fare')::int, 'alt_fare', (public.fare_quote(v, est.km, est.mins, not p_ac)->>'fare')::int,
      'lines', q->'lines', 'available', public.available_drivers(v.id, p_ac), 'discount', disc, 'coupon', c,
      'booking_fee', public.booking_fee_for((q->>'fare')::int - disc),
      'share', case when v.share_on then jsonb_build_object(
        'seats', v.seats - 1,
        'fare', public.share_fare((q->>'fare')::int, 1), 'fare2', public.share_fare((q->>'fare')::int, 2),
        'booking_fee', public.booking_fee_for(public.share_fare((q->>'fare')::int, 1)),
        'booking_fee2', public.booking_fee_for(public.share_fare((q->>'fare')::int, 2))) end);
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
        'discount', disc, 'coupon', c, 'booking_fee', public.booking_fee_for(f - disc), 'available', public.available_drivers(v.id, p_ac));
    end loop;
  end loop;
  for pw in select * from public.parcel_weights order by sort loop
    select * into v from public.vehicles where id = pw.vehicle;
    f := (public.fare_quote(v, est.km, est.mins, false)->>'fare')::int + pw.fee;
    disc := 0; c := null;
    if p_coupon is not null and p_coupon <> '' then c := public.coupon_eval(p_coupon, uid, v.id, f, p_to); disc := coalesce((c->>'discount')::int, 0); end if;
    parcels := parcels || jsonb_build_object('id', pw.id, 'label', pw.label, 'sub', pw.sub, 'vehicle', pw.vehicle, 'fee', pw.fee, 'fare', f, 'discount', disc, 'coupon', c,
      'booking_fee', public.booking_fee_for(f - disc), 'available', public.available_drivers(pw.vehicle, false));
  end loop;
  return jsonb_build_object('km', est.km, 'mins', est.mins, 'road', est.road, 'options', opts, 'any', any_best, 'booking_fee', s.booking_fee, 'booking_fee_above', s.booking_fee_above, 'share_off', s.share_off, 'rentals', rentals, 'parcels', parcels,
    'any_available', (select coalesce(sum(public.available_drivers(x, p_ac)), 0) from unnest(array['mini','sedan','suv']) x));
end $$;

create or replace function public.book_ride(p jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := public.require_user(); prof public.profiles; v_opt text := p->>'option'; v public.vehicles; est record; q jsonb;
        v_req text[]; v_svc text; v_fare int; v_disc int := 0; c jsonb; v_code text; v_coupon_vehicle text; r public.rides; existing public.rides;
        v_when timestamptz; pw public.parcel_weights; rp public.rental_packages; v_ac boolean := coalesce((p->>'ac')::boolean, true);
        v_km numeric; v_mins int; v_parcel jsonb; v_rental jsonb; v_passenger jsonb; v_pay text := p->>'pay'; v_idem text := p->>'idem';
        v_add int; v_plat double precision; v_plng double precision; v_paddr text; v_pname text;
        dp record; v_dname text; v_daddr text; v_book int; v_share int := 0;
begin
  select * into prof from public.profiles where id = uid for update;          -- serialises bookings per customer
  if prof.blocked then raise exception 'your account is blocked — contact support' using errcode = '42501'; end if;
  if prof.phone is null then raise exception 'sign in with your mobile number to book' using errcode = '42501'; end if;
  if v_idem is null or char_length(v_idem) not between 8 and 64 then raise exception 'missing idempotency key' using errcode = '22023'; end if;
  select * into existing from public.rides where customer_id = uid and idempotency_key = v_idem;
  if found then return jsonb_build_object('id', existing.id, 'code', existing.code, 'status', existing.status, 'duplicate', true); end if;
  v_add := case when coalesce(p->>'add_on', '0') ~ '^\d{1,3}$' then coalesce((p->>'add_on')::int, 0) else -1 end;
  if v_add not in (0, 10, 20, 30) then raise exception 'add-on must be ₹10, ₹20 or ₹30' using errcode = '22023'; end if;
  if v_pay not in ('Cash','UPI','Card','Wallet') then raise exception 'invalid payment method' using errcode = '22023'; end if;
  if p->>'from' = p->>'to' then raise exception 'pickup and drop must be different' using errcode = '22023'; end if;
  if not exists (select 1 from public.places where id = p->>'from') or not exists (select 1 from public.places where id = p->>'to') then
    raise exception 'unknown place' using errcode = '22023'; end if;
  -- 'cur' pickup: the phone's GPS fix or a searched place. Older clients send none and keep the stand-in place.
  if p->>'from' = 'cur' and jsonb_typeof(p->'pickup') = 'object' then
    if jsonb_typeof(p->'pickup'->'lat') <> 'number' or jsonb_typeof(p->'pickup'->'lng') <> 'number' then
      raise exception 'invalid pickup position' using errcode = '22023'; end if;
    v_plat := (p->'pickup'->>'lat')::double precision; v_plng := (p->'pickup'->>'lng')::double precision;
    v_paddr := nullif(trim(coalesce(p->'pickup'->>'address', '')), '');
    v_pname := nullif(trim(coalesce(p->'pickup'->>'name', '')), '');
    if v_plat not between -90 and 90 or v_plng not between -180 and 180 or char_length(coalesce(v_paddr, '')) > 200
       or char_length(coalesce(v_pname, '')) > 120 then
      raise exception 'invalid pickup position' using errcode = '22023'; end if;
  end if;
  -- 'pin' drop: a searched place, which must come with its position and name.
  select * into dp from public.client_pos(p->'drop', p->>'to' = 'pin', p->>'to' = 'pin');
  if p->>'to' = 'pin' then
    v_dname := nullif(trim(coalesce(p->'drop'->>'name', '')), '');
    v_daddr := nullif(trim(coalesce(p->'drop'->>'address', '')), '');
    if v_dname is null or char_length(v_dname) > 120 or char_length(coalesce(v_daddr, '')) > 200 then
      raise exception 'invalid drop location' using errcode = '22023'; end if;
  end if;
  select * into est from public.trip_estimate_road(p->>'from', v_plat, v_plng, p->>'to', dp.lat, dp.lng, p->'road');
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
    -- Sharing: 1 or 2 seats at the admin's sharing price; the rider may pick up others going the same way.
    if coalesce(p->>'share', '0') not in ('0', 'false', '') then
      v_share := case when p->>'share' ~ '^[12]$' then (p->>'share')::int else 0 end;
      if v_share = 0 then raise exception 'a shared ride is for 1 or 2 seats' using errcode = '22023'; end if;
      if not v.share_on then raise exception 'sharing isn''t available on %', v.name using errcode = '22023'; end if;
      if p->>'when' is not null then raise exception 'sharing is only for rides now, not scheduled ones' using errcode = '22023'; end if;
      if v_share >= v.seats then raise exception 'a shared % has room for % seat', v.name, v.seats - 1 using errcode = '22023'; end if;
      v_fare := public.share_fare(v_fare, v_share);
    end if;
  end if;
  if v_share = 0 and coalesce(p->>'share', '0') not in ('0', 'false', '') then
    raise exception 'sharing is only for a single vehicle type' using errcode = '22023'; end if;

  v_code := nullif(upper(trim(coalesce(p->>'coupon', ''))), '');
  if v_code is not null then
    perform 1 from public.coupons where coupons.code = v_code for update;     -- serialise the last available use
    c := public.coupon_eval(v_code, uid, v_coupon_vehicle, v_fare, p->>'to');
    if not (c->>'ok')::boolean then raise exception 'coupon: %', c->>'reason' using errcode = '22023'; end if;
    v_disc := (c->>'discount')::int;
  end if;
  v_book := public.booking_fee_for(v_fare - v_disc);                         -- on the payable fare, before any add-on
  v_fare := v_fare + v_add;                                                  -- add-on goes on after the coupon check

  if p->>'when' is not null then
    v_when := (p->>'when')::timestamptz;
    if v_when < now() + interval '20 minutes' or v_when > now() + interval '7 days' then
      raise exception 'scheduled time must be between 20 minutes and 7 days from now' using errcode = '22023'; end if;
  end if;

  begin
    insert into public.rides (customer_id, service, requested_vehicles, vehicle, ac, from_place, to_place, km, mins, fare, discount, coupon_code,
      total, pay_method, status, scheduled_for, passenger, parcel, rental, idempotency_key, searching_since, add_on,
      pickup_lat, pickup_lng, pickup_address, pickup_name, drop_lat, drop_lng, drop_name, drop_address, booking_fee, shared, seats)
    values (uid, v_svc, v_req, case when v_svc = 'any' then null else v_req[1] end, v_ac, p->>'from', p->>'to', v_km, v_mins, v_fare, v_disc, v_code,
      v_fare - v_disc + v_book, v_pay, case when v_when is null then 'Searching' else 'Scheduled' end, v_when, v_passenger, v_parcel, v_rental, v_idem,
      case when v_when is null then now() end, v_add, v_plat, v_plng, v_paddr, v_pname, dp.lat, dp.lng, v_dname, v_daddr, v_book, v_share > 0, greatest(v_share, 1))
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

create or replace function public.driver_offers() returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := public.require_user(); d public.drivers; s public.settings; dv public.vehicles; bal int; n int; used int; all_shared boolean;
begin
  select * into s from public.settings;
  update public.drivers set last_seen = now() where id = uid and online returning * into d;
  if not found or d.kyc <> 'Approved' or d.suspended then return '[]'::jsonb; end if;
  select * into dv from public.vehicles where id = d.vehicle;
  -- On a trip: nothing, unless every trip is shared — then only shared requests that fit the free seats and the way.
  select count(*), coalesce(sum(seats), 0), coalesce(bool_and(shared), true) into n, used, all_shared
    from public.rides where driver_id = uid and status in ('Arriving','Arrived','Started');
  if n > 0 and not (all_shared and dv.share_on) then return '[]'::jsonb; end if;
  bal := public.driver_balance(uid);
  return coalesce((select jsonb_agg(public.ride_view(r, false) || jsonb_build_object('fare', r.fare, 'earn',
      r.fare - least(public.platform_fee_for(d.vehicle, r.ac), r.fare)) order by r.created_at)
    from public.rides r
    where r.status = 'Searching' and d.vehicle = any (r.requested_vehicles)
      and r.searching_since > now() - make_interval(secs => s.search_timeout_sec)
      and (not r.ac or not dv.ac or d.ac)
      and r.customer_id <> uid
      and (n = 0 or (r.shared and used + r.seats < dv.seats + 1 and public.share_fits(uid, r)))
      and public.platform_fee_for(d.vehicle, r.ac) <= bal
      and not exists (select 1 from public.driver_declines x where x.ride_id = r.id and x.driver_id = uid)), '[]'::jsonb);
end $$;

create or replace function public.accept_ride(p_ride uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := public.require_user(); d public.drivers; dv public.vehicles; r public.rides; s public.settings; fee int; bal int; nr public.rides; n int; used int; all_shared boolean;
begin
  select * into s from public.settings;
  select * into d from public.drivers where id = uid for update;               -- one accept at a time per driver
  if not found or d.kyc <> 'Approved' then raise exception 'your account is not approved' using errcode = '42501'; end if;
  if d.suspended then raise exception 'your account is suspended' using errcode = '42501'; end if;
  if not d.online then raise exception 'go online to accept rides' using errcode = 'P0001'; end if;
  select * into dv from public.vehicles where id = d.vehicle;
  fee := public.platform_fee_for(d.vehicle, coalesce((select ac from public.rides where id = p_ride), false));
  bal := public.driver_balance(uid);
  if bal < fee then
    raise exception 'recharge your wallet to take rides — ₹% platform fee needed, balance ₹%', fee, bal using errcode = 'P0001';
  end if;
  -- A second (third…) passenger only on a shared trip, within the free seats and going the same way.
  select count(*), coalesce(sum(seats), 0), coalesce(bool_and(shared), true) into n, used, all_shared
    from public.rides where driver_id = uid and status in ('Arriving','Arrived','Started');
  if n > 0 then
    select * into nr from public.rides where id = p_ride;
    if not (all_shared and coalesce(nr.shared, false) and dv.share_on) then raise exception 'finish your current trip first' using errcode = 'P0001'; end if;
    if used + nr.seats > dv.seats then raise exception 'no free seats for this shared ride' using errcode = 'P0001'; end if;
    if not public.share_fits(uid, nr) then raise exception 'this shared ride isn''t on your way' using errcode = 'P0001'; end if;
  end if;
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

-- Every live trip of the rider, for the shared-trip screen (my_trip stays for older apps: the latest one).
create or replace function public.my_trips() returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := public.require_user();
begin
  return coalesce((select jsonb_agg(public.ride_view(r, false) order by r.assigned_at) from public.rides r
    where r.driver_id = uid and (r.status in ('Arriving','Arrived','Started')
      or (r.status = 'Completed' and r.payment_status = 'pending' and r.pay_method = 'Cash')
      or (r.status = 'Completed' and r.driver_closed_at is null and r.completed_at > now() - interval '1 hour'))), '[]'::jsonb);
end $$;
revoke all on function public.my_trips() from public, anon;
grant execute on function public.my_trips() to authenticated;

-- The rider's position goes to every passenger on a shared trip.
create or replace function public.report_location(p_lat double precision, p_lng double precision, p_heading real default null, p_accuracy real default null)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := public.require_user();
begin
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'invalid position' using errcode = '22023'; end if;
  if public.account_blocked(uid) then return; end if;
  insert into public.ride_tracks (ride_id, driver_id, lat, lng, heading, accuracy, at)
  select r.id, uid, p_lat, p_lng, case when p_heading >= 0 and p_heading < 360 then p_heading end, greatest(p_accuracy, 0), now()
    from public.rides r where r.driver_id = uid and r.status in ('Arriving','Arrived','Started')
  on conflict (ride_id) do update set lat = excluded.lat, lng = excluded.lng, heading = excluded.heading, accuracy = excluded.accuracy, at = excluded.at;
end $$;

create or replace function public.admin_update_vehicle(p_id text, p jsonb) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.require_admin();
  if coalesce((p->>'ac')::boolean, false) and p_id in ('bike', 'auto', 'erick') then raise exception 'this vehicle type cannot be AC' using errcode = '22023'; end if;
  if coalesce((p->>'share_on')::boolean, false) and p_id = 'bike' then raise exception 'bikes can''t be shared' using errcode = '22023'; end if;
  if coalesce((p->>'base')::numeric, 0) > 1000 then raise exception 'base fare can be at most ₹1000' using errcode = '22023'; end if;
  if coalesce((p->>'per_km')::numeric, 0) > 100 then raise exception 'per-km rate can be at most ₹100' using errcode = '22023'; end if;
  if coalesce((p->>'per_min')::numeric, 0) > 10 then raise exception 'per-minute rate can be at most ₹10' using errcode = '22023'; end if;
  if coalesce((p->>'min_fare')::numeric, 0) > 2000 then raise exception 'minimum fare can be at most ₹2000' using errcode = '22023'; end if;
  if coalesce((p->>'cancel_fee')::numeric, 0) > 500 then raise exception 'cancellation fee can be at most ₹500' using errcode = '22023'; end if;
  update public.vehicles set
    base = coalesce((p->>'base')::int, base), per_km = coalesce((p->>'per_km')::numeric, per_km),
    per_min = coalesce((p->>'per_min')::numeric, per_min), min_fare = coalesce((p->>'min_fare')::int, min_fare),
    cancel_fee = coalesce((p->>'cancel_fee')::int, cancel_fee), ac = coalesce((p->>'ac')::boolean, ac),
    enabled = coalesce((p->>'enabled')::boolean, enabled), share_on = coalesce((p->>'share_on')::boolean, share_on),
    platform_fee = coalesce((p->>'platform_fee')::int, platform_fee),
    platform_fee_non_ac = coalesce((p->>'platform_fee_non_ac')::int, platform_fee_non_ac), updated_at = now()
  where id = p_id;                                                             -- CHECK constraints reject out-of-range values
  if not found then raise exception 'vehicle not found' using errcode = 'P0002'; end if;
  perform public.audit('update_vehicle', p_id, p);
end $$;

create or replace function public.admin_update_settings(p jsonb) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.require_admin();
  if coalesce((p->>'referral_referrer_bonus')::int, 0) not between 0 and 5000 or coalesce((p->>'referral_new_bonus')::int, 0) not between 0 and 5000 then
    raise exception 'referral bonus must be ₹0–₹5000' using errcode = '22023'; end if;
  if coalesce((p->>'referral_rides')::int, 1) not between 1 and 500 then raise exception 'rides for the referral bonus must be 1–500' using errcode = '22023'; end if;
  if coalesce((p->>'share_off')::int, 0) not between 0 and 60 then raise exception 'sharing discount must be 0–60%%' using errcode = '22023'; end if;
  if coalesce((p->>'share_pickup_km')::numeric, 1) not between 0.5 and 10 then raise exception 'sharing pickup distance must be 0.5–10 km' using errcode = '22023'; end if;
  update public.settings set
    share_off = coalesce((p->>'share_off')::int, share_off), share_pickup_km = coalesce((p->>'share_pickup_km')::numeric, share_pickup_km),
    surge_on = coalesce((p->>'surge_on')::boolean, surge_on), surge_mult = coalesce((p->>'surge_mult')::numeric, surge_mult),
    booking_fee = coalesce((p->>'booking_fee')::int, booking_fee), booking_fee_above = coalesce((p->>'booking_fee_above')::int, booking_fee_above),
    referral_on = coalesce((p->>'referral_on')::boolean, referral_on),
    referral_referrer_bonus = coalesce((p->>'referral_referrer_bonus')::int, referral_referrer_bonus),
    referral_new_bonus = coalesce((p->>'referral_new_bonus')::int, referral_new_bonus),
    referral_rides = coalesce((p->>'referral_rides')::int, referral_rides),
    updated_at = now();
  perform public.audit('update_settings', 'settings', p);
end $$;
