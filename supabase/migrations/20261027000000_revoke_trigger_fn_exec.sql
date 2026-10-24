-- Hardening: the blocked-account guards are trigger functions and were left executable by every role
-- (Postgres grants EXECUTE to PUBLIC by default). Triggers don't check EXECUTE when they fire, so revoking
-- it changes nothing for the app — it only stops anyone holding the anon key from seeing them as callable.

revoke all on function public.profiles_blocked_guard() from public, anon, authenticated;
revoke all on function public.drivers_blocked_guard() from public, anon, authenticated;
revoke all on function public.rides_blocked_guard() from public, anon, authenticated;
