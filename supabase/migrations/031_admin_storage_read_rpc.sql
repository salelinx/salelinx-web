-- Admin console Storage module read RPC.
--
-- The Storage module was deferred in docs/ADMIN.md on the belief that no
-- per-user bytes-used data source existed. That became stale when migrations
-- 020-022 added public.user_storage: a per-user gauge of listing-images
-- bucket bytes, kept in lockstep by triggers on storage.objects. This
-- migration exposes that gauge to admins so /admin/storage can go live.
--
-- Same pattern as migration 029: user_storage is own-row-only under RLS
-- ("user_storage own read" = auth.uid() = user_id), so an admin's plain
-- select would see only their own row. The cross-user read is a SECURITY
-- DEFINER function that re-checks public.is_admin() ITSELF (the predicate is
-- in the WHERE, so non-admins get zero rows), making it safe to GRANT to all
-- authenticated users. The app-level gate is defense in depth; THIS function
-- is the real boundary.
--
-- Read-only: no INSERT/UPDATE/DELETE. Caps come from the public-read
-- tier_limits table on the page (getTierConfigs()), not here. The result is
-- bounded at one row per user who has ever uploaded, so no pagination is
-- needed at current scale.
--
-- DEFERRED (admin-mfa): read on an existing table; covered by the same
-- MFA-deferral story as migrations 027/029. No new tables, so no new
-- RESTRICTIVE policy stub.

CREATE OR REPLACE FUNCTION public.admin_list_storage()
RETURNS TABLE (
  user_id UUID,
  bytes_used BIGINT,
  updated_at TIMESTAMPTZ
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.user_id,
    s.bytes_used,
    s.updated_at
  FROM public.user_storage s
  WHERE public.is_admin()
  ORDER BY s.bytes_used DESC;
$$;

REVOKE ALL ON FUNCTION public.admin_list_storage() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_storage() TO authenticated;
