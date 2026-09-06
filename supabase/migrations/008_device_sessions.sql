-- Concurrent-device cap: stop account SHARING without punishing one person's
-- own multiple devices.
--
-- Consolidated baseline (September 2026). Net result of the original
-- migrations 015 (table + claim RPC) and 026 (Realtime publication for
-- instant eviction), plus 024's anon revoke. Full history in git.
--
-- Being logged in on five machines is fine. What we cap is simultaneous
-- ACTIVE use: each extension install heartbeats while its panel is in use,
-- and a claim is denied when other devices were active inside a short rolling
-- window. One person switching laptop -> desktop rarely overlaps for long;
-- two people splitting one subscription overlap constantly.
--
-- Takeover model (Netflix-style): the newcomer can always "Use here instead",
-- which evicts the stalest active device. The evicted device learns about it
-- instantly via Realtime (its row DELETE is pushed), with the next heartbeat
-- as fallback. Nobody is ever locked out of their own account.
--
-- The cap is config, not code: limits->>'max_active_devices' on tier_limits,
-- defaulting to 1 when the key is absent - which is what every tier ships
-- with. To later sell a multi-device allowance on a tier, set the key with
-- jsonb_set, never a full UPDATE of the limits column (see CLAUDE.md gotcha).

-- =============================================================================
-- 1. device_sessions - one row per (user, extension install)
-- =============================================================================
-- ON DELETE CASCADE per the GDPR runbook: device rows die with the account.
-- device_id is a random UUID minted by the extension install; user_agent is
-- display-only metadata (same trust level as support_tickets.user_agent).

CREATE TABLE public.device_sessions (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, device_id)
);

ALTER TABLE public.device_sessions ENABLE ROW LEVEL SECURITY;

-- Read-only for the owner (account page "your devices" surface later).
-- All writes go through the SECURITY DEFINER RPC below - no client policies.
CREATE POLICY "device_sessions self read"
  ON public.device_sessions FOR SELECT
  USING (auth.uid() = user_id);

-- =============================================================================
-- 2. claim_device_session RPC
-- =============================================================================
-- Called by the extension on panel open and every few minutes while the
-- panel stays in use. Returns jsonb:
--   { ok: true }                              claim accepted, heartbeat stored
--   { ok: false, active_devices: <n> }        cap reached; caller shows the
--                                             device gate with a takeover CTA
--
-- p_takeover = true always succeeds: it evicts the stalest active other
-- device(s) until the claimant fits under the cap. Eviction is a plain row
-- DELETE - the evicted install's next claim simply finds the cap consumed by
-- newer devices and gets denied.

CREATE OR REPLACE FUNCTION public.claim_device_session(
  p_device_id TEXT,
  p_user_agent TEXT DEFAULT NULL,
  p_takeover BOOLEAN DEFAULT FALSE
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

  INSERT INTO device_sessions (user_id, device_id, user_agent, last_seen_at)
  VALUES (v_user_id, p_device_id, left(p_user_agent, 400), now())
  ON CONFLICT (user_id, device_id) DO UPDATE
    SET last_seen_at = now(),
        user_agent = COALESCE(EXCLUDED.user_agent, device_sessions.user_agent);

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_device_session(TEXT, TEXT, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_device_session(TEXT, TEXT, BOOLEAN) TO authenticated;

-- =============================================================================
-- 3. Realtime publication (original 026)
-- =============================================================================
-- Publishes row CHANGES, not read access: Realtime still evaluates the
-- table's RLS per subscriber, and the only policy is self-read, so a
-- subscriber can only ever be told about their own rows. The payload carries
-- the replica identity columns only - a random per-install device id and the
-- owning user's uuid. No user agent, no marketplace data (docs/GDPR.md).
--
-- REPLICA IDENTITY FULL so a DELETE payload carries the whole old row rather
-- than just the primary key - it is what makes Realtime's RLS check and its
-- `filter` reliably able to see user_id on a delete. The table is tiny and
-- low-churn, so the extra WAL is negligible.

ALTER TABLE public.device_sessions REPLICA IDENTITY FULL;

-- Idempotent: ADD TABLE raises if the table is already in the publication, and
-- this migration must be safe to re-run.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'device_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.device_sessions;
  END IF;
END;
$$;
