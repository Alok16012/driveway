-- Customers and riders can edit their own profile: mobile number (both), and the rider's name and city.

-- Mobile number, stored like sign-up does: 91 + 10-digit Indian mobile.
create or replace function public.update_my_phone(p_phone text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := public.require_user();
begin
  if coalesce(p_phone, '') !~ '^[6-9]\d{9}$' then raise exception 'enter a valid 10-digit Indian mobile number' using errcode = '22023'; end if;
  update public.profiles set phone = '91' || p_phone where id = uid;
end $$;
revoke all on function public.update_my_phone(text) from public, anon;
grant execute on function public.update_my_phone(text) to authenticated;

-- Rider's name (shown to customers) and city. Vehicle and documents still change through support,
-- since they need re-verification.
create or replace function public.update_my_driver_profile(p_name text, p_city text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := public.require_user();
begin
  if char_length(trim(coalesce(p_name, ''))) not between 2 and 80 then raise exception 'name must be 2–80 characters' using errcode = '22023'; end if;
  if coalesce(p_city, '') not in ('Noida','Delhi','Gurugram','Lucknow') then raise exception 'pick a city we operate in' using errcode = '22023'; end if;
  update public.drivers set name = trim(p_name), city = p_city where id = uid;
  if not found then raise exception 'driver account not found' using errcode = 'P0002'; end if;
end $$;
revoke all on function public.update_my_driver_profile(text, text) from public, anon;
grant execute on function public.update_my_driver_profile(text, text) to authenticated;
