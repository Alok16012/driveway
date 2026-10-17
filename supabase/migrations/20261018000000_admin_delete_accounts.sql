-- Admins can delete any customer or rider account.
-- No ride or payment history: the auth user is deleted, which cascades to the profile (and rider row).
-- With history: rides and the ledger are financial records that reference the profile/rider row, so those rows
-- stay but are anonymised and marked deleted, and the login is scrubbed and banned so the phone/email can sign up again.
-- Nobody with a ride still in progress can be deleted. Support tickets are removed either way.

alter table public.profiles add column if not exists deleted_at timestamptz;

-- Shared by both deletes: drop the login, or anonymise and lock it when financial records point at it.
create or replace function public.delete_account(p_user uuid, p_label text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if exists (select 1 from public.rides where (customer_id = p_user or driver_id = p_user)
             and status in ('Scheduled','Searching','Arriving','Arrived','Started')) then
    raise exception 'this account has a ride in progress — try again after it ends' using errcode = '22023';
  end if;
  delete from public.tickets where user_id = p_user;
  if exists (select 1 from public.rides where customer_id = p_user or driver_id = p_user)
     or exists (select 1 from public.ledger where user_id = p_user)
     or exists (select 1 from public.coupon_redemptions where user_id = p_user) then
    update public.profiles set name = p_label, email = null, phone = null, blocked = true, deleted_at = now() where id = p_user;
    update public.drivers set name = p_label, plate = 'DEL' || left(replace(p_user::text, '-', ''), 10), docs = '{}'::jsonb,
      upi = null, kyc_note = null, online = false, suspended = true where id = p_user;
    delete from auth.sessions where user_id = p_user;
    delete from auth.identities where user_id = p_user;
    update auth.users set email = null, phone = null, banned_until = 'infinity' where id = p_user;
  else
    delete from auth.users where id = p_user;
  end if;
end $$;
revoke all on function public.delete_account(uuid, text) from public, anon, authenticated;

create or replace function public.admin_delete_customer(p_user uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare who text;
begin
  perform public.require_admin();
  if p_user = auth.uid() then raise exception 'you cannot delete yourself' using errcode = '22023'; end if;
  select coalesce(nullif(name, ''), email, phone) into who from public.profiles where id = p_user and deleted_at is null;
  if not found then raise exception 'user not found' using errcode = 'P0002'; end if;
  if exists (select 1 from public.profiles where id = p_user and is_admin) then raise exception 'admins cannot be deleted here' using errcode = '22023'; end if;
  if exists (select 1 from public.drivers where id = p_user) then raise exception 'this account is a rider — delete it from Drivers' using errcode = '22023'; end if;
  perform public.delete_account(p_user, 'Deleted customer');
  perform public.audit('delete_customer', p_user::text, jsonb_build_object('name', who));
end $$;
revoke all on function public.admin_delete_customer(uuid) from public, anon;
grant execute on function public.admin_delete_customer(uuid) to authenticated;

create or replace function public.admin_delete_driver(p_driver uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare who text;
begin
  perform public.require_admin();
  if p_driver = auth.uid() then raise exception 'you cannot delete yourself' using errcode = '22023'; end if;
  select d.name || ' (' || d.plate || ')' into who from public.drivers d join public.profiles p on p.id = d.id
    where d.id = p_driver and p.deleted_at is null;
  if not found then raise exception 'driver not found' using errcode = 'P0002'; end if;
  if exists (select 1 from public.profiles where id = p_driver and is_admin) then raise exception 'admins cannot be deleted here' using errcode = '22023'; end if;
  perform public.delete_account(p_driver, 'Deleted rider');
  perform public.audit('delete_driver', p_driver::text, jsonb_build_object('name', who));
end $$;
revoke all on function public.admin_delete_driver(uuid) from public, anon;
grant execute on function public.admin_delete_driver(uuid) to authenticated;

-- Admins may remove a deleted rider's KYC files from the private bucket.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    drop policy if exists driver_docs_admin_delete on storage.objects;
    create policy driver_docs_admin_delete on storage.objects for delete to authenticated
      using (bucket_id = 'driver-docs' and public.is_admin());
  end if;
end $$;
