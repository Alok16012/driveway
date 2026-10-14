-- Blocked accounts are read-only. A customer the admin has blocked (profiles.blocked), or a rider who is
-- blocked or suspended (drivers.suspended), cannot book, go online, accept a ride, or change their profile,
-- rider details or payout UPI. Enforced with triggers so every current and future function obeys it.
-- Only changes the person makes to their own account are refused; admin actions and system jobs still run.

create or replace function public.account_blocked(p_user uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select blocked from public.profiles where id = p_user), false)
      or coalesce((select suspended from public.drivers where id = p_user), false)
$$;
revoke all on function public.account_blocked(uuid) from public, anon, authenticated;

-- Profile: name, email and phone are frozen while blocked.
create or replace function public.profiles_blocked_guard() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() = old.id and old.blocked
     and (new.name is distinct from old.name or new.email is distinct from old.email or new.phone is distinct from old.phone) then
    raise exception 'your account is blocked — contact support' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists profiles_blocked_guard on public.profiles;
create trigger profiles_blocked_guard before update on public.profiles for each row execute function public.profiles_blocked_guard();

-- Rider details: no new application, no edits, and no going online while blocked. Going offline is allowed.
create or replace function public.drivers_blocked_guard() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is distinct from new.id or not public.account_blocked(new.id) then return new; end if;
  if tg_op = 'INSERT'
     or (new.online and not old.online)
     or (to_jsonb(new) - 'online' - 'last_seen' - 'updated_at' - 'offers_accepted' - 'offers_declined' - 'cancellations' - 'trips' - 'rating')
        is distinct from
        (to_jsonb(old) - 'online' - 'last_seen' - 'updated_at' - 'offers_accepted' - 'offers_declined' - 'cancellations' - 'trips' - 'rating') then
    raise exception 'your account is blocked — contact support' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists drivers_blocked_guard on public.drivers;
create trigger drivers_blocked_guard before insert or update on public.drivers for each row execute function public.drivers_blocked_guard();

-- Rides: a blocked customer cannot create a booking, and a blocked or suspended rider cannot take one.
-- (A suspended rider can still ride as a customer — suspension is about driving.)
create or replace function public.rides_blocked_guard() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'INSERT' and auth.uid() = new.customer_id and (select blocked from public.profiles where id = new.customer_id) then
    raise exception 'your account is blocked — contact support' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and new.driver_id is not null and old.driver_id is null and auth.uid() = new.driver_id
     and public.account_blocked(new.driver_id) then
    raise exception 'your account is blocked — contact support' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists rides_blocked_guard on public.rides;
create trigger rides_blocked_guard before insert or update on public.rides for each row execute function public.rides_blocked_guard();
