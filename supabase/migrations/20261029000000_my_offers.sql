-- Offers the signed-in customer can still use. The app used to list every active coupon, so FIRST50 stayed on the
-- Offers page after the first ride and coupons stayed listed after their per-customer limit was used up.
-- Rules that depend on the trip (vehicle, destination, minimum fare, weekday) are still checked when booking;
-- this only drops what can never apply to this customer again.

create or replace function public.my_offers() returns setof public.coupons
language sql stable security definer set search_path = public, pg_temp as $$
  select c.* from public.coupons c
  where c.active and now() between c.starts_at and c.expires_at
    and (c.total_limit is null or c.uses < c.total_limit)
    and (select count(*) from public.coupon_redemptions r where r.code = c.code and r.user_id = auth.uid() and not r.released) < c.per_user_limit
    and not (c.first_ride_only and exists (select 1 from public.rides where customer_id = auth.uid() and status = 'Completed'))
  order by c.expires_at
$$;
revoke all on function public.my_offers() from public, anon;
grant execute on function public.my_offers() to authenticated;
