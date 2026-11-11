-- Google Play reviewers need a customer login and an approved rider login. The admin creates the two accounts from
-- the admin panel (normal sign-up, with emails and passwords the admin types); this finishes them in one step:
-- emails confirmed, the rider approved in the first live city with a ₹200 starting wallet. Re-running is harmless.

create or replace function public.admin_setup_review_accounts(p_customer_email text, p_rider_email text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare c uuid; r uuid; v_city text; v_name text;
begin
  perform public.require_admin();
  select id into c from auth.users where lower(email) = lower(trim(p_customer_email));
  select id into r from auth.users where lower(email) = lower(trim(p_rider_email));
  if c is null then raise exception 'customer account % not found — create it first', p_customer_email using errcode = 'P0002'; end if;
  if r is null then raise exception 'rider account % not found — create it first', p_rider_email using errcode = 'P0002'; end if;
  if c = r then raise exception 'use two different emails for the customer and the rider' using errcode = '22023'; end if;
  if exists (select 1 from public.profiles where id in (c, r) and (is_admin or deleted_at is not null)) then
    raise exception 'pick accounts that are not admins and not deleted' using errcode = '22023'; end if;
  -- Reviewers log in straight away, without opening a confirmation email. (Local test databases have no such column.)
  begin
    execute 'update auth.users set email_confirmed_at = coalesce(email_confirmed_at, now()) where id = any($1)' using array[c, r];
  exception when undefined_column then null;
  end;
  update public.profiles set blocked = false where id in (c, r);
  update public.profiles set name = 'Play Review Customer' where id = c and char_length(coalesce(name, '')) < 2;
  update public.profiles set name = 'Play Review Rider' where id = r and char_length(coalesce(name, '')) < 2;
  select name into v_city from public.cities where enabled order by id limit 1;
  if v_city is null then raise exception 'switch on at least one city first' using errcode = '22023'; end if;
  select name into v_name from public.profiles where id = r;
  insert into public.drivers (id, name, vehicle, model, plate, ac, city, docs, kyc, kyc_note)
  values (r, v_name, 'auto', 'Review Auto', 'PLAY' || upper(left(replace(r::text, '-', ''), 6)), false, v_city, '{}'::jsonb,
          'Approved', 'Google Play review account')
  on conflict (id) do update set kyc = 'Approved', suspended = false;
  insert into public.ledger (idem, user_id, party, kind, amount, method, note)
  values ('review-wallet:' || r, r, 'driver', 'wallet_credit', 200, 'UPI', 'Starting balance for the Play review account')
  on conflict (idem) do nothing;
  perform public.audit('setup_review_accounts', r::text, jsonb_build_object('customer', p_customer_email, 'rider', p_rider_email));
  return jsonb_build_object('customer', c, 'rider', r, 'city', v_city);
end $$;
revoke all on function public.admin_setup_review_accounts(text, text) from public, anon;
grant execute on function public.admin_setup_review_accounts(text, text) to authenticated;
