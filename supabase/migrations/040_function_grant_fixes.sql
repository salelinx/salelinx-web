-- 040: function grant/search_path fixes the earlier hygiene passes missed.
--
-- 1) 029_referral_display_name.sql created referral_codes_display_name_guard()
--    via CREATE OR REPLACE FUNCTION, which grants EXECUTE to PUBLIC by default
--    (the 024 gotcha). Every other function in 029 was re-revoked; this trigger
--    function was not, leaving it callable by anon via PostgREST. Calling a
--    trigger function outside trigger context errors, so this is attack surface
--    rather than a data leak, but it is exactly the advisor warning
--    024_function_grant_hygiene.sql exists to eliminate. Same treatment as the
--    trigger functions there: revoke from everyone, grant to nobody - only the
--    trigger on referral_codes invokes it. 029 also skipped the search_path
--    pin 024 gives every function, so pin it here too.
--
-- 2) apply_storage_delta was the other known straggler: the migrations
--    README has recorded "nothing revokes apply_storage_delta" since the
--    20260813 dashboard hotfix was folded in. It is SECURITY DEFINER and only
--    ever invoked from the (equally SECURITY DEFINER) storage trigger
--    functions that 019/024 already locked down, so no role needs direct
--    EXECUTE - same reasoning as 019's revoke of get_user_storage_cap.

REVOKE EXECUTE ON FUNCTION public.referral_codes_display_name_guard()
  FROM PUBLIC, anon, authenticated;
ALTER FUNCTION public.referral_codes_display_name_guard()
  SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.apply_storage_delta(UUID, BIGINT)
  FROM PUBLIC, anon, authenticated;
