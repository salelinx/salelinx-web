-- Widen the admin console's Users module from "who is this and what do they
-- pay" to "what is this account actually doing".
--
-- Nothing new is recorded here. Every field below already exists somewhere in
-- the schema, it was just never surfaced to the console:
--
--   linked_accounts   (001) the Depop / Vinted account tied to the cloud user,
--                     including the username, which is what makes a clickable
--                     link to their shop possible
--   device_sessions   (015) per-install heartbeats - the closest thing we have
--                     to "last active", and it beats last_sign_in_at because a
--                     refresh token keeps a session alive for weeks
--   listings          (001) the synced roster, aggregated per platform/status
--   user_storage      (004) the byte gauge the Storage module already reads
--
-- Same pattern as every other cross-user read in 006_admin_console.sql: all of
-- these tables are own-row-only under RLS, so the read is a SECURITY DEFINER
-- function that re-checks public.is_admin() itself (which additionally requires
-- an AAL2 / MFA session, see 009_admin_mfa.sql). No new table, no new RLS
-- policy, no new write path.
--
-- Both functions are READ-only, so neither writes to admin_audit_log: the log
-- records mutations, and adding a row per drawer open would bury the real
-- entries. This is a strict widening - every column and JSON key the previous
-- versions returned is still returned, with the same name and type.

-- =============================================================================
-- 1. admin_list_users() - two roster columns: linked platforms + last activity
-- =============================================================================
-- DROP then CREATE, not CREATE OR REPLACE: Postgres refuses to replace a
-- function whose OUT parameters (the RETURNS TABLE columns) changed.
--
-- Both additions are LATERAL subqueries against small, user-keyed tables
-- (linked_accounts is at most one row per platform per user; device_sessions
-- self-prunes installs idle for 30+ days inside claim_device_session), so the
-- roster stays one indexed lookup per user rather than a join that multiplies
-- rows. The body is otherwise byte-identical to the 006 version.
--
-- last_device_seen_at is deliberately returned RAW rather than pre-merged with
-- last_sign_in_at into one "last active" value: the UI shows which of the two
-- is more recent, and collapsing them here would throw that away.

DROP FUNCTION IF EXISTS public.admin_list_users();

CREATE FUNCTION public.admin_list_users()
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  created_at TIMESTAMPTZ,
  last_sign_in_at TIMESTAMPTZ,
  tier_id TEXT,
  status TEXT,
  is_admin BOOLEAN,
  linked_platforms TEXT[],
  last_device_seen_at TIMESTAMPTZ
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    u.id,
    u.email,
    u.created_at,
    u.last_sign_in_at,
    s.tier_id,
    s.status,
    EXISTS (
      SELECT 1 FROM public.admin_users a WHERE a.user_id = u.id
    ) AS is_admin,
    COALESCE(la.platforms, ARRAY[]::TEXT[]) AS linked_platforms,
    ds.last_seen_at AS last_device_seen_at
  FROM auth.users u
  LEFT JOIN LATERAL (
    SELECT sub.tier_id, sub.status
    FROM public.subscriptions sub
    WHERE sub.user_id = u.id
    ORDER BY sub.updated_at DESC
    LIMIT 1
  ) s ON TRUE
  LEFT JOIN LATERAL (
    SELECT array_agg(l.platform ORDER BY l.platform) AS platforms
    FROM public.linked_accounts l
    WHERE l.user_id = u.id
  ) la ON TRUE
  LEFT JOIN LATERAL (
    SELECT max(d.last_seen_at) AS last_seen_at
    FROM public.device_sessions d
    WHERE d.user_id = u.id
  ) ds ON TRUE
  WHERE public.is_admin()
  ORDER BY u.created_at DESC;
$$;

-- Grants must be re-stated because DROP + CREATE resets them, and the REVOKE
-- FROM PUBLIC is NOT sufficient on its own: this project has Supabase's default
-- privileges configured (ALTER DEFAULT PRIVILEGES ... GRANT ALL ON FUNCTIONS TO
-- anon, authenticated, service_role), so a newly CREATEd function in `public`
-- receives an EXPLICIT grant to `anon` that revoking PUBLIC leaves untouched.
-- Without the anon revoke below, dropping and recreating this function silently
-- republishes /rest/v1/rpc/admin_list_users to unauthenticated callers and
-- re-opens the `anon_security_definer_function_executable` advisor warning that
-- 024_function_grant_hygiene.sql exists to close.
--
-- Not a data leak either way (the body's `WHERE public.is_admin()` returns zero
-- rows to anon, and is_admin() additionally requires AAL2), but the endpoint
-- should not be probeable at all. Any future migration that DROPs an admin RPC
-- must repeat this pattern.
REVOKE ALL ON FUNCTION public.admin_list_users() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_list_users() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;

-- =============================================================================
-- 2. admin_user_detail() - four new keys in the drawer's JSONB bundle
-- =============================================================================
-- Added: linked_accounts, devices, listings, storage_bytes. The existing keys
-- (user_id, email, created_at, last_sign_in_at, subscription, usage,
-- ticket_count, is_admin) are unchanged, so an older client keeps working.
--
-- Cost notes, since this runs on every drawer open:
--   * listings is the only aggregate over a table that grows per user rather
--     than per account. idx_listings_status (user_id, platform, status) from
--     001 covers the GROUP BY, so it is one index scan of that user's rows.
--   * devices is capped at 10 rows. A user with more installs than that has a
--     sharing problem the Users module is not the right place to unpick, and
--     an unbounded array would let one pathological row set bloat the payload.
--   * platform_credentials is NOT exposed. It is encrypted client-side and the
--     console has no key, so it would be unreadable noise; whether a platform
--     is connected is already answered by linked_accounts.
--
-- listings.last_synced_at / created_at / updated_at are BIGINT epoch
-- MILLISECONDS written by the extension (see 001), not timestamps. They are
-- passed through as numbers and formatted client-side rather than converted
-- here, so a zero (the column default, meaning "never synced") stays
-- distinguishable from a real 1970 timestamp.

CREATE OR REPLACE FUNCTION public.admin_user_detail(
  p_user_id UUID,
  p_period_keys TEXT[] DEFAULT ARRAY[]::TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT jsonb_build_object(
    'user_id', u.id,
    'email', u.email,
    'created_at', u.created_at,
    'last_sign_in_at', u.last_sign_in_at,
    'subscription', (
      SELECT to_jsonb(s)
      FROM public.subscriptions s
      WHERE s.user_id = u.id
      ORDER BY s.updated_at DESC
      LIMIT 1
    ),
    'usage', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'feature', c.feature,
          'period_key', c.period_key,
          'count', c.count,
          'updated_at', c.updated_at
        )
        ORDER BY c.feature
      )
      FROM public.usage_counters c
      WHERE c.user_id = u.id
        AND c.period_key = ANY(p_period_keys)
    ), '[]'::jsonb),
    'ticket_count', (
      SELECT COUNT(*)
      FROM public.support_tickets t
      WHERE t.user_id = u.id
    ),
    'is_admin', EXISTS (
      SELECT 1 FROM public.admin_users a WHERE a.user_id = u.id
    ),

    -- The Depop / Vinted accounts tied to this cloud user. platform_username
    -- is what the console turns into a link to their shop; it can be null on
    -- older rows (the extension backfills it opportunistically), in which case
    -- only the platform id is shown.
    'linked_accounts', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'platform', l.platform,
          'platform_user_id', l.platform_user_id,
          'platform_username', l.platform_username,
          'linked_at', l.linked_at
        )
        ORDER BY l.platform
      )
      FROM public.linked_accounts l
      WHERE l.user_id = u.id
    ), '[]'::jsonb),

    -- Extension installs, most recently active first. user_agent is
    -- self-reported by the extension (same trust level as
    -- support_tickets.user_agent) - display only, never parsed for a decision.
    'devices', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'device_id', d.device_id,
          'user_agent', d.user_agent,
          'created_at', d.created_at,
          'last_seen_at', d.last_seen_at
        )
        ORDER BY d.last_seen_at DESC
      )
      FROM (
        SELECT ds.device_id, ds.user_agent, ds.created_at, ds.last_seen_at
        FROM public.device_sessions ds
        WHERE ds.user_id = u.id
        ORDER BY ds.last_seen_at DESC
        LIMIT 10
      ) d
    ), '[]'::jsonb),

    -- Synced listings broken down by platform and status, plus the freshest
    -- sync timestamps across the whole set. Empty array = nothing synced,
    -- which for a paying user is itself the signal worth seeing.
    'listings', jsonb_build_object(
      'total', (
        SELECT COUNT(*) FROM public.listings li WHERE li.user_id = u.id
      ),
      'by_platform_status', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'platform', g.platform,
            'status', g.status,
            'count', g.count
          )
          ORDER BY g.platform, g.status
        )
        FROM (
          SELECT li.platform, li.status, COUNT(*) AS count
          FROM public.listings li
          WHERE li.user_id = u.id
          GROUP BY li.platform, li.status
        ) g
      ), '[]'::jsonb),
      -- Epoch ms from the extension; 0 / null both mean "never synced".
      'last_synced_at', (
        SELECT MAX(li.last_synced_at) FROM public.listings li WHERE li.user_id = u.id
      ),
      -- Server-side clock: when a listing row was last written to Supabase.
      -- Trustworthy in a way the extension-supplied ms timestamps are not.
      'last_cloud_update_at', (
        SELECT MAX(li.cloud_updated_at) FROM public.listings li WHERE li.user_id = u.id
      )
    ),

    -- The same gauge the Storage module reads. Null when the user has never
    -- uploaded (no user_storage row), which is not the same as zero bytes.
    'storage_bytes', (
      SELECT us.bytes_used FROM public.user_storage us WHERE us.user_id = u.id
    )
  )
  INTO v_result
  FROM auth.users u
  WHERE u.id = p_user_id;

  RETURN v_result;
END;
$$;

-- CREATE OR REPLACE preserves existing grants (so this function never lost its
-- hardening), but the anon revoke is repeated for symmetry and idempotency:
-- REVOKE on an absent grant is a no-op.
REVOKE ALL ON FUNCTION public.admin_user_detail(UUID, TEXT[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_user_detail(UUID, TEXT[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_user_detail(UUID, TEXT[]) TO authenticated;
