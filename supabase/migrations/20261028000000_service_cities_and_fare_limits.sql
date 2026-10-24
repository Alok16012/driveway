-- 1. Service cities run from the admin panel instead of a hard-coded Kolkata.
--    · public.cities: any city in any Indian state or union territory, with a centre and a radius.
--      Admins add, enable/disable and resize them; riders and customers see only enabled ones.
--    · A rider's city must be an enabled city (was: city = 'Kolkata').
--    · A trip's pickup must lie inside an enabled city (centre + radius), so the admin decides where
--      DriveWay takes bookings. Kolkata is seeded enabled, so nothing changes until the admin adds more.
-- 2. Fare limits. An admin typo once set Bike to ₹30 a minute; prices now have sane upper bounds and
--    that value goes back to the seeded ₹1/min.

create table if not exists public.cities (
  id bigint generated always as identity primary key,
  name text not null check (char_length(name) between 2 and 60),
  state text not null,
  lat double precision not null check (lat between 6 and 37.5),     -- India's bounding box
  lng double precision not null check (lng between 68 and 97.5),
  radius_km int not null default 30 check (radius_km between 2 and 150),
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists cities_name_key on public.cities (lower(name));

insert into public.cities (name, state, lat, lng, radius_km, enabled)
values ('Kolkata', 'West Bengal', 22.5726, 88.3639, 40, true)
on conflict do nothing;

alter table public.cities enable row level security;
grant select on public.cities to authenticated;
drop policy if exists cities_read on public.cities;
create policy cities_read on public.cities for select to authenticated using (enabled or public.is_admin());

-- The 28 states and 8 union territories.
create or replace function public.indian_states() returns text[] language sql immutable as $$
  select array['Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana',
    'Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram',
    'Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand',
    'West Bengal','Andaman and Nicobar Islands','Chandigarh','Dadra and Nagar Haveli and Daman and Diu','Delhi',
    'Jammu and Kashmir','Ladakh','Lakshadweep','Puducherry']
$$;

/** Add a city (no id) or update one (id): position, radius and on/off. A city's name and state are fixed
 *  once added, because riders' records point at the name — add a new one and disable the old instead. */
create or replace function public.admin_upsert_city(p jsonb) returns bigint
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id bigint := nullif(p->>'id', '')::bigint; v_name text := trim(coalesce(p->>'name', '')); v_state text := p->>'state';
        v_lat double precision; v_lng double precision; v_r int; v_on boolean; c public.cities;
begin
  perform public.require_admin();
  if jsonb_typeof(p->'lat') <> 'number' or jsonb_typeof(p->'lng') <> 'number' then
    raise exception 'set the city''s location (latitude and longitude)' using errcode = '22023'; end if;
  v_lat := (p->>'lat')::double precision; v_lng := (p->>'lng')::double precision;
  if v_lat not between 6 and 37.5 or v_lng not between 68 and 97.5 then
    raise exception 'that location is outside India' using errcode = '22023'; end if;
  v_r := coalesce(nullif(p->>'radius_km', '')::int, 30);
  if v_r not between 2 and 150 then raise exception 'service radius must be 2–150 km' using errcode = '22023'; end if;
  v_on := coalesce((p->>'enabled')::boolean, true);
  if v_id is null then
    if char_length(v_name) not between 2 and 60 then raise exception 'city name must be 2–60 characters' using errcode = '22023'; end if;
    if v_state is null or not (v_state = any (public.indian_states())) then raise exception 'pick a state or union territory' using errcode = '22023'; end if;
    if exists (select 1 from public.cities where lower(name) = lower(v_name)) then
      raise exception '% is already in the list', v_name using errcode = '23505'; end if;
    insert into public.cities (name, state, lat, lng, radius_km, enabled) values (v_name, v_state, v_lat, v_lng, v_r, v_on) returning * into c;
  else
    update public.cities set lat = v_lat, lng = v_lng, radius_km = v_r, enabled = v_on where id = v_id returning * into c;
    if not found then raise exception 'city not found' using errcode = 'P0002'; end if;
  end if;
  perform public.audit(case when v_id is null then 'add_city' else 'update_city' end, c.name,
    jsonb_build_object('state', c.state, 'lat', c.lat, 'lng', c.lng, 'radius_km', c.radius_km, 'enabled', c.enabled));
  return c.id;
end $$;

/** Remove a city nobody is registered in. Cities with riders can only be disabled. */
create or replace function public.admin_delete_city(p_id bigint) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare c public.cities;
begin
  perform public.require_admin();
  select * into c from public.cities where id = p_id;
  if not found then raise exception 'city not found' using errcode = 'P0002'; end if;
  if exists (select 1 from public.drivers where city = c.name) then
    raise exception '% has registered riders — disable it instead', c.name using errcode = '23503'; end if;
  delete from public.cities where id = p_id;
  perform public.audit('delete_city', c.name, jsonb_build_object('state', c.state));
end $$;

revoke all on function public.admin_upsert_city(jsonb) from public, anon;
revoke all on function public.admin_delete_city(bigint) from public, anon;
grant execute on function public.admin_upsert_city(jsonb), public.admin_delete_city(bigint) to authenticated;
revoke all on function public.indian_states() from public, anon;
grant execute on function public.indian_states() to authenticated;

/** The enabled city whose radius covers a point, nearest centre first; null when none does. */
create or replace function public.service_city_at(p_lat double precision, p_lng double precision) returns text
language sql stable security definer set search_path = public, pg_temp as $$
  select c.name from public.cities c,
    lateral (select 2 * 6371 * asin(sqrt(sin(radians(c.lat - p_lat) / 2) ^ 2
      + cos(radians(p_lat)) * cos(radians(c.lat)) * sin(radians(c.lng - p_lng) / 2) ^ 2)) as km) d
  where c.enabled and d.km <= c.radius_km
  order by d.km limit 1
$$;
revoke all on function public.service_city_at(double precision, double precision) from public, anon;
grant execute on function public.service_city_at(double precision, double precision) to authenticated;

-- Riders register in, and move to, enabled cities only.
alter table public.drivers drop constraint if exists drivers_city_check;
create or replace function public.drivers_city_guard() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'UPDATE' and new.city is not distinct from old.city then return new; end if;
  if not exists (select 1 from public.cities where name = new.city and enabled) then
    raise exception 'pick a city we operate in' using errcode = '22023'; end if;
  return new;
end $$;
drop trigger if exists drivers_city_guard on public.drivers;
create trigger drivers_city_guard before insert or update of city on public.drivers for each row execute function public.drivers_city_guard();
revoke all on function public.drivers_city_guard() from public, anon, authenticated;

create or replace function public.update_my_driver_profile(p_name text, p_city text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := public.require_user();
begin
  if char_length(trim(coalesce(p_name, ''))) not between 2 and 80 then raise exception 'name must be 2–80 characters' using errcode = '22023'; end if;
  update public.drivers set name = trim(p_name), city = p_city where id = uid;   -- drivers_city_guard checks the city
  if not found then raise exception 'driver account not found' using errcode = 'P0002'; end if;
end $$;
revoke all on function public.update_my_driver_profile(text, text) from public, anon;
grant execute on function public.update_my_driver_profile(text, text) to authenticated;

-- Pickups must be inside an enabled city. Same estimate as before otherwise.
create or replace function public.trip_estimate_at(a text, a_lat double precision, a_lng double precision,
  b text, b_lat double precision, b_lng double precision, out km numeric, out mins int)
language plpgsql stable set search_path = public, pg_temp as $$
declare pa public.places; pb public.places; d double precision;
begin
  select * into pa from public.places where id = a;
  select * into pb from public.places where id = b;
  if coalesce(a_lat, pa.lat) is not null and public.service_city_at(coalesce(a_lat, pa.lat), coalesce(a_lng, pa.lng)) is null then
    raise exception 'DriveWay isn''t available here yet — we''ll let you know when we reach your city' using errcode = '22023'; end if;
  if a_lat is null and b_lat is null then select e.km, e.mins into km, mins from public.trip_estimate(a, b) e; return; end if;
  a_lat := coalesce(a_lat, pa.lat); a_lng := coalesce(a_lng, pa.lng);
  b_lat := coalesce(b_lat, pb.lat); b_lng := coalesce(b_lng, pb.lng);
  if a_lat is null or b_lat is null then raise exception 'unknown place' using errcode = '22023'; end if;
  d := 2 * 6371 * asin(sqrt(sin(radians(b_lat - a_lat) / 2) ^ 2 + cos(radians(a_lat)) * cos(radians(b_lat)) * sin(radians(b_lng - a_lng) / 2) ^ 2));
  if d < 0.05 then raise exception 'pickup and drop must be different' using errcode = '22023'; end if;
  km := greatest(round((d * 1.35)::numeric, 1), 0.5);
  if km > 300 then raise exception 'that trip is too long — pick a drop within 300 km' using errcode = '22023'; end if;
  mins := round(km * 2.6 + 4)::int;
end $$;
revoke all on function public.trip_estimate_at(text, double precision, double precision, text, double precision, double precision) from public, anon, authenticated;

-- Fare limits.
update public.vehicles set per_min = 1, updated_at = now() where id = 'bike' and per_min = 30;
alter table public.vehicles drop constraint if exists vehicles_fare_limits;
alter table public.vehicles add constraint vehicles_fare_limits check (
  base <= 1000 and per_km <= 100 and per_min <= 10 and min_fare <= 2000 and cancel_fee <= 500);

create or replace function public.admin_update_vehicle(p_id text, p jsonb) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.require_admin();
  if coalesce((p->>'base')::numeric, 0) > 1000 then raise exception 'base fare can be at most ₹1000' using errcode = '22023'; end if;
  if coalesce((p->>'per_km')::numeric, 0) > 100 then raise exception 'per-km rate can be at most ₹100' using errcode = '22023'; end if;
  if coalesce((p->>'per_min')::numeric, 0) > 10 then raise exception 'per-minute rate can be at most ₹10' using errcode = '22023'; end if;
  if coalesce((p->>'min_fare')::numeric, 0) > 2000 then raise exception 'minimum fare can be at most ₹2000' using errcode = '22023'; end if;
  if coalesce((p->>'cancel_fee')::numeric, 0) > 500 then raise exception 'cancellation fee can be at most ₹500' using errcode = '22023'; end if;
  update public.vehicles set
    base = coalesce((p->>'base')::int, base), per_km = coalesce((p->>'per_km')::numeric, per_km),
    per_min = coalesce((p->>'per_min')::numeric, per_min), min_fare = coalesce((p->>'min_fare')::int, min_fare),
    cancel_fee = coalesce((p->>'cancel_fee')::int, cancel_fee), ac = coalesce((p->>'ac')::boolean, ac),
    enabled = coalesce((p->>'enabled')::boolean, enabled),
    platform_fee = coalesce((p->>'platform_fee')::int, platform_fee),
    platform_fee_non_ac = coalesce((p->>'platform_fee_non_ac')::int, platform_fee_non_ac), updated_at = now()
  where id = p_id;                                                             -- CHECK constraints reject out-of-range values
  if not found then raise exception 'vehicle not found' using errcode = 'P0002'; end if;
  perform public.audit('update_vehicle', p_id, p);
end $$;
