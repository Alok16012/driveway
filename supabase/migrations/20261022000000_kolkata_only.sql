-- DriveWay runs in Kolkata only. Places keep their ids (rides and coupons point at them) but now name
-- Kolkata locations, and riders can only register or move to Kolkata.

update public.places p set name = v.name, address = v.address
from (values
  ('cur', 'Current location', 'Park Street, Kolkata'),
  ('home', 'Salt Lake Sector V', 'DN-12, Sector V, Salt Lake, Kolkata'),
  ('work', 'New Town', 'Action Area I, New Town, Kolkata'),
  ('dlf', 'South City Mall', 'Prince Anwar Shah Road, Kolkata'),
  ('airport', 'Kolkata Airport', 'NSCBI Airport, Dum Dum, Kolkata 700052'),
  ('cp', 'Esplanade', 'Dharmatala, Kolkata'),
  ('botanical', 'Sealdah Station', 'Sealdah, Kolkata'),
  ('akshardham', 'Victoria Memorial', 'Queen''s Way, Maidan, Kolkata'),
  ('gip', 'Quest Mall', 'Syed Amir Ali Avenue, Ballygunge, Kolkata')
) as v(id, name, address)
where p.id = v.id;

update public.coupons set body = 'Sedan & XL to Kolkata Airport' where code = 'AIRPORT99';

alter table public.drivers drop constraint if exists drivers_city_check;
update public.drivers set city = 'Kolkata' where city <> 'Kolkata';
alter table public.drivers add constraint drivers_city_check check (city = 'Kolkata');

create or replace function public.update_my_driver_profile(p_name text, p_city text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := public.require_user();
begin
  if char_length(trim(coalesce(p_name, ''))) not between 2 and 80 then raise exception 'name must be 2–80 characters' using errcode = '22023'; end if;
  if coalesce(p_city, '') <> 'Kolkata' then raise exception 'pick a city we operate in' using errcode = '22023'; end if;
  update public.drivers set name = trim(p_name), city = p_city where id = uid;
  if not found then raise exception 'driver account not found' using errcode = 'P0002'; end if;
end $$;
revoke all on function public.update_my_driver_profile(text, text) from public, anon;
grant execute on function public.update_my_driver_profile(text, text) to authenticated;
