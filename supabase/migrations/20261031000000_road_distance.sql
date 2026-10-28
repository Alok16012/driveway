-- Real road distance and travel time for fares. Trips used to be priced on the straight line × 1.35 and
-- km × 2.6 + 4 minutes, which undercounts detours (river crossings, one-ways) and ignores traffic.
-- The apps now ask Ola Maps Directions for the route and send {km, mins} as `road` with the quote and the booking.
-- The server only trusts it within physical bounds — never shorter than the straight line, at most 2.5× it, and a
-- plausible speed — otherwise it falls back to the old estimate, so a tampered client can't buy a cheaper fare.

create or replace function public.trip_estimate_road(a text, a_lat double precision, a_lng double precision,
  b text, b_lat double precision, b_lng double precision, p_road jsonb,
  out km numeric, out mins int, out road boolean)
language plpgsql stable set search_path = public, pg_temp as $$
declare base record; pa public.places; pb public.places; d double precision; rkm numeric; rmins numeric;
begin
  select * into base from public.trip_estimate_at(a, a_lat, a_lng, b, b_lat, b_lng);   -- service area and trip limits
  km := base.km; mins := base.mins; road := false;
  if p_road is null or jsonb_typeof(p_road) <> 'object' or jsonb_typeof(p_road->'km') <> 'number' or jsonb_typeof(p_road->'mins') <> 'number' then return; end if;
  select * into pa from public.places where id = a;
  select * into pb from public.places where id = b;
  a_lat := coalesce(a_lat, pa.lat); a_lng := coalesce(a_lng, pa.lng);
  b_lat := coalesce(b_lat, pb.lat); b_lng := coalesce(b_lng, pb.lng);
  if a_lat is null or b_lat is null then return; end if;
  d := 2 * 6371 * asin(sqrt(sin(radians(b_lat - a_lat) / 2) ^ 2 + cos(radians(a_lat)) * cos(radians(b_lat)) * sin(radians(b_lng - a_lng) / 2) ^ 2));
  rkm := (p_road->>'km')::numeric; rmins := (p_road->>'mins')::numeric;
  if rkm < d * 0.95 or rkm > d * 2.5 + 1 or rkm > 300 or rmins <= 0 or rmins > 1440 then return; end if;
  km := greatest(round(rkm, 1), 0.5);
  -- Traffic time, kept between 60 km/h and a 6 km/h crawl plus 20 minutes of waiting.
  mins := least(greatest(round(rmins)::int, ceil(km)::int), round(km * 10 + 20)::int);
  road := true;
end $$;
revoke all on function public.trip_estimate_road(text, double precision, double precision, text, double precision, double precision, jsonb) from public, anon, authenticated;

drop function if exists public.quote(text, text, boolean, text, jsonb, jsonb);
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
  return jsonb_build_object('km', est.km, 'mins', est.mins, 'road', est.road, 'options', opts, 'any', any_best, 'booking_fee', s.booking_fee, 'booking_fee_above', s.booking_fee_above, 'rentals', rentals, 'parcels', parcels,
    'any_available', (select coalesce(sum(public.available_drivers(x, p_ac)), 0) from unnest(array['mini','sedan','suv']) x));
end $$;
revoke all on function public.quote(text, text, boolean, text, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.quote(text, text, boolean, text, jsonb, jsonb, jsonb) to authenticated;

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
