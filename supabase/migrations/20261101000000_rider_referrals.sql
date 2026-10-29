-- Rider-to-rider referrals ("Refer & Earn"), with the amounts set by the admin.
--  · Every rider gets a code (e.g. ARJUN427). A new rider can enter it when applying.
--  · Once the new rider has completed `referral_rides` rides, the referrer gets `referral_referrer_bonus` and the
--    new rider `referral_new_bonus`, in their wallets, once. Admins switch it on/off and set the three numbers.
--  · Each number plate can register once (existing rule), a rider can't use their own code, and nothing is paid
--    until real rides are done — so fake sign-ups earn nothing.

alter table public.settings add column if not exists referral_on boolean not null default true;
alter table public.settings add column if not exists referral_referrer_bonus int not null default 200;
alter table public.settings add column if not exists referral_new_bonus int not null default 100;
alter table public.settings add column if not exists referral_rides int not null default 10;
alter table public.settings drop constraint if exists settings_referral_check;
alter table public.settings add constraint settings_referral_check check (
  referral_referrer_bonus between 0 and 5000 and referral_new_bonus between 0 and 5000 and referral_rides between 1 and 500);

alter table public.drivers add column if not exists referral_code text;
alter table public.drivers add column if not exists referred_by uuid references public.drivers(id) on delete set null;
alter table public.drivers add column if not exists referral_paid_at timestamptz;
create unique index if not exists drivers_referral_code_key on public.drivers (referral_code);
alter table public.drivers drop constraint if exists drivers_not_self_referred;
alter table public.drivers add constraint drivers_not_self_referred check (referred_by is distinct from id);

/** A short, readable, unused code: up to 5 letters of the name and 3 digits. */
create or replace function public.new_referral_code(p_name text) returns text
language plpgsql volatile set search_path = public, pg_temp as $$
declare prefix text := left(coalesce(nullif(upper(regexp_replace(coalesce(p_name, ''), '[^A-Za-z]', '', 'g')), ''), 'RIDER'), 5); c text;
begin
  loop
    c := prefix || lpad(floor(random() * 1000)::int::text, 3, '0');
    exit when not exists (select 1 from public.drivers where referral_code = c);
  end loop;
  return c;
end $$;
revoke all on function public.new_referral_code(text) from public, anon, authenticated;

create or replace function public.drivers_referral_code() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.referral_code is null then new.referral_code := public.new_referral_code(new.name); end if;
  return new;
end $$;
drop trigger if exists drivers_referral_code on public.drivers;
create trigger drivers_referral_code before insert on public.drivers for each row execute function public.drivers_referral_code();
revoke all on function public.drivers_referral_code() from public, anon, authenticated;

do $$ declare r record; begin
  for r in select id, name from public.drivers where referral_code is null loop
    update public.drivers set referral_code = public.new_referral_code(r.name) where id = r.id;
  end loop;
end $$;
alter table public.drivers alter column referral_code set not null;

create or replace function public.register_driver(p jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := public.require_user(); v public.vehicles; d public.drivers; v_code text; v_ref uuid;
begin
  if (select phone from public.profiles where id = uid) is null then raise exception 'sign in with your mobile number to apply' using errcode = '42501'; end if;
  select * into d from public.drivers where id = uid;
  if found and d.kyc <> 'Rejected' then raise exception 'you have already applied' using errcode = '23505'; end if;
  select * into v from public.vehicles where id = p->>'vehicle';
  if v.id is null then raise exception 'unknown vehicle type' using errcode = '22023'; end if;
  if coalesce((p->>'ac')::boolean, false) and v.id in ('bike','auto','erick') then raise exception 'this vehicle type cannot be AC' using errcode = '22023'; end if;
  -- Each document is a file this driver uploaded to the private driver-docs bucket (path starts with their user id).
  -- Optional referral code from another rider: checked before anything is saved.
  v_code := nullif(upper(trim(coalesce(p->>'referral_code', ''))), '');
  if v_code is not null and (d.id is null or d.referred_by is null) then
    select id into v_ref from public.drivers where referral_code = v_code;
    if v_ref is null then raise exception 'referral code not found — check it with the rider who shared it' using errcode = '22023'; end if;
    if v_ref = uid then raise exception 'you can''t use your own referral code' using errcode = '22023'; end if;
  end if
;
  if exists (select 1 from unnest(array['photo','licence','rc','insurance','aadhaar']) k
             where coalesce(p->'docs'->>k, '') not like uid::text || '/%' or char_length(p->'docs'->>k) > 200) then
    raise exception 'all five documents are required' using errcode = '22023'; end if;
  begin
    insert into public.drivers (id, name, vehicle, model, plate, ac, city, docs, upi, kyc, kyc_note)
    values (uid, trim(p->>'name'), v.id, trim(p->>'model'), upper(trim(p->>'plate')), coalesce((p->>'ac')::boolean, false), p->>'city',
            p->'docs', nullif(trim(coalesce(p->>'upi', '')), ''), 'Pending', null)
    on conflict (id) do update set name = excluded.name, vehicle = excluded.vehicle, model = excluded.model, plate = excluded.plate,
      ac = excluded.ac, city = excluded.city, docs = excluded.docs, upi = excluded.upi, kyc = 'Pending', kyc_note = null
    returning * into d;
  exception when unique_violation then raise exception 'this number plate is already registered' using errcode = '23505';
  end;
  if v_ref is not null then update public.drivers set referred_by = v_ref where id = uid and referred_by is null returning * into d; end if;
  update public.profiles set name = d.name where id = uid and name = '';
  return to_jsonb(d);
end $$;

/** Pays the referral once the referred rider has done enough rides. Safe to call repeatedly (idempotent). */
create or replace function public.pay_referral(p_driver uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare s public.settings; d public.drivers; done int;
begin
  select * into s from public.settings;
  if not s.referral_on then return; end if;
  select * into d from public.drivers where id = p_driver for update;
  if d.id is null or d.referred_by is null or d.referral_paid_at is not null then return; end if;
  select count(*) into done from public.rides where driver_id = p_driver and status = 'Completed';
  if done < s.referral_rides then return; end if;
  if s.referral_referrer_bonus > 0 then
    insert into public.ledger (idem, user_id, party, kind, amount, note)
    values ('referral:' || p_driver || ':referrer', d.referred_by, 'driver', 'incentive', s.referral_referrer_bonus,
            format('Referral bonus — %s completed %s rides', d.name, s.referral_rides))
    on conflict (idem) do nothing;
  end if;
  if s.referral_new_bonus > 0 then
    insert into public.ledger (idem, user_id, party, kind, amount, note)
    values ('referral:' || p_driver || ':joined', p_driver, 'driver', 'incentive', s.referral_new_bonus, 'Welcome bonus — joined with a referral code')
    on conflict (idem) do nothing;
  end if;
  update public.drivers set referral_paid_at = now() where id = p_driver;
  perform public.audit('referral_paid', p_driver::text, jsonb_build_object('referrer', d.referred_by,
    'referrer_bonus', s.referral_referrer_bonus, 'new_bonus', s.referral_new_bonus, 'rides', s.referral_rides));
end $$;
revoke all on function public.pay_referral(uuid) from public, anon, authenticated;

create or replace function public.rides_referral_payout() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.status = 'Completed' and old.status is distinct from 'Completed' and new.driver_id is not null then
    perform public.pay_referral(new.driver_id);
  end if;
  return new;
end $$;
drop trigger if exists rides_referral_payout on public.rides;
create trigger rides_referral_payout after update of status on public.rides for each row execute function public.rides_referral_payout();
revoke all on function public.rides_referral_payout() from public, anon, authenticated;

/** The signed-in rider's code, the current offer, and how the riders they referred are doing. */
create or replace function public.my_referral() returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare uid uuid := public.require_user(); d public.drivers; s public.settings;
begin
  select * into d from public.drivers where id = uid;
  if d.id is null then raise exception 'driver account not found' using errcode = 'P0002'; end if;
  select * into s from public.settings;
  return jsonb_build_object(
    'code', d.referral_code, 'on', s.referral_on, 'referrer_bonus', s.referral_referrer_bonus,
    'new_bonus', s.referral_new_bonus, 'rides', s.referral_rides,
    'earned', coalesce((select sum(amount) from public.ledger where user_id = uid and idem like 'referral:%:referrer'), 0),
    'referred', coalesce((select jsonb_agg(jsonb_build_object('name', r.name, 'kyc', r.kyc,
        'done', (select count(*) from public.rides x where x.driver_id = r.id and x.status = 'Completed'),
        'paid', r.referral_paid_at is not null, 'joined', r.created_at) order by r.created_at desc)
      from public.drivers r where r.referred_by = uid), '[]'::jsonb));
end $$;
revoke all on function public.my_referral() from public, anon;
grant execute on function public.my_referral() to authenticated;

create or replace function public.admin_update_settings(p jsonb) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.require_admin();
  if coalesce((p->>'referral_referrer_bonus')::int, 0) not between 0 and 5000 or coalesce((p->>'referral_new_bonus')::int, 0) not between 0 and 5000 then
    raise exception 'referral bonus must be ₹0–₹5000' using errcode = '22023'; end if;
  if coalesce((p->>'referral_rides')::int, 1) not between 1 and 500 then raise exception 'rides for the referral bonus must be 1–500' using errcode = '22023'; end if;
  update public.settings set
    surge_on = coalesce((p->>'surge_on')::boolean, surge_on), surge_mult = coalesce((p->>'surge_mult')::numeric, surge_mult),
    booking_fee = coalesce((p->>'booking_fee')::int, booking_fee), booking_fee_above = coalesce((p->>'booking_fee_above')::int, booking_fee_above),
    referral_on = coalesce((p->>'referral_on')::boolean, referral_on),
    referral_referrer_bonus = coalesce((p->>'referral_referrer_bonus')::int, referral_referrer_bonus),
    referral_new_bonus = coalesce((p->>'referral_new_bonus')::int, referral_new_bonus),
    referral_rides = coalesce((p->>'referral_rides')::int, referral_rides),
    updated_at = now();
  perform public.audit('update_settings', 'settings', p);
end $$;
