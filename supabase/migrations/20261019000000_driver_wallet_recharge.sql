-- Rider wallet recharge, and trips the customer paid straight to the rider's own UPI/bank account.
-- Either way the platform's commission is taken from the rider's wallet balance (party = 'driver' ledger rows).

-- Recharge: the rider adds money to their wallet so commission on direct/cash trips can be deducted from it.
-- Simulated UPI collection until a payment provider is connected (same as pay_dues).
create or replace function public.recharge_wallet(p_amount int, p_idem text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := public.require_user(); bal int;
begin
  if p_idem is null or char_length(p_idem) not between 8 and 64 then raise exception 'missing idempotency key' using errcode = '22023'; end if;
  if p_amount is null or p_amount not between 10 and 50000 then raise exception 'recharge between ₹10 and ₹50,000' using errcode = '22023'; end if;
  perform 1 from public.drivers where id = uid for update;
  if not found then raise exception 'driver account not found' using errcode = 'P0002'; end if;
  insert into public.ledger (idem, user_id, party, kind, amount, method, note)
    values ('recharge:' || p_idem, uid, 'driver', 'wallet_credit', p_amount, 'UPI', 'Wallet recharge via UPI') on conflict (idem) do nothing;
  select coalesce(sum(amount), 0) into bal from public.ledger where user_id = uid and party = 'driver';
  return jsonb_build_object('balance', bal);
end $$;
revoke all on function public.recharge_wallet(int, text) from public, anon;
grant execute on function public.recharge_wallet(int, text) to authenticated;

-- Direct payment: an online (UPI/Card) trip the customer paid to the rider personally instead of in the app.
-- Booked like cash: the rider holds the whole fare, so it is deducted from their wallet and only their share stays.
create or replace function public.confirm_direct_payment(p_ride uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := public.require_user(); r public.rides;
begin
  select * into r from public.rides where id = p_ride and driver_id = uid for update;
  if not found then raise exception 'ride not found' using errcode = 'P0002'; end if;
  if r.payment_status = 'paid' then return public.ride_view(r, false); end if;
  if r.status <> 'Completed' or r.payment_status <> 'pending' or r.total <= 0 then raise exception 'nothing to collect on this ride' using errcode = 'P0001'; end if;
  insert into public.ledger (idem, ride_id, user_id, party, kind, amount, method, note) values
    ('ride:' || r.id || ':cash_collected', r.id, uid, 'driver', 'cash_collected', -r.total, 'Direct', 'Paid to you directly · ' || r.code),
    ('ride:' || r.id || ':payment', r.id, r.customer_id, 'customer', 'payment', r.total, 'Direct', 'Payment for ' || r.code)
  on conflict (idem) do nothing;
  update public.rides set payment_status = 'paid' where id = r.id returning * into r;
  return public.ride_view(r, false);
end $$;
revoke all on function public.confirm_direct_payment(uuid) from public, anon;
grant execute on function public.confirm_direct_payment(uuid) to authenticated;
