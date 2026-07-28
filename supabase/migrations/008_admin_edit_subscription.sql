-- Admin console: edit a user's subscription (Users module).
--
-- Adds admin_set_user_subscription(), the write path behind the "Edit
-- subscription" form in the /admin/users detail drawer. Same pattern as every
-- other admin capability (006_admin_console.sql): the web app never holds the
-- service-role key, so the mutation is a SECURITY DEFINER function that
-- re-checks public.is_admin() itself and writes its own audit entry via
-- log_admin_action(). The app-level gate is defense in depth; THIS function is
-- the security boundary.
--
-- What it does:
--   * Updates tier_id / tier_version / status on the user's current
--     subscription row (the same row tier resolution prefers: newest entitled
--     row, else newest row of any status).
--   * If the user has NO subscription row, inserts a comp row (Stripe ids
--     null) - the "bespoke tiers / support comps" path from
--     docs/ENTITLEMENTS.md, now reachable from the console.
--
-- Guardrails (in the function, not the UI):
--   * status must be one of the subscriptions.status CHECK values.
--   * (tier_id, tier_version) must exist in tier_limits - assigning a tier
--     with no config row would resolve to nothing and silently gate the user
--     as if unconfigured. Historical (grandfathered) versions are allowed:
--     resolution looks up the exact (tier_id, version) pair.
--   * updated_at is bumped so the edited row wins the "newest row" selection
--     in admin_user_detail() and admin_list_users().
--   * The audit entry records old and new values, so the change is reversible
--     from the log (confirm-step UI, no step-up reauth, per docs/ADMIN.md).
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

  -- Metadata stays within the GDPR logging ceiling: user UUID only, no email.
  PERFORM public.log_admin_action(
    'user.subscription_update',
    'subscriptions',
    v_target.id::TEXT,
    jsonb_build_object(
      'user_id', p_user_id,
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

REVOKE ALL ON FUNCTION public.admin_set_user_subscription(UUID, TEXT, INTEGER, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_user_subscription(UUID, TEXT, INTEGER, TEXT) TO authenticated;
