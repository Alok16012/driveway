-- Google Maps search. Pickup and drop can be any place the customer searches, not only the fixed places:
--   · pickup 'cur' + pickup {lat, lng, name?, address} — the phone's GPS fix or a searched place;
--   · drop 'pin' + drop {lat, lng, name, address} — a searched place.
-- Trips with such an end are priced on real distance (straight line × 1.35 for roads); trips between fixed
-- places keep their old estimate, so their fares don't change. Fixed places get their coordinates for this.

alter table public.places add column if not exists lat double precision check (lat between -90 and 90);
alter table public.places add column if not exists lng double precision check (lng between -180 and 180);
update public.places p set lat = v.lat, lng = v.lng
from (values
  ('cur', 22.553, 88.3525), ('home', 22.5765, 88.4318), ('work', 22.5806, 88.4627), ('dlf', 22.5016, 88.3616),
  ('airport', 22.652, 88.4463), ('cp', 22.5646, 88.351), ('botanical', 22.5675, 88.37), ('akshardham', 22.5448, 88.3426),
  ('gip', 22.5392, 88.3654)
) as v(id, lat, lng)
where p.id = v.id;
-- Stand-in for a searched drop; the ride keeps the real name and position. Hidden from the places list.
insert into public.places (id, name, address, kind) values ('pin', 'Chosen place', 'Searched place', null) on conflict do nothing;

alter table public.rides add column if not exists pickup_name text check (char_length(pickup_name) <= 120);
alter table public.rides add column if not exists drop_lat double precision check (drop_lat between -90 and 90);
alter table public.rides add column if not exists drop_lng double precision check (drop_lng between -180 and 180);
alter table public.rides add column if not exists drop_name text check (char_length(drop_name) <= 120);
alter table public.rides add column if not exists drop_address text check (char_length(drop_address) <= 200);
alter table public.rides drop constraint if exists rides_drop_pos_check;
alter table public.rides add constraint rides_drop_pos_check check ((drop_lat is null) = (drop_lng is null));

-- A position sent by the app, as {lat, lng}. Null when absent; an error when malformed, sent where it isn't
-- `allowed`, or missing where it is `required`.
create or replace function public.client_pos(p jsonb, allowed boolean, required boolean, out lat double precision, out lng double precision)
language plpgsql immutable as $$
begin
  if p is null or jsonb_typeof(p) = 'null' then
    if required then raise exception 'choose a location on the map' using errcode = '22023'; end if;
    return;
  end if;
  if not allowed or jsonb_typeof(p) <> 'object' or jsonb_typeof(p->'lat') <> 'number' or jsonb_typeof(p->'lng') <> 'number' then
    raise exception 'invalid position' using errcode = '22023'; end if;
  lat := (p->>'lat')::double precision; lng := (p->>'lng')::double precision;
  if lat not between -90 and 90 or lng not between -180 and 180 then raise exception 'invalid position' using errcode = '22023'; end if;
end $$;

-- Distance and time between two ends, each a place id plus an optional position the app located.
create or replace function public.trip_estimate_at(a text, a_lat double precision, a_lng double precision,
  b text, b_lat double precision, b_lng double precision, out km numeric, out mins int)
language plpgsql stable set search_path = public, pg_temp as $$
declare pa public.places; pb public.places; d double precision;
begin
  if a_lat is null and b_lat is null then select e.km, e.mins into km, mins from public.trip_estimate(a, b) e; return; end if;
  select * into pa from public.places where id = a;
  select * into pb from public.places where id = b;
  a_lat := coalesce(a_lat, pa.lat); a_lng := coalesce(a_lng, pa.lng);
  b_lat := coalesce(b_lat, pb.lat); b_lng := coalesce(b_lng, pb.lng);
  if a_lat is null or b_lat is null then raise exception 'unknown place' using errcode = '22023'; end if;
  d := 2 * 6371 * asin(sqrt(sin(radians(b_lat - a_lat) / 2) ^ 2 + cos(radians(a_lat)) * cos(radians(b_lat)) * sin(radians(b_lng - a_lng) / 2) ^ 2));
  if d < 0.05 then raise exception 'pickup and drop must be different' using errcode = '22023'; end if;
  km := greatest(round((d * 1.35)::numeric, 1), 0.5);
  if km > 300 then raise exception 'that trip is too long — pick a drop within 300 km' using errcode = '22023'; end if;
  mins := round(km * 2.6 + 4)::int;
end $$;

drop function if exists public.quote(text, text, boolean, text);
create or replace function public.quote(p_from text, p_to text, p_ac boolean default true, p_coupon text default null,
  p_from_pos jsonb default null, p_to_pos jsonb default null)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare uid uuid := public.require_user(); est record; v public.vehicles; q jsonb; opts jsonb := '[]'::jsonb; any_best jsonb;
        rentals jsonb := '[]'::jsonb; parcels jsonb := '[]'::jsonb; rp public.rental_packages; pw public.parcel_weights; f int; c jsonb; disc int;
        a record; b record;
begin
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

create or replace function public.book_ride(p jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := public.require_user(); prof public.profiles; v_opt text := p->>'option'; v public.vehicles; est record; q jsonb;
        v_req text[]; v_svc text; v_fare int; v_disc int := 0; c jsonb; v_code text; v_coupon_vehicle text; r public.rides; existing public.rides;
        v_when timestamptz; pw public.parcel_weights; rp public.rental_packages; v_ac boolean := coalesce((p->>'ac')::boolean, true);
        v_km numeric; v_mins int; v_parcel jsonb; v_rental jsonb; v_passenger jsonb; v_pay text := p->>'pay'; v_idem text := p->>'idem';
        v_add int; v_plat double precision; v_plng double precision; v_paddr text; v_pname text;
        dp record; v_dname text; v_daddr text;
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
  v_fare := v_fare + v_add;                                                  -- add-on goes on after the coupon check

  if p->>'when' is not null then
    v_when := (p->>'when')::timestamptz;
    if v_when < now() + interval '20 minutes' or v_when > now() + interval '7 days' then
      raise exception 'scheduled time must be between 20 minutes and 7 days from now' using errcode = '22023'; end if;
  end if;

  begin
    insert into public.rides (customer_id, service, requested_vehicles, vehicle, ac, from_place, to_place, km, mins, fare, discount, coupon_code,
      total, pay_method, status, scheduled_for, passenger, parcel, rental, idempotency_key, searching_since, add_on,
      pickup_lat, pickup_lng, pickup_address, pickup_name, drop_lat, drop_lng, drop_name, drop_address)
    values (uid, v_svc, v_req, case when v_svc = 'any' then null else v_req[1] end, v_ac, p->>'from', p->>'to', v_km, v_mins, v_fare, v_disc, v_code,
      v_fare - v_disc, v_pay, case when v_when is null then 'Searching' else 'Scheduled' end, v_when, v_passenger, v_parcel, v_rental, v_idem,
      case when v_when is null then now() end, v_add, v_plat, v_plng, v_paddr, v_pname, dp.lat, dp.lng, v_dname, v_daddr)
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
    'cancel_fee', r.cancel_fee, 'total', r.total, 'pay', r.pay_method, 'payment_status', r.payment_status, 'refunded', r.refunded,
    'scheduled_for', r.scheduled_for, 'passenger', r.passenger, 'parcel', r.parcel, 'rental', r.rental,
    'cancel_reason', r.cancel_reason, 'cancelled_by', r.cancelled_by, 'rating', r.rating,
    'created_at', r.created_at, 'assigned_at', r.assigned_at, 'arrived_at', r.arrived_at, 'started_at', r.started_at, 'completed_at', r.completed_at,
    'search_timeout_sec', s.search_timeout_sec, 'free_wait_sec', s.free_wait_sec, 'wait_fee_per_min', s.wait_fee_per_min,
    'commission_pct', coalesce(r.commission_pct, public.commission_for(coalesce(r.vehicle, r.requested_vehicles[1]), r.ac)),
    'cancel_fee_now', case when r.status in ('Arriving','Arrived') and r.assigned_at <= now() - make_interval(secs => s.cancel_grace_sec)
                        then (select cancel_fee from public.vehicles where id = r.vehicle) else 0 end,
    'otp', case when for_customer and r.status in ('Searching','Arriving','Arrived') then (select otp from public.ride_otps where ride_id = r.id) end,
    'driver', case when d.id is null then null else jsonb_build_object('name', d.name, 'vehicle', d.vehicle, 'model', d.model, 'plate', d.plate,
       'rating', d.rating, 'trips', d.trips, 'phone', case when live then dp.phone end) end,
    'customer', case when for_customer then null else jsonb_build_object('name', cp.name, 'rating', cp.rating,
       'phone', case when live then coalesce(r.passenger->>'phone', cp.phone) end) end);
end $$;

revoke all on function public.client_pos(jsonb, boolean, boolean) from public, anon, authenticated;
revoke all on function public.trip_estimate_at(text, double precision, double precision, text, double precision, double precision) from public, anon, authenticated;
revoke all on function public.quote(text, text, boolean, text, jsonb, jsonb) from public, anon;
grant execute on function public.quote(text, text, boolean, text, jsonb, jsonb) to authenticated;
