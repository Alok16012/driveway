-- TEMPORARY diagnostic: lets the server (service-role key only) read policies, grants and function
-- settings so RLS problems can be diagnosed without the SQL editor. Drop it when done:
--   drop function if exists public.debug_rls();
create or replace function public.debug_rls() returns json
language sql stable security definer set search_path = public, pg_catalog as $$
  select json_build_object(
    'whoami', current_user,
    'policies', (select json_agg(json_build_object('t', tablename, 'name', policyname, 'permissive', permissive, 'roles', roles::text, 'cmd', cmd, 'qual', qual, 'check', with_check) order by tablename, policyname)
                 from pg_policies where schemaname = 'public'),
    'tables', (select json_agg(json_build_object('t', c.relname, 'rls', c.relrowsecurity, 'force', c.relforcerowsecurity, 'owner', pg_get_userbyid(c.relowner)) order by c.relname)
               from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'),
    'functions', (select json_agg(json_build_object('f', p.proname, 'owner', pg_get_userbyid(p.proowner), 'definer', p.prosecdef, 'config', p.proconfig, 'src', left(p.prosrc, 300)) order by p.proname)
                  from pg_proc p where p.pronamespace = 'public'::regnamespace),
    'table_grants', (select json_agg(json_build_object('t', table_name, 'who', grantee, 'priv', privilege_type) order by table_name, grantee, privilege_type)
                     from information_schema.role_table_grants where table_schema = 'public' and grantee in ('anon', 'authenticated')),
    'owner_bypass', (select json_agg(json_build_object('role', rolname, 'bypassrls', rolbypassrls, 'super', rolsuper)) from pg_roles where rolname in ('postgres', 'authenticated', 'anon', 'service_role', 'supabase_admin'))
  )
$$;
revoke execute on function public.debug_rls() from public, anon, authenticated;
grant execute on function public.debug_rls() to service_role;
