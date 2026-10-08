-- Remove two tables left over from an earlier prototype. Nothing in the app or schema uses them, and they
-- had no row level security, so anyone with the anon key could read and write them. Dropped only if empty.
do $$
declare t text; n bigint;
begin
  foreach t in array array['customers','hotspots'] loop
    if to_regclass('public.' || t) is not null then
      execute format('select count(*) from public.%I', t) into n;
      if n > 0 then raise exception 'public.% has % rows — move or delete that data first', t, n; end if;
      execute format('drop table public.%I cascade', t);
    end if;
  end loop;
end $$;
