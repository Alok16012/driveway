-- Flat platform fee per completed ride instead of a percentage commission, plus a customer booking charge.
--  · Each vehicle has an AC and a non-AC fee in rupees (Bike ₹5, Non-AC car ₹6, AC car ₹8 by default).
--    It is taken only when a ride completes; the cancellation fee goes to the driver in full.
--  · The rider pre-loads their wallet (₹50 to start). A ride is only offered to, or accepted by, a rider
--    whose wallet balance covers that ride's platform fee; after a recharge rides come through again.
--  · The customer pays a booking charge (₹5) when the payable fare (after coupon, before any add-on) is
--    above ₹50. It goes to DriveWay, and is shown as its own line on the fare.
-- Rides finished before this migration keep the percentage they were charged (rides.commission_pct).

alter table public.vehicles add column if not exists platform_fee int;
alter table public.vehicles add column if not exists platform_fee_non_ac int;
update public.vehicles set platform_fee = case id when 'bike' then 5 when 'erick' then 5 when 'auto' then 6 else 8 end where platform_fee is null;
update public.vehicles set platform_fee_non_ac = case id when 'bike' then 5 when 'erick' then 5 else 6 end where platform_fee_non_ac is null;
alter table public.vehicles alter column platform_fee set not null;
alter table public.vehicles alter column platform_fee set default 8;
alter table public.vehicles alter column platform_fee_non_ac set not null;
alter table public.vehicles alter column platform_fee_non_ac set default 6;
alter table public.vehicles drop constraint if exists vehicles_platform_fee_check;
alter table public.vehicles add constraint vehicles_platform_fee_check check (platform_fee between 0 and 100);
alter table public.vehicles drop constraint if exists vehicles_platform_fee_non_ac_check;
alter table public.vehicles add constraint vehicles_platform_fee_non_ac_check check (platform_fee_non_ac between 0 and 100);

alter table public.settings add column if not exists booking_fee int not null default 5;
alter table public.settings add column if not exists booking_fee_above int not null default 50;
alter table public.settings drop constraint if exists settings_booking_fee_check;
alter table public.settings add constraint settings_booking_fee_check check (booking_fee between 0 and 100);
alter table public.settings drop constraint if exists settings_booking_fee_above_check;
alter table public.settings add constraint settings_booking_fee_above_check check (booking_fee_above between 0 and 10000);

alter table public.rides add column if not exists platform_fee int check (platform_fee >= 0);      -- set when the ride completes
alter table public.rides add column if not exists booking_fee int not null default 0 check (booking_fee >= 0);

alter table public.ledger drop constraint if exists ledger_kind_check;
alter table public.ledger add constraint ledger_kind_check check (kind in ('payment','wallet_debit','wallet_credit','refund','driver_earning','cash_collected',
  'commission','discount','cancel_fee','incentive','payout','payout_fee','dues_paid','adjustment','booking_fee'));

-- The fee for a ride is set by what the customer booked: an AC ride in an AC category uses the AC fee.
create or replace function public.platform_fee_for(p_vehicle text, p_ac boolean) returns int
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select case when p_ac and ac then platform_fee else platform_fee_non_ac end from public.vehicles where id = p_vehicle), 0)
$$;
revoke all on function public.platform_fee_for(text, boolean) from public, anon, authenticated;

create or replace function public.booking_fee_for(p_fare int) returns int
language sql stable security definer set search_path = public, pg_temp as $$
  select case when p_fare > booking_fee_above then booking_fee else 0 end from public.settings
$$;
revoke all on function public.booking_fee_for(int) from public, anon, authenticated;

create or replace function public.driver_balance(p_driver uuid) returns int
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(sum(amount), 0)::int from public.ledger where user_id = p_driver and party = 'driver'
$$;
revoke all on function public.driver_balance(uuid) from public, anon, authenticated;

create or replace function public.quote(p_from text, p_to text, p_ac boolean default true, p_coupon text default null,
  p_from_pos jsonb default null, p_to_pos jsonb default null)
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
  select * into est from public.trip_estimate_at(p_from, a.lat, a.lng, p_to, b.lat, b.lng);
  for v in select * from public.vehicles where enabled order by sort loop
    q := public.fare_quote(v, est.km, est.mins, p_ac);
    disc := 0; c := null;
    if p_coupon is not null and p_coupon <> '' then c := public.coupon_eval(p_coupon, uid, v.id, (q->>'fare')::int, p_to); disc := coalesce((c->>'discount')::int, 0); end if;
    opts := opts || jsonb_build_object('id', v.id, 'name', v.name, 'tagline', v.tagline, 'seats', v.seats, 'ac', v.ac, 'eta', v.eta,
      'cancel_fee', v.cancel_fee, 'fare', (q->>'fare')::int, 'alt_fare', (public.fare_quote(v, est.km, est.mins, not p_ac)->>'fare')::int,
      'lines', q->'lines', 'available', public.available_drivers(v.id, p_ac), 'discount', disc, 'coupon', c,
      'booking_fee', public.booking_fee_for((q->>'fare')::int - disc));
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
  return jsonb_build_object('km', est.km, 'mins', est.mins, 'options', opts, 'any', any_best, 'booking_fee', s.booking_fee, 'booking_fee_above', s.booking_fee_above, 'rentals', rentals, 'parcels', parcels,
    'any_available', (select coalesce(sum(public.available_drivers(x, p_ac)), 0) from unnest(array['mini','sedan','suv']) x));
end $$;

create or replace function public.book_ride(p jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := public.require_user(); prof public.profiles; v_opt text := p->>'option'; v public.vehicles; est record; q jsonb;
        v_req text[]; v_svc text; v_fare int; v_disc int := 0; c jsonb; v_code text; v_coupon_vehicle text; r public.rides; existing public.rides;
        v_when timestamptz; pw public.parcel_weights; rp public.rental_packages; v_ac boolean := coalesce((p->>'ac')::boolean, true);
        v_km numeric; v_mins int; v_parcel jsonb; v_rental jsonb; v_passenger jsonb; v_pay text := p->>'pay'; v_idem text := p->>'idem';
        v_add int; v_plat double precision; v_plng double precision; v_paddr text; v_pname text;
        dp record; v_dname text; v_daddr text; v_book int;
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
  select * into est from public.trip_estimate_at(p->>'from', v_plat, v_plng, p->>'to', dp.lat, dp.lng);
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
      pickup_lat, pickup_lng, pickup_address, pickup_name, drop_lat, drop_lng, drop_name, drop_address, booking_fee)
    values (uid, v_svc, v_req, case when v_svc = 'any' then null else v_req[1] end, v_ac, p->>'from', p->>'to', v_km, v_mins, v_fare, v_disc, v_code,
      v_fare - v_disc + v_book, v_pay, case when v_when is null then 'Searching' else 'Scheduled' end, v_when, v_passenger, v_parcel, v_rental, v_idem,
      case when v_when is null then now() end, v_add, v_plat, v_plng, v_paddr, v_pname, dp.lat, dp.lng, v_dname, v_daddr, v_book)
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

create or replace function public.finish_ride(p_ride uuid) returns public.rides
language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.rides; fee int; gross int; today date := (now() at time zone 'Asia/Kolkata')::date; inc public.incentives;
begin
  select * into r from public.rides where id = p_ride for update;
  if r.status = 'Completed' then return r; end if;
  if r.status <> 'Started' then raise exception 'the trip has not started' using errcode = 'P0001'; end if;
  gross := r.fare + r.wait_fee;
  fee := least(public.platform_fee_for(r.vehicle, r.ac), gross);
  update public.rides set status = 'Completed', completed_at = now(), platform_fee = fee, total = r.fare - r.discount + r.wait_fee + r.booking_fee,
    payment_status = case when r.fare - r.discount + r.wait_fee + r.booking_fee = 0 then 'paid' else 'pending' end
    where id = r.id returning * into r;
  insert into public.ledger (idem, ride_id, user_id, party, kind, amount, note) values
    ('ride:' || r.id || ':driver_earning', r.id, r.driver_id, 'driver', 'driver_earning', gross - fee, 'Trip ' || r.code),
    ('ride:' || r.id || ':commission', r.id, null, 'platform', 'commission', fee, 'Platform fee ' || r.code)
  on conflict (idem) do nothing;
  if r.booking_fee > 0 then
    insert into public.ledger (idem, ride_id, user_id, party, kind, amount, note)
    values ('ride:' || r.id || ':booking_fee', r.id, null, 'platform', 'booking_fee', r.booking_fee, 'Booking charge ' || r.code)
    on conflict (idem) do nothing;
  end if;
  if r.discount > 0 then
    insert into public.ledger (idem, ride_id, user_id, party, kind, amount, note)
    values ('ride:' || r.id || ':discount', r.id, null, 'platform', 'discount', -r.discount, 'Coupon ' || r.coupon_code || ' · ' || r.code)
    on conflict (idem) do nothing;
  end if;
  update public.drivers set trips = trips + 1 where id = r.driver_id;
  -- Incentives: each pays at most once per window (idempotency key includes the window).
  for inc in select * from public.incentives where active loop
    if public.incentive_progress(r.driver_id, inc.kind) >= inc.target then
      insert into public.ledger (idem, user_id, party, kind, amount, note)
      values ('incentive:' || inc.id || ':' || r.driver_id || ':' ||
              case inc.kind when 'week' then to_char(date_trunc('week', now() at time zone 'Asia/Kolkata'), 'YYYY-MM-DD') else today::text end,
              r.driver_id, 'driver', 'incentive', inc.reward, inc.title || ' bonus')
      on conflict (idem) do nothing;
    end if;
  end loop;
  return r;
end $$;

-- The platform fee is only taken on completed rides, so the driver keeps the whole cancellation fee.
create or replace function public.cancel_ride(p_ride uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := public.require_user(); r public.rides; s public.settings; fee int := 0; v public.vehicles;
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
    cancel_fee = fee, discount = 0, booking_fee = 0, total = fee, payment_status = case when fee > 0 then 'pending' else payment_status end
    where id = r.id returning * into r;
  update public.coupon_redemptions set released = true where ride_id = r.id;
  update public.coupons set uses = greatest(0, uses - 1) where code = r.coupon_code;
  if fee > 0 then
    insert into public.ledger (idem, ride_id, user_id, party, kind, amount, note)
    values ('ride:' || r.id || ':cancel_fee_driver', r.id, r.driver_id, 'driver', 'cancel_fee', fee, 'Cancellation fee · ' || r.code)
    on conflict (idem) do nothing;
  end if;
  return public.ride_view(r, true);
end $$;

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
    'cancel_fee', r.cancel_fee, 'booking_fee', r.booking_fee, 'total', r.total, 'pay', r.pay_method, 'payment_status', r.payment_status, 'refunded', r.refunded,
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

-- Only rides whose platform fee the rider's wallet can cover are offered.
create or replace function public.driver_offers() returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := public.require_user(); d public.drivers; s public.settings; dv public.vehicles; bal int;
begin
  select * into s from public.settings;
  update public.drivers set last_seen = now() where id = uid and online returning * into d;
  if not found or d.kyc <> 'Approved' or d.suspended then return '[]'::jsonb; end if;
  if exists (select 1 from public.rides where driver_id = uid and status in ('Arriving','Arrived','Started')) then return '[]'::jsonb; end if;
  select * into dv from public.vehicles where id = d.vehicle;
  bal := public.driver_balance(uid);
  return coalesce((select jsonb_agg(public.ride_view(r, false) || jsonb_build_object('fare', r.fare, 'earn',
      r.fare - least(public.platform_fee_for(d.vehicle, r.ac), r.fare)) order by r.created_at)
    from public.rides r
    where r.status = 'Searching' and d.vehicle = any (r.requested_vehicles)
      and r.searching_since > now() - make_interval(secs => s.search_timeout_sec)
      and (not r.ac or not dv.ac or d.ac)
      and r.customer_id <> uid
      and public.platform_fee_for(d.vehicle, r.ac) <= bal
      and not exists (select 1 from public.driver_declines x where x.ride_id = r.id and x.driver_id = uid)), '[]'::jsonb);
end $$;

-- Accept: exactly one driver wins; stale/expired/cancelled requests are refused, and so is a rider
-- whose wallet cannot cover the ride's platform fee.
create or replace function public.accept_ride(p_ride uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := public.require_user(); d public.drivers; dv public.vehicles; r public.rides; s public.settings; fee int; bal int;
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

create or replace function public.my_driver() returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := public.require_user(); d public.drivers; s public.settings; today date := (now() at time zone 'Asia/Kolkata')::date; bal int;
        fee int; fee_min int;
begin
  select * into d from public.drivers where id = uid;
  if not found then return null; end if;
  select * into s from public.settings;
  bal := public.driver_balance(uid);
  fee := public.platform_fee_for(d.vehicle, d.ac);
  fee_min := least(fee, public.platform_fee_for(d.vehicle, false));
  return to_jsonb(d) - 'docs' || jsonb_build_object(
    'phone', (select phone from public.profiles where id = uid),
    'balance', bal,
    'platform_fee', fee, 'platform_fee_non_ac', public.platform_fee_for(d.vehicle, false), 'needs_recharge', bal < fee_min,
    'free_wait_sec', s.free_wait_sec, 'wait_fee_per_min', s.wait_fee_per_min,
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

create or replace function public.admin_update_vehicle(p_id text, p jsonb) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.require_admin();
  update public.vehicles set
    base = coalesce((p->>'base')::int, base), per_km = coalesce((p->>'per_km')::numeric, per_km),
    per_min = coalesce((p->>'per_min')::numeric, per_min), min_fare = coalesce((p->>'min_fare')::int, min_fare),
    cancel_fee = coalesce((p->>'cancel_fee')::int, cancel_fee), ac = coalesce((p->>'ac')::boolean, ac),
    enabled = coalesce((p->>'enabled')::boolean, enabled),
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
  update public.settings set
    surge_on = coalesce((p->>'surge_on')::boolean, surge_on), surge_mult = coalesce((p->>'surge_mult')::numeric, surge_mult),
    booking_fee = coalesce((p->>'booking_fee')::int, booking_fee), booking_fee_above = coalesce((p->>'booking_fee_above')::int, booking_fee_above),
    updated_at = now();
  perform public.audit('update_settings', 'settings', p);
end $$;
