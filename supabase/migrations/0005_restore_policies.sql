-- Restores the row-level security policies from 0002 that never got created (the diagnostic showed
-- only the customers own-row policy). Simple ownership policies first, cross-table ones last.
-- Safe to re-run. (Comments avoid apostrophes: the Supabase SQL editor has tripped on them.)

drop policy if exists "own row" on drivers;
create policy "own row" on drivers for select to authenticated using (user_id = auth.uid());

drop policy if exists "edit own profile" on customers;
create policy "edit own profile" on customers for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "go online" on drivers;
create policy "go online" on drivers for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and (online = false or (kyc = 'Approved' and suspended = false)));

drop policy if exists "own places" on places;
create policy "own places" on places for all to authenticated
  using (customer_id = public.my_customer_id()) with check (customer_id = public.my_customer_id());

drop policy if exists "own rides" on rides;
create policy "own rides" on rides for select to authenticated
  using (customer_id = public.my_customer_id() or driver_id = public.my_driver_id());

drop policy if exists "own wallet" on wallet_txns;
create policy "own wallet" on wallet_txns for select to authenticated using (driver_id = public.my_driver_id());

drop policy if exists "own feedback" on feedback;
create policy "own feedback" on feedback for select to authenticated using (driver_id = public.my_driver_id());

drop policy if exists "riders see their passengers" on customers;
create policy "riders see their passengers" on customers for select to authenticated
  using (exists (select 1 from rides r where r.customer_id = customers.id and r.driver_id = public.my_driver_id()));

drop policy if exists "customers see their drivers" on drivers;
create policy "customers see their drivers" on drivers for select to authenticated
  using (exists (select 1 from rides r where r.driver_id = drivers.id and r.customer_id = public.my_customer_id()));
