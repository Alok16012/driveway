-- Live rides: customer bookings are saved and offered to one available rider at a time.
-- Server actions do the reads and writes (service-role key, after checking the caller), so no new
-- policies are needed. Safe to re-run. (Comments avoid apostrophes: the SQL editor has tripped on them.)

alter table rides add column if not exists offered_to       text references drivers (id) on delete set null;
alter table rides add column if not exists offer_expires_at timestamptz;
alter table rides add column if not exists declined_by      text[] not null default '{}';
alter table rides add column if not exists wait_fee         numeric not null default 0;

-- New bookings get RDnnnn (rides) or PDnnnn (parcels) ids.
create sequence if not exists ride_seq start 2001;
create or replace function public.set_ride_id() returns trigger language plpgsql as $$
begin
  if new.id is null then
    new.id := (case when new.service = 'parcel' then 'PD' else 'RD' end) || nextval('ride_seq');
  end if;
  return new;
end $$;
drop trigger if exists set_ride_id on rides;
create trigger set_ride_id before insert on rides for each row execute function public.set_ride_id();

create index if not exists rides_offered_idx on rides (offered_to) where status = 'Searching';
create index if not exists rides_active_driver_idx on rides (driver_id) where status in ('Assigned', 'Arriving', 'Arrived', 'Started');
