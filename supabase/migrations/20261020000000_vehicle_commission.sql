-- Commission per vehicle category, set by the admin on the Pricing page (0–50%).
-- Each ride snapshots the rate when its earning is booked (completion or cancellation fee), so changing a
-- category's commission later affects only new rides. settings.commission_pct seeds the new column and
-- stays as the fallback for a ride with no vehicle yet.

alter table public.vehicles add column if not exists commission_pct numeric(5,2);
update public.vehicles set commission_pct = (select commission_pct from public.settings) where commission_pct is null;
alter table public.vehicles alter column commission_pct set not null;
alter table public.vehicles alter column commission_pct set default 20;
alter table public.vehicles drop constraint if exists vehicles_commission_pct_check;
alter table public.vehicles add constraint vehicles_commission_pct_check check (commission_pct between 0 and 50);

alter table public.rides add column if not exists commission_pct numeric(5,2);

create or replace function public.commission_for(p_vehicle text) returns numeric
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select commission_pct from public.vehicles where id = p_vehicle), (select commission_pct from public.settings))
$$;
revoke all on function public.commission_for(text) from public, anon, authenticated;

create or replace function public.finish_ride(p_ride uuid) returns public.rides
language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.rides; s public.settings; pct numeric; gross int; earn int; today date := (now() at time zone 'Asia/Kolkata')::date; inc public.incentives;
begin
  select * into s from public.settings;
  select * into r from public.rides where id = p_ride for update;
  if r.status = 'Completed' then return r; end if;
  if r.status <> 'Started' then raise exception 'the trip has not started' using errcode = 'P0001'; end if;
  gross := r.fare + r.wait_fee;
  pct := public.commission_for(r.vehicle);
  earn := round(gross * (1 - pct / 100.0));
  update public.rides set status = 'Completed', completed_at = now(), commission_pct = pct, total = r.fare - r.discount + r.wait_fee,
    payment_status = case when r.fare - r.discount + r.wait_fee = 0 then 'paid' else 'pending' end
    where id = r.id returning * into r;
  insert into public.ledger (idem, ride_id, user_id, party, kind, amount, note) values
    ('ride:' || r.id || ':driver_earning', r.id, r.driver_id, 'driver', 'driver_earning', earn, 'Trip ' || r.code),
    ('ride:' || r.id || ':commission', r.id, null, 'platform', 'commission', gross - earn, 'Commission ' || r.code)
  on conflict (idem) do nothing;
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

create or replace function public.cancel_ride(p_ride uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := public.require_user(); r public.rides; s public.settings; fee int := 0; v public.vehicles; earn int; pct numeric;
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
    pct := public.commission_for(r.vehicle);
    update public.rides set commission_pct = pct where id = r.id returning * into r;
    earn := round(fee * (1 - pct / 100.0));
    insert into public.ledger (idem, ride_id, user_id, party, kind, amount, note) values
      ('ride:' || r.id || ':cancel_fee_driver', r.id, r.driver_id, 'driver', 'cancel_fee', earn, 'Cancellation fee · ' || r.code),
      ('ride:' || r.id || ':cancel_fee_commission', r.id, null, 'platform', 'commission', fee - earn, 'Cancellation fee commission · ' || r.code)
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
    'from', jsonb_build_object('id', f.id, 'name', f.name, 'address', f.address),
    'to', jsonb_build_object('id', t.id, 'name', t.name, 'address', t.address),
    'km', r.km, 'mins', r.mins, 'fare', r.fare, 'discount', r.discount, 'coupon', r.coupon_code, 'wait_fee', r.wait_fee, 'add_on', r.add_on,
    'cancel_fee', r.cancel_fee, 'total', r.total, 'pay', r.pay_method, 'payment_status', r.payment_status, 'refunded', r.refunded,
    'scheduled_for', r.scheduled_for, 'passenger', r.passenger, 'parcel', r.parcel, 'rental', r.rental,
    'cancel_reason', r.cancel_reason, 'cancelled_by', r.cancelled_by, 'rating', r.rating,
    'created_at', r.created_at, 'assigned_at', r.assigned_at, 'arrived_at', r.arrived_at, 'started_at', r.started_at, 'completed_at', r.completed_at,
    'search_timeout_sec', s.search_timeout_sec, 'free_wait_sec', s.free_wait_sec, 'wait_fee_per_min', s.wait_fee_per_min,
    'commission_pct', coalesce(r.commission_pct, public.commission_for(coalesce(r.vehicle, r.requested_vehicles[1]))),
    'cancel_fee_now', case when r.status in ('Arriving','Arrived') and r.assigned_at <= now() - make_interval(secs => s.cancel_grace_sec)
                        then (select cancel_fee from public.vehicles where id = r.vehicle) else 0 end,
    'otp', case when for_customer and r.status in ('Searching','Arriving','Arrived') then (select otp from public.ride_otps where ride_id = r.id) end,
    'driver', case when d.id is null then null else jsonb_build_object('name', d.name, 'vehicle', d.vehicle, 'model', d.model, 'plate', d.plate,
       'rating', d.rating, 'trips', d.trips, 'phone', case when live then dp.phone end) end,
    'customer', case when for_customer then null else jsonb_build_object('name', cp.name, 'rating', cp.rating,
       'phone', case when live then coalesce(r.passenger->>'phone', cp.phone) end) end);
end $$;

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
      round(r.fare * (1 - public.commission_for(d.vehicle) / 100.0))) order by r.created_at)
    from public.rides r
    where r.status = 'Searching' and d.vehicle = any (r.requested_vehicles)
      and r.searching_since > now() - make_interval(secs => s.search_timeout_sec)
      and (not r.ac or not dv.ac or d.ac)
      and r.customer_id <> uid
      and not exists (select 1 from public.driver_declines x where x.ride_id = r.id and x.driver_id = uid)), '[]'::jsonb);
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
    'commission_pct', public.commission_for(d.vehicle), 'free_wait_sec', s.free_wait_sec, 'wait_fee_per_min', s.wait_fee_per_min,
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
    commission_pct = coalesce((p->>'commission_pct')::numeric, commission_pct), updated_at = now()
  where id = p_id;                                                             -- CHECK constraints reject negatives
  if not found then raise exception 'vehicle not found' using errcode = 'P0002'; end if;
  perform public.audit('update_vehicle', p_id, p);
end $$;
