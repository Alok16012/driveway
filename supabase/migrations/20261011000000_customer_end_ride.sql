-- Customers can end a started trip themselves (e.g. the driver forgot to tap "End Trip").
-- The completion bookkeeping moves into an internal helper shared by the driver and customer paths.

create or replace function public.finish_ride(p_ride uuid) returns public.rides
language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.rides; s public.settings; gross int; earn int; today date := (now() at time zone 'Asia/Kolkata')::date; inc public.incentives;
begin
  select * into s from public.settings;
  select * into r from public.rides where id = p_ride for update;
  if r.status = 'Completed' then return r; end if;
  if r.status <> 'Started' then raise exception 'the trip has not started' using errcode = 'P0001'; end if;
  gross := r.fare + r.wait_fee;
  earn := round(gross * (1 - s.commission_pct / 100.0));
  update public.rides set status = 'Completed', completed_at = now(), total = r.fare - r.discount + r.wait_fee,
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
revoke all on function public.finish_ride(uuid) from public, anon, authenticated;

create or replace function public.complete_ride(p_ride uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := public.require_user();
begin
  perform 1 from public.rides where id = p_ride and driver_id = uid;
  if not found then raise exception 'ride not found' using errcode = 'P0002'; end if;
  return public.ride_view(public.finish_ride(p_ride), false);
end $$;

-- Customer ends their own started trip. A cash trip is recorded as paid to the driver
-- (same ledger entries as confirm_cash), since the customer is confirming they handed it over.
create or replace function public.customer_end_ride(p_ride uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := public.require_user(); r public.rides;
begin
  perform 1 from public.rides where id = p_ride and customer_id = uid;
  if not found then raise exception 'ride not found' using errcode = 'P0002'; end if;
  r := public.finish_ride(p_ride);
  if r.pay_method = 'Cash' and r.payment_status = 'pending' then
    insert into public.ledger (idem, ride_id, user_id, party, kind, amount, method, note) values
      ('ride:' || r.id || ':cash_collected', r.id, r.driver_id, 'driver', 'cash_collected', -r.total, 'Cash', 'Cash collected · ' || r.code),
      ('ride:' || r.id || ':payment', r.id, r.customer_id, 'customer', 'payment', r.total, 'Cash', 'Payment for ' || r.code)
    on conflict (idem) do nothing;
    update public.rides set payment_status = 'paid' where id = r.id returning * into r;
  end if;
  return public.ride_view(r, true);
end $$;
revoke all on function public.customer_end_ride(uuid) from public, anon;
grant execute on function public.customer_end_ride(uuid) to authenticated;
