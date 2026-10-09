-- Customers now sign up with email + password; name and mobile arrive as user metadata.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.profiles (id, name, phone, email)
  values (
    new.id,
    left(trim(coalesce(new.raw_user_meta_data->>'name', '')), 80),
    coalesce(nullif(new.phone, ''), nullif(new.raw_user_meta_data->>'phone', '')),
    nullif(new.email, '')
  )
  on conflict (id) do nothing;
  return new;
end $$;
revoke all on function public.handle_new_user() from authenticated;
