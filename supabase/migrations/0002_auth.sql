-- Step 3: customer & rider sign-in (Supabase phone OTP) with row-level security.
-- Run this whole file in Supabase → SQL Editor after 0001_schema.sql + seed.sql.
-- Safe to re-run.

-- ───────────── IDs for rows the apps create ─────────────
create sequence if not exists customer_seq start 3001;
create sequence if not exists driver_seq start 1101;
alter table customers alter column id set default 'CUS' || nextval('customer_seq');
alter table drivers   alter column id set default 'DRV' || nextval('driver_seq');
grant usage on sequence customer_seq, driver_seq to authenticated;

-- ───────────── Helpers ─────────────
-- Phone numbers are compared by digits only: "+91 98765 43210" = "919876543210" (how auth.users stores it).
create or replace function public.digits(t text) returns text
language sql immutable as $$ select regexp_replace(coalesce(t, ''), '\D', '', 'g') $$;

-- The signed-in user's verified phone, as digits.
create or replace function public.my_phone() returns text
language sql stable security definer set search_path = public, auth as $$
  select public.digits(phone) from auth.users where id = auth.uid()
$$;

create or replace function public.my_customer_id() returns text
language sql stable security definer set search_path = public as $$
  select id from customers where user_id = auth.uid()
$$;

create or replace function public.my_driver_id() returns text
language sql stable security definer set search_path = public as $$
  select id from drivers where user_id = auth.uid()
$$;

-- Links customer/driver rows that were created before sign-up (seed data, or added by an admin)
-- to the signed-in user when the verified phone matches. Called by the apps right after OTP.
create or replace function public.claim_profiles() returns void
language plpgsql security definer set search_path = public as $$
declare p text := public.my_phone();
begin
  if auth.uid() is null or coalesce(p, '') = '' then return; end if;
  update customers set user_id = auth.uid() where user_id is null and public.digits(phone) = p;
  update drivers   set user_id = auth.uid() where user_id is null and public.digits(phone) = p;
end $$;

revoke execute on function public.my_phone(), public.my_customer_id(), public.my_driver_id(), public.claim_profiles() from public, anon;
grant  execute on function public.my_phone(), public.my_customer_id(), public.my_driver_id(), public.claim_profiles() to authenticated;

-- ───────────── Column privileges ─────────────
-- Signed-in users may only write the columns listed here; everything else (blocked, kyc, suspended,
-- rating, …) stays admin-only. Reads are still filtered row by row by the policies below.
revoke insert, update, delete on customers, drivers, places, rides, feedback, wallet_txns, transactions, tickets, ticket_notes from anon, authenticated;
grant insert (user_id, name, phone, email) on customers to authenticated;
grant update (name, email)                 on customers to authenticated;
grant insert (user_id, name, phone, vehicle, model, plate, city) on drivers to authenticated;
grant update (online)                                           on drivers to authenticated;
grant insert, update, delete on places to authenticated;

-- ───────────── Policies ─────────────
-- Customers: their own row; riders also see the customers they've driven.
drop policy if exists "own row" on customers;
create policy "own row" on customers for select to authenticated using (user_id = auth.uid());
drop policy if exists "riders see their passengers" on customers;
create policy "riders see their passengers" on customers for select to authenticated
  using (exists (select 1 from rides r where r.customer_id = customers.id and r.driver_id = public.my_driver_id()));
drop policy if exists "sign up" on customers;
create policy "sign up" on customers for insert to authenticated
  with check (user_id = auth.uid() and public.digits(phone) = public.my_phone());
drop policy if exists "edit own profile" on customers;
create policy "edit own profile" on customers for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Drivers: their own row; customers also see the drivers who drove them.
drop policy if exists "own row" on drivers;
create policy "own row" on drivers for select to authenticated using (user_id = auth.uid());
drop policy if exists "customers see their drivers" on drivers;
create policy "customers see their drivers" on drivers for select to authenticated
  using (exists (select 1 from rides r where r.driver_id = drivers.id and r.customer_id = public.my_customer_id()));
drop policy if exists "register" on drivers;
create policy "register" on drivers for insert to authenticated
  with check (user_id = auth.uid() and public.digits(phone) = public.my_phone());
-- Only approved, non-suspended riders can go online.
drop policy if exists "go online" on drivers;
create policy "go online" on drivers for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and (online = false or (kyc = 'Approved' and suspended = false)));

-- Saved places: the customer's own.
drop policy if exists "own places" on places;
create policy "own places" on places for all to authenticated
  using (customer_id = public.my_customer_id()) with check (customer_id = public.my_customer_id());

-- Rides: visible to the customer who booked and the driver who drove. (Creating and updating rides
-- from the apps comes with the live ride flow.)
drop policy if exists "own rides" on rides;
create policy "own rides" on rides for select to authenticated
  using (customer_id = public.my_customer_id() or driver_id = public.my_driver_id());

-- Rider wallet and feedback: the rider's own.
drop policy if exists "own wallet" on wallet_txns;
create policy "own wallet" on wallet_txns for select to authenticated using (driver_id = public.my_driver_id());
drop policy if exists "own feedback" on feedback;
create policy "own feedback" on feedback for select to authenticated using (driver_id = public.my_driver_id());
