-- Add-on for faster pickup, as in Rapido: from ₹5 when booking, and the customer can raise it while the search is on
-- (+₹5 / +₹10 / +₹20, up to ₹50 in all). Raising it re-sends the request — the search timer restarts and riders
-- who skipped it see it again at the higher fare. The add-on is part of the fare, so it goes to the rider.

alter table public.rides drop constraint if exists rides_add_on_check;
alter table public.rides add constraint rides_add_on_check check (add_on between 0 and 50 and add_on % 5 = 0);

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
  if v_add not in (0, 5, 10, 20, 30) then raise exception 'add-on must be ₹5, ₹10, ₹20 or ₹30' using errcode = '22023'; end if;
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

-- The search timer on the customer's screen restarts with the search.
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
    'created_at', r.created_at, 'searching_since', r.searching_since, 'assigned_at', r.assigned_at, 'arrived_at', r.arrived_at, 'started_at', r.started_at, 'completed_at', r.completed_at,
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

create or replace function public.raise_add_on(p_ride uuid, p_amount int) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := public.require_user(); r public.rides;
begin
  if p_amount is null or p_amount not in (5, 10, 20) then raise exception 'add ₹5, ₹10 or ₹20' using errcode = '22023'; end if;
  select * into r from public.rides where id = p_ride and customer_id = uid for update;
  if not found then raise exception 'ride not found' using errcode = 'P0002'; end if;
  if r.status <> 'Searching' then raise exception 'a driver has already been found' using errcode = 'P0001'; end if;
  if r.add_on + p_amount > 50 then raise exception 'the add-on can be at most ₹50 — ₹% added so far', r.add_on using errcode = '22023'; end if;
  update public.rides set add_on = add_on + p_amount, fare = fare + p_amount, total = total + p_amount, searching_since = now()
    where id = r.id returning * into r;
  delete from public.driver_declines where ride_id = r.id;                  -- riders who skipped it see the better offer
  return public.ride_view(r, true);
end $$;
revoke all on function public.raise_add_on(uuid, int) from public, anon;
grant execute on function public.raise_add_on(uuid, int) to authenticated;
