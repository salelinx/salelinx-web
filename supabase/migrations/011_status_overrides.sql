-- Manual status overrides for the public status page.
--
-- /docs/status derives feature status from passive telemetry (030). That is
-- right most of the time and wrong exactly when it matters: telemetry cannot
-- see a marketplace's own announcement, a breakage reported by one loud user
-- before it shows in aggregate, or a fix that is deployed but not yet visible
-- in the numbers.
--
-- So each target is AUTOMATIC BY DEFAULT and switches to manual only when a row
-- exists here. Absence of a row is the normal state - this table stays empty
-- most of the time, and an override is a deliberate, audited act.
--
-- Manual WINS while it exists and never auto-expires. Auto-expiry was
-- considered and rejected: it would silently un-announce a real incident at an
-- arbitrary hour. The cost is a stale override lingering, which the admin UI
-- addresses by showing each override's age rather than by guessing on the
-- user's behalf.
--
-- Targets are strings rather than a foreign key because the two kinds of thing
-- being overridden live in different places: features are defined in
-- lib/admin/feature-endpoints.ts (a code constant), platforms are just 'depop'
-- and 'vinted'. A FK would need a table that does not exist and would drift
-- from the code map anyway.

CREATE TABLE IF NOT EXISTS public.status_overrides (
  -- 'feature:<key>' (matching FEATURE_ENDPOINTS[].key) or 'platform:depop' /
  -- 'platform:vinted'. Primary key, so setting an override twice replaces it
  -- rather than stacking.
  target TEXT PRIMARY KEY CHECK (
    target ~ '^(feature|platform):[a-z0-9-]+$'
  ),
  state TEXT NOT NULL CHECK (state IN ('ok', 'degraded', 'down')),
  -- Optional public note, rendered under the item on /docs/status. Capped
  -- because it is freeform text on a public page.
  note TEXT CHECK (note IS NULL OR length(note) <= 280),
  -- Who set it, kept for the audit trail. ON DELETE SET NULL rather than
  -- CASCADE: deleting an admin must not silently clear a live incident notice
  -- (see docs/GDPR.md - the audit log keeps the row and drops the actor link).
  set_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.status_overrides ENABLE ROW LEVEL SECURITY;

-- Public read: the status page is anonymous and needs the override to display.
-- The row carries no personal data beyond set_by, which is NOT exposed - the
-- public read goes through public_status_overrides() below, not this table.
REVOKE ALL ON TABLE public.status_overrides FROM PUBLIC, anon, authenticated;

-- =============================================================================
-- 1. public_status_overrides() - anonymous read for the status page
-- =============================================================================
-- Deliberately omits set_by: who declared an incident is internal.

CREATE OR REPLACE FUNCTION public.public_status_overrides()
RETURNS TABLE (target TEXT, state TEXT, note TEXT, updated_at TIMESTAMPTZ)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.target, o.state, o.note, o.updated_at
  FROM public.status_overrides o;
$$;

REVOKE ALL ON FUNCTION public.public_status_overrides() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_status_overrides() TO anon, authenticated;

-- =============================================================================
-- 2. admin_list_status_overrides() - includes set_by for the console
-- =============================================================================

CREATE OR REPLACE FUNCTION public.admin_list_status_overrides()
RETURNS TABLE (
  target TEXT,
  state TEXT,
  note TEXT,
  set_by UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
  SELECT o.target, o.state, o.note, o.set_by, o.created_at, o.updated_at
  FROM public.status_overrides o
  ORDER BY o.updated_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_status_overrides() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_status_overrides() TO authenticated;

-- =============================================================================
-- 3. admin_set_status_override() - switch a target to manual
-- =============================================================================
-- Audit-logged: this changes what the PUBLIC site says, which is exactly the
-- class of action the audit log exists for.

CREATE OR REPLACE FUNCTION public.admin_set_status_override(
  p_target TEXT,
  p_state TEXT,
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_previous public.status_overrides%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF p_target !~ '^(feature|platform):[a-z0-9-]+$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_target');
  END IF;
  IF p_state NOT IN ('ok', 'degraded', 'down') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_state');
  END IF;
  IF p_note IS NOT NULL AND length(p_note) > 280 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'note_too_long');
  END IF;

  SELECT * INTO v_previous FROM public.status_overrides WHERE target = p_target;

  INSERT INTO public.status_overrides (target, state, note, set_by, updated_at)
  VALUES (p_target, p_state, NULLIF(btrim(p_note), ''), auth.uid(), NOW())
  ON CONFLICT (target) DO UPDATE
    SET state = EXCLUDED.state,
        note = EXCLUDED.note,
        set_by = EXCLUDED.set_by,
        updated_at = NOW();

  PERFORM public.log_admin_action(
    'status_override_set',
    'status_overrides',
    p_target,
    jsonb_build_object(
      'state', p_state,
      'note', NULLIF(btrim(p_note), ''),
      -- Old value recorded so the entry is reversible by reading the log.
      'previous_state', v_previous.state,
      'previous_note', v_previous.note
    )
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_status_override(TEXT, TEXT, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_status_override(TEXT, TEXT, TEXT)
  TO authenticated;

-- =============================================================================
-- 4. admin_clear_status_override() - back to automatic
-- =============================================================================

CREATE OR REPLACE FUNCTION public.admin_clear_status_override(p_target TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_previous public.status_overrides%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT * INTO v_previous FROM public.status_overrides WHERE target = p_target;
  IF NOT FOUND THEN
    -- Already automatic. Not an error: the UI can clear idempotently.
    RETURN jsonb_build_object('ok', true, 'cleared', false);
  END IF;

  DELETE FROM public.status_overrides WHERE target = p_target;

  PERFORM public.log_admin_action(
    'status_override_cleared',
    'status_overrides',
    p_target,
    jsonb_build_object(
      'previous_state', v_previous.state,
      'previous_note', v_previous.note
    )
  );

  RETURN jsonb_build_object('ok', true, 'cleared', true);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_clear_status_override(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_clear_status_override(TEXT) TO authenticated;
