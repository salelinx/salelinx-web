-- =============================================================================
-- 041: per-user extension version
-- =============================================================================
-- We already collect `extension_version` in endpoint_health and crash_health,
-- but both of those are deliberately anonymous (no user_id, see docs/GDPR.md),
-- so they answer "how many installs are on 1.1.5" and never "which version is
-- THIS user on". That second question is the one support needs: a bug report
-- is unreadable without knowing which build produced it.
--
-- device_sessions (015) is the right home. It is already per-user, already
-- heartbeated by the extension every few minutes through claim_device_session,
-- and already carries display-only self-reported metadata (user_agent) at
-- exactly this trust level. One more column of the same kind adds no new
-- collection surface and no new consent question.
--
-- Trust level: self-reported by the extension, display only. Never gate a
-- decision on it. A modified client can send any string.

ALTER TABLE public.device_sessions
  ADD COLUMN IF NOT EXISTS extension_version TEXT;

COMMENT ON COLUMN public.device_sessions.extension_version IS
  'Self-reported chrome.runtime.getManifest().version from the extension heartbeat. Display only, never trusted for a decision.';

-- =============================================================================
-- 1. claim_device_session gains p_extension_version
-- =============================================================================
-- DROP before CREATE, not CREATE OR REPLACE. Postgres treats a different
-- argument count as a different function, so CREATE OR REPLACE would leave the
-- 3-arg version in place and ADD a 4-arg overload alongside it. Every existing
-- 3-arg call would then fail to resolve ("function is not unique") and the
-- device gate would break for every user at once.
--
-- Old extension builds (1.1.x, still the majority per endpoint_health) call
-- this with three named params. That stays working because the new parameter
-- is last and defaulted: PostgREST resolves by the keys it was given, and
-- those installs simply report a NULL version until they update.

DROP FUNCTION IF EXISTS public.claim_device_session(TEXT, TEXT, BOOLEAN);

CREATE FUNCTION public.claim_device_session(
  p_device_id TEXT,
  p_user_agent TEXT DEFAULT NULL,
  p_takeover BOOLEAN DEFAULT FALSE,
  p_extension_version TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_tier TEXT;
  v_cap INT;
  v_active_others INT;
  v_window INTERVAL := INTERVAL '10 minutes';
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_device_id IS NULL OR length(p_device_id) < 8 OR length(p_device_id) > 64 THEN
    RAISE EXCEPTION 'invalid device id';
  END IF;

  -- Opportunistic hygiene: this user's rows idle for 30+ days are dead installs.
  DELETE FROM device_sessions
  WHERE user_id = v_user_id AND last_seen_at < now() - INTERVAL '30 days';

  -- Resolve the cap from the user's current entitled tier; default 1.
  SELECT s.tier_id INTO v_tier
  FROM subscriptions s
  WHERE s.user_id = v_user_id
    AND s.status IN ('active', 'trialing', 'past_due')
  ORDER BY s.created_at DESC
  LIMIT 1;

  SELECT COALESCE((tl.limits->>'max_active_devices')::int, 1) INTO v_cap
  FROM tier_limits tl
  WHERE tl.tier_id = v_tier AND tl.effective_until IS NULL
  ORDER BY tl.version DESC
  LIMIT 1;
  v_cap := GREATEST(COALESCE(v_cap, 1), 1);

  SELECT count(*) INTO v_active_others
  FROM device_sessions ds
  WHERE ds.user_id = v_user_id
    AND ds.device_id <> p_device_id
    AND ds.last_seen_at > now() - v_window;

  IF v_active_others >= v_cap AND NOT p_takeover THEN
    RETURN jsonb_build_object('ok', false, 'active_devices', v_active_others);
  END IF;

  IF p_takeover AND v_active_others >= v_cap THEN
    -- Evict stalest-first until claimant + survivors fit under the cap.
    DELETE FROM device_sessions ds
    WHERE ds.user_id = v_user_id
      AND ds.device_id IN (
        SELECT device_id FROM device_sessions
        WHERE user_id = v_user_id
          AND device_id <> p_device_id
          AND last_seen_at > now() - v_window
        ORDER BY last_seen_at ASC
        LIMIT (v_active_others - (v_cap - 1))
      );
  END IF;

  INSERT INTO device_sessions (user_id, device_id, user_agent, extension_version, last_seen_at)
  VALUES (v_user_id, p_device_id, left(p_user_agent, 400), left(p_extension_version, 32), now())
  ON CONFLICT (user_id, device_id) DO UPDATE
    SET last_seen_at = now(),
        user_agent = COALESCE(EXCLUDED.user_agent, device_sessions.user_agent),
        -- COALESCE, so a heartbeat from an older build that sends no version
        -- does not wipe a version this install already reported.
        extension_version = COALESCE(EXCLUDED.extension_version, device_sessions.extension_version);

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- DROP + CREATE resets grants to the Postgres default (EXECUTE to PUBLIC), and
-- a later REVOKE FROM anon does not remove access held via PUBLIC. Restate the
-- hardening from 024_function_grant_hygiene.sql explicitly.
REVOKE ALL ON FUNCTION public.claim_device_session(TEXT, TEXT, BOOLEAN, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_device_session(TEXT, TEXT, BOOLEAN, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.claim_device_session(TEXT, TEXT, BOOLEAN, TEXT) TO authenticated;

-- =============================================================================
-- 2. admin_list_users() gains extension_version
-- =============================================================================
-- Taken from the SAME device row as last_device_seen_at (the freshest install)
-- rather than an independent max(), so the roster never pairs one device's
-- timestamp with another device's version. A user on two machines is a real
-- case and the pair has to describe one of them, not a blend.

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
  last_device_seen_at TIMESTAMPTZ,
  extension_version TEXT
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
    ds.last_seen_at AS last_device_seen_at,
    ds.extension_version
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
    SELECT d.last_seen_at, d.extension_version
    FROM public.device_sessions d
    WHERE d.user_id = u.id
    ORDER BY d.last_seen_at DESC
    LIMIT 1
  ) ds ON TRUE
  WHERE public.is_admin()
  ORDER BY u.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.admin_list_users() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_list_users() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;

-- =============================================================================
-- 3. admin_user_detail() reports the version per install
-- =============================================================================
-- Same signature, so CREATE OR REPLACE genuinely replaces. Grants are restated
-- anyway because REPLACE also resets them (024 gotcha).

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

    -- Extension installs, most recently active first. user_agent and
    -- extension_version are both self-reported by the extension (same trust
    -- level as support_tickets.user_agent) - display only, never parsed for a
    -- decision. extension_version is null for installs still on a build that
    -- predates 041, and for any install that has not heartbeated since.
    'devices', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'device_id', d.device_id,
          'user_agent', d.user_agent,
          'extension_version', d.extension_version,
          'created_at', d.created_at,
          'last_seen_at', d.last_seen_at
        )
        ORDER BY d.last_seen_at DESC
      )
      FROM (
        SELECT ds.device_id, ds.user_agent, ds.extension_version, ds.created_at, ds.last_seen_at
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

REVOKE ALL ON FUNCTION public.admin_user_detail(UUID, TEXT[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_user_detail(UUID, TEXT[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_user_detail(UUID, TEXT[]) TO authenticated;
