-- Tighten EXECUTE grants and pin search_path on the remaining public functions.
--
-- Clears the two standing classes of Supabase security advisor warnings so
-- that a genuinely new one stands out later instead of being lost in noise:
--
--   1. `function_search_path_mutable` on the two trigger functions that never
--      got `SET search_path` (the rest of the schema already pins it).
--   2. `anon_security_definer_function_executable` /
--      `authenticated_security_definer_function_executable` on functions that
--      were granted to every role by default at CREATE time.
--
-- This is hygiene, not a fix for a live hole. Every admin RPC below already
-- re-checks `public.is_admin()` internally (which additionally requires an
-- AAL2 / MFA session, see 009_admin_mfa.sql), and every user-scoped RPC below
-- already derives identity from `auth.uid()` and raises on NULL. An anon
-- caller gets nothing today; these revokes just remove the PostgREST surface
-- so it cannot be probed at all.
--
-- Deliberately NOT revoked:
--   - `public.is_admin()` keeps its `anon` grant. RLS policies on
--     support_tickets, support_ticket_replies and admin_audit_log call it for
--     the `public` role, and PostgreSQL checks EXECUTE when evaluating a
--     policy expression. Revoking it would turn "returns zero rows" into
--     "permission denied for function is_admin" for anonymous requests.
--   - `public.platform_account_hash()` is not SECURITY DEFINER and discloses
--     nothing on its own.
--
-- Idempotent: REVOKE on an already-revoked grant is a no-op, and both
-- function bodies below are replaced verbatim apart from the search_path.


-- 1. Pin search_path on the two unpinned trigger functions.
--
-- Bodies are unchanged. Without a pinned search_path a role with a custom
-- search_path could shadow an unqualified name; neither body references one
-- today, but pinning keeps the whole schema consistent.

CREATE OR REPLACE FUNCTION public.support_tickets_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_cloud_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.cloud_updated_at = NOW();
  RETURN NEW;
END;
$$;


-- 2. Trigger functions are not RPCs. Revoke EXECUTE from everyone.
--
-- PostgreSQL grants EXECUTE to PUBLIC on CREATE FUNCTION, so PostgREST happily
-- exposes every one of these at /rest/v1/rpc/<name>. Calling a trigger
-- function outside a trigger context errors anyway, but there is no reason for
-- the endpoint to exist. Firing an existing trigger does NOT re-check EXECUTE
-- (that check happens at CREATE TRIGGER time), so quota enforcement, row caps,
-- trial history and the timestamp touches all keep working unchanged.

REVOKE EXECUTE ON FUNCTION public.bump_user_storage_on_delete() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bump_user_storage_on_insert() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bump_user_storage_on_update() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_and_record_trial_history_on_link() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_cloud_storage_quota() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_linked_accounts_row_cap() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_listings_row_cap() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_support_reply_limits() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_support_ticket_limits() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_trial_history_on_subscription() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.support_ticket_replies_touch_parent() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.support_tickets_touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_cloud_timestamp() FROM PUBLIC, anon, authenticated;


-- 3. Admin console RPCs: signed-in admins only, never anon.
--
-- Each one already gates on public.is_admin() internally. The `authenticated`
-- grant stays because admins are authenticated users calling these from the
-- admin console (see components/admin/).

REVOKE EXECUTE ON FUNCTION public.admin_list_storage() FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_subscriptions() FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_usage(TEXT[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_users() FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_user_subscription(UUID, TEXT, INTEGER, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_user_detail(UUID, TEXT[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_user_emails(UUID[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_admin_action(TEXT, TEXT, TEXT, JSONB) FROM anon;


-- 4. User-scoped RPCs: all of these read auth.uid() and raise or no-op when it
-- is NULL, so anon can never do anything useful with them.

REVOKE EXECUTE ON FUNCTION public.claim_device_session(TEXT, TEXT, BOOLEAN) FROM anon;
REVOKE EXECUTE ON FUNCTION public.claim_referral(TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_or_create_referral_code() FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_pending_referral() FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_trialed_platform_account() FROM anon;
REVOKE EXECUTE ON FUNCTION public.increment_usage_counter(TEXT, TEXT, BIGINT) FROM anon;


-- 5. Maintenance functions: service_role / cron only.
--
-- Neither is called from the website or the extension (grepped both repos).
-- Both DELETE across all users rather than just the caller's rows, bounded
-- only by a retention window (14 months for counters, 24 months for closed
-- tickets). That window makes them low risk today, but a retention-policy
-- change would silently widen what any signed-in user could trigger.

REVOKE EXECUTE ON FUNCTION public.purge_old_support_tickets() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.purge_stale_usage_counters() FROM PUBLIC, anon, authenticated;
