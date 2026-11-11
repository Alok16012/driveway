-- Customers and riders can delete their own account from the app (Google Play requires it).
-- Same rules as the admin delete: personal details are removed; rides and payments stay as anonymous records.
-- A rider who owes cash dues has to clear them first. KYC files: the owner (or an admin) can now delete them —
-- before this, nobody could, so files of deleted riders stayed in storage.

create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := public.require_user(); bal int; rider boolean;
begin
  if exists (select 1 from public.profiles where id = uid and is_admin) then
    raise exception 'admin accounts can''t be deleted from the app' using errcode = '22023'; end if;
  if exists (select 1 from public.profiles where id = uid and deleted_at is not null) then return; end if;
  rider := exists (select 1 from public.drivers where id = uid);
  if rider then
    bal := public.driver_balance(uid);
    if bal < 0 then raise exception 'clear your cash dues of ₹% before deleting your account', -bal using errcode = '22023'; end if;
  end if;
  perform public.audit('delete_self', uid::text, jsonb_build_object('rider', rider));
  perform public.delete_account(uid, case when rider then 'Deleted rider' else 'Deleted user' end);
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    drop policy if exists driver_docs_delete on storage.objects;
    create policy driver_docs_delete on storage.objects for delete to authenticated
      using (bucket_id = 'driver-docs' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
  end if;
end $$;
