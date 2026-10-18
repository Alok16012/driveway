-- Live driver position. While a trip is live (Arriving / Arrived / Started) the driver's phone reports its GPS
-- position; the customer on that ride sees it move on their map. One row per ride, overwritten on each report.
-- Only the customer of a live ride, its driver and admins can read it, and only report_location() writes it.

create table if not exists public.ride_tracks (
  ride_id uuid primary key references public.rides(id) on delete cascade,
  driver_id uuid not null references public.drivers(id) on delete cascade,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  heading real check (heading >= 0 and heading < 360),
  accuracy real check (accuracy >= 0),
  at timestamptz not null default now()
);
alter table public.ride_tracks enable row level security;
revoke all on public.ride_tracks from public, anon, authenticated;
grant select on public.ride_tracks to authenticated;

drop policy if exists track_read on public.ride_tracks;
create policy track_read on public.ride_tracks for select to authenticated using (
  driver_id = auth.uid() or public.is_admin()
  or exists (select 1 from public.rides r where r.id = ride_id and r.customer_id = auth.uid() and r.status in ('Arriving','Arrived','Started')));

-- Called by the driver app every few seconds. A no-op when the driver has no live trip, so the app can call it freely.
create or replace function public.report_location(p_lat double precision, p_lng double precision, p_heading real default null, p_accuracy real default null)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := public.require_user(); rid uuid;
begin
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'invalid position' using errcode = '22023'; end if;
  if public.account_blocked(uid) then return; end if;
  select id into rid from public.rides where driver_id = uid and status in ('Arriving','Arrived','Started') order by assigned_at desc limit 1;
  if rid is null then return; end if;
  insert into public.ride_tracks (ride_id, driver_id, lat, lng, heading, accuracy, at)
  values (rid, uid, p_lat, p_lng, case when p_heading >= 0 and p_heading < 360 then p_heading end, greatest(p_accuracy, 0), now())
  on conflict (ride_id) do update set lat = excluded.lat, lng = excluded.lng, heading = excluded.heading, accuracy = excluded.accuracy, at = excluded.at;
end $$;
revoke all on function public.report_location(double precision, double precision, real, real) from public, anon;
grant execute on function public.report_location(double precision, double precision, real, real) to authenticated;

-- Positions are only kept while the trip is live: the row goes when the ride completes or is cancelled.
create or replace function public.ride_tracks_cleanup() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.status not in ('Arriving','Arrived','Started') then delete from public.ride_tracks where ride_id = new.id; end if;
  return new;
end $$;
revoke all on function public.ride_tracks_cleanup() from public, anon, authenticated;
drop trigger if exists rides_tracks_cleanup on public.rides;
create trigger rides_tracks_cleanup after update of status on public.rides for each row
  when (old.status is distinct from new.status) execute function public.ride_tracks_cleanup();

-- Push position changes to the customer's map (RLS above decides who receives them).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'ride_tracks') then
    alter publication supabase_realtime add table public.ride_tracks;
  end if;
end $$;
