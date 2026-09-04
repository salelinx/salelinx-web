-- Admin console: audit log, identity lookup, cross-user read RPCs, tier write
-- RPCs, subscription editing, storage read RPC.
--
-- Consolidated baseline (September 2026). This file is the net result of the
-- July 2026 baseline 006 plus the later incremental migrations that touched
-- the console: 008 (edit subscription), 011 (audit rows survive actor
-- deletion), 024 (grant hygiene), 025 (user observability columns), 028
-- (usage_counters period index). Full history in git.
--
-- Backs the dedicated /admin area (a top-level, internal-only console). The
-- web app never holds the service-role key, so every admin capability that
-- needs more than the user's own RLS scope is exposed as a SECURITY DEFINER
-- function that re-checks public.is_admin() itself (which additionally
-- requires an AAL2 / MFA session, see 003_support.sql). The app-level gate
-- (proxy + layout) is defense in depth; THESE policies/functions are the
-- real security boundary. Non-admins get zero rows (the is_admin() predicate
-- is in the WHERE clause) or a raised exception, so every function here is
-- safe to GRANT to all authenticated users.

-- =============================================================================
-- 1. admin_audit_log
-- =============================================================================
-- actor_id is nullable with ON DELETE SET NULL (original 011): retention is
-- documented as indefinite, even for admins who are later removed (the log
-- deliberately holds no ticket content or user IDs beyond the actor).
-- Cascading would silently destroy audit history, so the row survives and
-- only the actor link is cleared.

CREATE TABLE public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,           -- e.g. 'ticket.reply' | 'ticket.close' | 'ticket.delete'
  target_table TEXT,
  target_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_admin_audit_log_created_at
  ON public.admin_audit_log(created_at DESC);
CREATE INDEX idx_admin_audit_log_actor_id
  ON public.admin_audit_log(actor_id);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Admins can read the log (the "Audit log" module's data source).
CREATE POLICY "Admins read audit log"
  ON public.admin_audit_log FOR SELECT
  USING (public.is_admin());

-- No INSERT/UPDATE/DELETE policies: the log is append-only and writes go ONLY
-- through log_admin_action() (SECURITY DEFINER). This keeps the actor honest
-- (server-stamped) and the log tamper-resistant from the client.

-- =============================================================================
-- 2. log_admin_action() - the only write path into admin_audit_log
-- =============================================================================
-- SECURITY DEFINER so it can INSERT past the (intentionally absent) write
-- policies, but it re-checks public.is_admin() first so a non-admin calling it
-- directly gets rejected. actor_id is taken from auth.uid(), never the client.

CREATE OR REPLACE FUNCTION public.log_admin_action(
  p_action TEXT,
  p_target_table TEXT DEFAULT NULL,
  p_target_id TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  INSERT INTO public.admin_audit_log (actor_id, action, target_table, target_id, metadata)
  VALUES (auth.uid(), p_action, p_target_table, p_target_id, COALESCE(p_metadata, '{}'::jsonb));
END;
$$;

REVOKE ALL ON FUNCTION public.log_admin_action(TEXT, TEXT, TEXT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_admin_action(TEXT, TEXT, TEXT, JSONB) TO authenticated;

-- =============================================================================
-- 3. admin_user_emails() - batched identity lookup for admins
-- =============================================================================
-- support_tickets stores user_id but not email. Resolving email otherwise needs
-- the service role (Edge Functions only). This function lets the admin UI show
-- who filed a ticket: pass the ticket authors' user_ids, get back emails.

CREATE OR REPLACE FUNCTION public.admin_user_emails(p_user_ids UUID[])
RETURNS TABLE (user_id UUID, email TEXT)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id, u.email
  FROM auth.users u
  WHERE u.id = ANY(p_user_ids)
    AND public.is_admin();
$$;

REVOKE ALL ON FUNCTION public.admin_user_emails(UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_user_emails(UUID[]) TO authenticated;

-- =============================================================================
-- 4. admin_list_users() - the user roster (with observability columns)
-- =============================================================================
-- EXACTLY one row per auth.users user. We pick the user's most-recent
-- subscription via a LATERAL (a plain LEFT JOIN would emit one row PER
-- subscription, duplicating users who have more than one). A user with no
-- subscription shows null tier/status (treated as free in the UI). is_admin
-- flags membership in admin_users so the roster can badge admins without an
-- N+1.
--
-- linked_platforms and last_device_seen_at were added by the original 025:
-- both are LATERAL subqueries against small, user-keyed tables, so the roster
-- stays one indexed lookup per user. last_device_seen_at is returned RAW
-- rather than pre-merged with last_sign_in_at: the UI shows which of the two
-- is more recent, and collapsing them here would throw that away.

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

REVOKE ALL ON FUNCTION public.admin_list_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;

-- =============================================================================
-- 5. admin_list_subscriptions() - every subscription row
-- =============================================================================
-- The Subscriptions module's data source. Emails are resolved separately by
-- admin_user_emails() so this stays a pure subscriptions read.

CREATE OR REPLACE FUNCTION public.admin_list_subscriptions()
RETURNS TABLE (
  id UUID,
  user_id UUID,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  tier_id TEXT,
  tier_version INTEGER,
  status TEXT,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id,
    s.user_id,
    s.stripe_customer_id,
    s.stripe_subscription_id,
    s.tier_id,
    s.tier_version,
    s.status,
    s.current_period_end,
    s.cancel_at_period_end,
    s.created_at,
    s.updated_at
  FROM public.subscriptions s
  WHERE public.is_admin()
  ORDER BY s.updated_at DESC;
$$;

REVOKE ALL ON FUNCTION public.admin_list_subscriptions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_subscriptions() TO authenticated;

-- =============================================================================
-- 6. admin_list_usage(period_keys) - usage counters for the given periods
-- =============================================================================
-- The Usage module passes the current period keys (the YYYY-MM month bucket for
-- monthly features and the YYYY-MM-DD day bucket for daily features), computed
-- in the page so this function stays generic. Scoping to the current period
-- keeps the result bounded; usage_counters grows ~ users x features x periods
-- and daily rows accumulate one per user per day, so an unscoped read would
-- grow without bound. If the user base grows, add pagination / a top-N cap.

CREATE OR REPLACE FUNCTION public.admin_list_usage(p_period_keys TEXT[])
RETURNS TABLE (
  user_id UUID,
  feature TEXT,
  period_key TEXT,
  count BIGINT,
  updated_at TIMESTAMPTZ
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.user_id,
    c.feature,
    c.period_key,
    c.count,
    c.updated_at
  FROM public.usage_counters c
  WHERE c.period_key = ANY(p_period_keys)
    AND public.is_admin()
  ORDER BY c.count DESC;
$$;

REVOKE ALL ON FUNCTION public.admin_list_usage(TEXT[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_usage(TEXT[]) TO authenticated;

-- admin_list_usage filters with `WHERE period_key = ANY($1)`, but the PK is
-- (user_id, feature, period_key) so its btree cannot serve a lookup that does
-- not constrain user_id first (original 028). This index turns the fastest-
-- growing table's full scan into two small range reads.
CREATE INDEX idx_usage_counters_period_key
  ON public.usage_counters(period_key);

-- =============================================================================
-- 7. admin_user_detail(user_id) - the Users detail bundle for one user
-- =============================================================================
-- Returns a single JSONB blob so the detail drawer needs one round-trip.
-- Tier config (caps/features) is fetched on the page via the public-read
-- tier_limits table (getTierConfigs()), not here. is_admin in the payload is
-- the TARGET user's admin status, display-only. The function still gates on
-- the CALLER being an admin.
--
-- Observability keys (original 025): linked_accounts, devices (capped at 10
-- rows), listings (per platform/status aggregate + freshest sync timestamps)
-- and storage_bytes. platform_credentials is NOT exposed: it is encrypted
-- client-side and the console has no key. listings.last_synced_at is BIGINT
-- epoch MILLISECONDS written by the extension - passed through as a number so
-- 0 ("never synced") stays distinguishable from a real 1970 timestamp;
-- last_cloud_update_at is the trustworthy server-side clock.

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

REVOKE ALL ON FUNCTION public.admin_user_detail(UUID, TEXT[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_user_detail(UUID, TEXT[]) TO authenticated;

-- =============================================================================
-- 8. Tier write RPCs (Tier limits + Feature flags modules)
-- =============================================================================
-- tier_limits is public-read with NO client write policies (service-role
-- only). Both functions:
--   * only touch ACTIVE rows (effective_until IS NULL) - historical versions
--     are grandfathering records and must not be rewritten
--   * only update KNOWN keys - a typo'd key must fail loudly instead of
--     silently creating a new key nobody reads (extension gating treats a
--     missing/absent key as "not applicable"/"disabled", so a stray key is
--     invisible corruption). Limits require the key on the TARGET row (absent
--     means "not applicable", a meaningful state the UI shows as "-"). Features
--     require the key on ANY active row (absent just means disabled, and the
--     seed only adds feature keys to the tiers that have them, so enabling a
--     feature on a tier whose row lacks the key is legitimate). Introducing a
--     brand-new key stays a deliberate SQL-editor operation (see
--     docs/ENTITLEMENTS.md).
--   * write the audit entry INSIDE the function (via log_admin_action) with
--     the old and new value, so a mutation can never skip the audit log and
--     every change is reversible from the log.
--
-- Semantics preserved from docs/ENTITLEMENTS.md:
--   limits:   JSON number = cap, JSON null = unlimited, key absent = n/a
--   features: JSON true = enabled, false/absent = disabled
--
-- KNOWN WART, preserved from the live chain: unlike every other admin RPC,
-- these two still hold an `anon` EXECUTE grant via Supabase's default
-- privileges - the original 024 hygiene pass missed them. Harmless (both
-- gate on is_admin() internally), but it is the advisor-warning class 024
-- exists to close. Fix it in a new numbered migration (and apply the same
-- fix live), not here.

-- p_value: a JSON number (the new cap) or NULL / JSON null (unlimited).
CREATE OR REPLACE FUNCTION public.admin_set_tier_limit(
  p_tier_id TEXT,
  p_version INTEGER,
  p_key TEXT,
  p_value JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_value JSONB := COALESCE(p_value, 'null'::jsonb);
  v_old JSONB;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF jsonb_typeof(v_value) NOT IN ('number', 'null') THEN
    RAISE EXCEPTION 'limit value must be a number or null (unlimited)';
  END IF;

  IF jsonb_typeof(v_value) = 'number' AND (v_value)::numeric < 0 THEN
    RAISE EXCEPTION 'limit value must not be negative';
  END IF;

  SELECT t.limits -> p_key INTO v_old
  FROM public.tier_limits t
  WHERE t.tier_id = p_tier_id
    AND t.version = p_version
    AND t.effective_until IS NULL
    AND t.limits ? p_key
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'no active tier row (%, v%) with limit key %',
      p_tier_id, p_version, p_key;
  END IF;

  UPDATE public.tier_limits t
  SET limits = jsonb_set(t.limits, ARRAY[p_key], v_value)
  WHERE t.tier_id = p_tier_id
    AND t.version = p_version
    AND t.effective_until IS NULL;

  PERFORM public.log_admin_action(
    'tier.limit_update',
    'tier_limits',
    p_tier_id || ':v' || p_version,
    jsonb_build_object('key', p_key, 'old', v_old, 'new', v_value)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_tier_limit(TEXT, INTEGER, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_tier_limit(TEXT, INTEGER, TEXT, JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_tier_feature(
  p_tier_id TEXT,
  p_version INTEGER,
  p_key TEXT,
  p_enabled BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old JSONB;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF p_enabled IS NULL THEN
    RAISE EXCEPTION 'enabled must be true or false';
  END IF;

  -- Typo guard: the key must already be a known feature key on SOME active
  -- tier row (it does not have to exist on the target row; absent = disabled).
  IF NOT EXISTS (
    SELECT 1 FROM public.tier_limits t
    WHERE t.effective_until IS NULL AND t.features ? p_key
  ) THEN
    RAISE EXCEPTION 'unknown feature key %', p_key;
  END IF;

  SELECT t.features -> p_key INTO v_old
  FROM public.tier_limits t
  WHERE t.tier_id = p_tier_id
    AND t.version = p_version
    AND t.effective_until IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'no active tier row (%, v%)', p_tier_id, p_version;
  END IF;

  -- jsonb_set with create_missing = true: adds the key when the target row
  -- lacks it (absent and false are the same state for features).
  UPDATE public.tier_limits t
  SET features = jsonb_set(t.features, ARRAY[p_key], to_jsonb(p_enabled), true)
  WHERE t.tier_id = p_tier_id
    AND t.version = p_version
    AND t.effective_until IS NULL;

  PERFORM public.log_admin_action(
    'tier.feature_update',
    'tier_limits',
    p_tier_id || ':v' || p_version,
    jsonb_build_object('key', p_key, 'old', v_old, 'new', to_jsonb(p_enabled))
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_tier_feature(TEXT, INTEGER, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_tier_feature(TEXT, INTEGER, TEXT, BOOLEAN) TO authenticated;

-- =============================================================================
-- 9. admin_set_user_subscription() - edit a user's subscription (original 008)
-- =============================================================================
-- The write path behind the "Edit subscription" form in the /admin/users
-- detail drawer. What it does:
--   * Updates tier_id / tier_version / status on the user's current
--     subscription row (the same row tier resolution prefers: newest entitled
--     row, else newest row of any status).
--   * If the user has NO subscription row, inserts a comp row (Stripe ids
--     null) - the "bespoke tiers / support comps" path from
--     docs/ENTITLEMENTS.md.
--
-- Guardrails (in the function, not the UI): status must be a valid CHECK
-- value; (tier_id, tier_version) must exist in tier_limits (historical
-- grandfathered versions allowed); updated_at is bumped so the edited row
-- wins the "newest row" selection; the audit entry records old and new
-- values.
--
-- Stripe caveat (documented in docs/ADMIN.md and shown in the UI): if the row
-- is Stripe-managed (stripe_subscription_id set), the next webhook event for
-- that subscription overwrites tier_id/status again, and this change never
-- alters what Stripe charges. Overrides are durable only for comp rows or
-- lapsed subscriptions; real plan changes for paying users belong in Stripe.

CREATE OR REPLACE FUNCTION public.admin_set_user_subscription(
  p_user_id UUID,
  p_tier_id TEXT,
  p_tier_version INTEGER,
  p_status TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target public.subscriptions%ROWTYPE;
  v_old JSONB;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF p_status IS NULL
    OR p_status NOT IN ('active', 'past_due', 'canceled', 'incomplete', 'trialing') THEN
    RAISE EXCEPTION 'invalid status %', COALESCE(p_status, '(null)');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.tier_limits t
    WHERE t.tier_id = p_tier_id AND t.version = p_tier_version
  ) THEN
    RAISE EXCEPTION 'no tier_limits row for (%, v%)', p_tier_id, p_tier_version;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p_user_id) THEN
    RAISE EXCEPTION 'no such user';
  END IF;

  -- Pick the row tier resolution reads: prefer the newest ENTITLED row
  -- (active | trialing | past_due), else the newest row of any status
  -- (matches lib/supabase/subscription.ts, which prefers current statuses
  -- over lapsed rows).
  SELECT * INTO v_target
  FROM public.subscriptions s
  WHERE s.user_id = p_user_id
  ORDER BY (s.status IN ('active', 'trialing', 'past_due')) DESC,
    s.updated_at DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    v_old := jsonb_build_object(
      'tier_id', v_target.tier_id,
      'tier_version', v_target.tier_version,
      'status', v_target.status
    );

    UPDATE public.subscriptions s
    SET tier_id = p_tier_id,
      tier_version = p_tier_version,
      status = p_status,
      updated_at = NOW()
    WHERE s.id = v_target.id
    RETURNING * INTO v_target;
  ELSE
    -- No subscription history at all: create a comp row. Stripe ids stay
    -- null, so this row is never touched by the webhook.
    v_old := NULL;

    INSERT INTO public.subscriptions (user_id, tier_id, tier_version, status)
    VALUES (p_user_id, p_tier_id, p_tier_version, p_status)
    RETURNING * INTO v_target;
  END IF;

  -- Audit metadata carries NO user ids (docs/GDPR.md: audit entries must not
  -- reference users, so they cannot outlive an erasure request). target_id is
  -- the subscription row id, an opaque reference that cascades away with the
  -- account.
  PERFORM public.log_admin_action(
    'user.subscription_update',
    'subscriptions',
    v_target.id::TEXT,
    jsonb_build_object(
      'old', v_old,
      'new', jsonb_build_object(
        'tier_id', p_tier_id,
        'tier_version', p_tier_version,
        'status', p_status
      ),
      'stripe_managed', v_target.stripe_subscription_id IS NOT NULL
    )
  );

  RETURN to_jsonb(v_target);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_user_subscription(UUID, TEXT, INTEGER, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_subscription(UUID, TEXT, INTEGER, TEXT) TO authenticated;

-- =============================================================================
-- 10. admin_list_storage() - the Storage module's data source
-- =============================================================================
-- Reads the user_storage gauge (see 004_storage_quota.sql). Own-row-only under
-- RLS, so the cross-user read re-checks is_admin() like everything above.
-- Bounded at one row per user who has ever uploaded, so no pagination is
-- needed at current scale. Caps come from the public-read tier_limits table on
-- the page (getTierConfigs()), not here.

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

REVOKE ALL ON FUNCTION public.admin_list_storage() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_storage() TO authenticated;
