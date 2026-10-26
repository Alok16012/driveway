-- Bikes, autos and e-rickshaws never have AC. admin_update_vehicle lost its "cannot be AC" check when it was rewritten
-- (20261020000000_vehicle_commission), so a save could switch AC on for them: the admin panel then showed an AC fee and
-- AC / Non-AC prices on the Bike card, and customers were offered an AC bike.
--    · Switch AC back off for those three.
--    · A CHECK constraint keeps it off, whoever writes the row.
--    · admin_update_vehicle refuses it again with a clear message.

update public.vehicles set ac = false, updated_at = now() where id in ('bike', 'auto', 'erick') and ac;

alter table public.vehicles drop constraint if exists vehicles_no_ac_two_three_wheelers;
alter table public.vehicles add constraint vehicles_no_ac_two_three_wheelers check (ac = false or id not in ('bike', 'auto', 'erick'));

create or replace function public.admin_update_vehicle(p_id text, p jsonb) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.require_admin();
  if coalesce((p->>'ac')::boolean, false) and p_id in ('bike', 'auto', 'erick') then raise exception 'this vehicle type cannot be AC' using errcode = '22023'; end if;
  if coalesce((p->>'base')::numeric, 0) > 1000 then raise exception 'base fare can be at most ₹1000' using errcode = '22023'; end if;
  if coalesce((p->>'per_km')::numeric, 0) > 100 then raise exception 'per-km rate can be at most ₹100' using errcode = '22023'; end if;
  if coalesce((p->>'per_min')::numeric, 0) > 10 then raise exception 'per-minute rate can be at most ₹10' using errcode = '22023'; end if;
  if coalesce((p->>'min_fare')::numeric, 0) > 2000 then raise exception 'minimum fare can be at most ₹2000' using errcode = '22023'; end if;
  if coalesce((p->>'cancel_fee')::numeric, 0) > 500 then raise exception 'cancellation fee can be at most ₹500' using errcode = '22023'; end if;
  update public.vehicles set
    base = coalesce((p->>'base')::int, base), per_km = coalesce((p->>'per_km')::numeric, per_km),
    per_min = coalesce((p->>'per_min')::numeric, per_min), min_fare = coalesce((p->>'min_fare')::int, min_fare),
    cancel_fee = coalesce((p->>'cancel_fee')::int, cancel_fee), ac = coalesce((p->>'ac')::boolean, ac),
    enabled = coalesce((p->>'enabled')::boolean, enabled),
    platform_fee = coalesce((p->>'platform_fee')::int, platform_fee),
    platform_fee_non_ac = coalesce((p->>'platform_fee_non_ac')::int, platform_fee_non_ac), updated_at = now()
  where id = p_id;                                                             -- CHECK constraints reject out-of-range values
  if not found then raise exception 'vehicle not found' using errcode = 'P0002'; end if;
  perform public.audit('update_vehicle', p_id, p);
end $$;
