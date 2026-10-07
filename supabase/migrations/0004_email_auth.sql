-- Step 3b: customers and riders sign up with name, email, mobile and password (Supabase email auth).
-- The mobile number is collected for calls during rides but is not verified, so sign-up policies
-- check ownership (user_id = auth.uid()) instead of matching a verified phone.
-- Safe to re-run. (Comments avoid apostrophes: the Supabase SQL editor has tripped on them.)

alter table drivers add column if not exists email text;

grant insert (user_id, name, phone, email) on customers to authenticated;
grant insert (user_id, name, phone, email, vehicle, model, plate, city) on drivers to authenticated;

drop policy if exists "sign up" on customers;
create policy "sign up" on customers for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "register" on drivers;
create policy "register" on drivers for insert to authenticated
  with check (user_id = auth.uid() and kyc = 'Pending' and online = false and suspended = false);
