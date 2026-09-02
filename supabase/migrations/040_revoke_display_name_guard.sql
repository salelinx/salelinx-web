-- 040: close the one EXECUTE grant 029 missed.
--
-- 029_referral_display_name.sql created referral_codes_display_name_guard()
-- via CREATE OR REPLACE FUNCTION, which grants EXECUTE to PUBLIC by default
-- (the 024 gotcha). Every other function in 029 was re-revoked; this trigger
-- function was not, leaving it callable by anon via PostgREST. Calling a
-- trigger function outside trigger context errors, so this is attack surface
-- rather than a data leak, but it is exactly the advisor warning
-- 024_function_grant_hygiene.sql exists to eliminate. Same treatment as the
-- trigger functions there: revoke from everyone, grant to nobody - only the
-- trigger on referral_codes invokes it.

REVOKE EXECUTE ON FUNCTION public.referral_codes_display_name_guard()
  FROM PUBLIC, anon, authenticated;
