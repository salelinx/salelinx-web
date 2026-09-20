-- Creator codes: one-time codes that comp a tier for a fixed number of months.
--
-- Issued by hand for creator outreach (see Marketing/youtube-research). The
-- creator signs up like anyone else, opens /redeem/<CODE>, and lands on the
-- comped tier without a card and without anyone in support touching a row.
--
-- This is the self-serve half of what admin_set_user_subscription already does
-- from /admin/users: it inserts a comp row (Stripe ids null), which the webhook
-- never touches. The differences are that the caller redeems it themselves, and
-- that the row carries an expiry.
--
-- The expiry is the reason migration 021 also changes entitlement. Until now a
-- comp row was entitled forever, because isSubscriptionEntitled granted any
-- 'active' row unconditionally and nothing read current_period_end. A comped
-- month would have run until someone remembered to switch it off. The rule now
-- honours current_period_end on rows with no stripe_subscription_id, which is
-- exactly the set of comp rows. See supabase/functions/_shared/entitlement.ts
-- and its two mirrors. Stripe-managed rows are unaffected: their period end is
-- a renewal date, not a deadline, and the webhook moves it.

CREATE TABLE IF NOT EXISTS public.creator_codes (
  code TEXT PRIMARY KEY CHECK (code ~ '^[A-HJ-NP-Z2-9]{8}$'),
  tier_id TEXT NOT NULL,
  tier_version INTEGER NOT NULL DEFAULT 1,
  months INTEGER NOT NULL DEFAULT 1 CHECK (months BETWEEN 1 AND 12),
  -- Who it was issued to, for our own records. A YouTube channel name, which
  -- is public, not personal data we hold on the redeemer.
  issued_to TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- SET NULL rather than CASCADE: an erased account must not resurrect a spent
  -- code, and once nulled the row holds nothing about anyone. The table is
  -- therefore outside the deletion runbook in docs/GDPR.md.
  redeemed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  redeemed_at TIMESTAMPTZ,
  FOREIGN KEY (tier_id, tier_version)
    REFERENCES public.tier_limits(tier_id, version)
);

COMMENT ON TABLE public.creator_codes IS
  'One-time comp codes handed out for creator outreach. Redeemed via redeem_creator_code().';

-- No client policies at all. Reads would leak unredeemed codes, and the only
-- write path is the SECURITY DEFINER function below.
ALTER TABLE public.creator_codes ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- redeem_creator_code() - spend a code on the caller's own account
-- =============================================================================
-- Refuses an unknown or already-spent code, and refuses outright if the caller
-- has a live Stripe subscription: admin_set_user_subscription documents that a
-- Stripe-managed row is overwritten by the next webhook event, so a comp there
-- would silently evaporate and the code would be gone. Those people should mail
-- support instead, which the page tells them.
--
-- A lapsed or comped row is no obstacle. The insert adds a newer row and tier
-- resolution prefers the newest entitled one (lib/supabase/subscription.ts).

CREATE OR REPLACE FUNCTION public.redeem_creator_code(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_code public.creator_codes%ROWTYPE;
  v_sub public.subscriptions%ROWTYPE;
  v_normalised TEXT;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- People retype these off an email, so spaces, dashes and lower case are all
  -- expected. The alphabet has no I, O, 1 or 0 for the same reason.
  v_normalised := upper(regexp_replace(COALESCE(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  IF v_normalised !~ '^[A-HJ-NP-Z2-9]{8}$' THEN
    RAISE EXCEPTION 'invalid_code';
  END IF;

  SELECT * INTO v_code
  FROM public.creator_codes c
  WHERE c.code = v_normalised
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_code';
  END IF;

  IF v_code.redeemed_at IS NOT NULL THEN
    RAISE EXCEPTION 'already_redeemed';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.user_id = v_user
      AND s.stripe_subscription_id IS NOT NULL
      AND s.status IN ('active', 'trialing', 'past_due')
  ) THEN
    RAISE EXCEPTION 'already_subscribed';
  END IF;

  INSERT INTO public.subscriptions (
    user_id, tier_id, tier_version, status, current_period_end
  )
  VALUES (
    v_user,
    v_code.tier_id,
    v_code.tier_version,
    'active',
    NOW() + (v_code.months || ' months')::INTERVAL
  )
  RETURNING * INTO v_sub;

  UPDATE public.creator_codes c
  SET redeemed_by = v_user,
    redeemed_at = NOW()
  WHERE c.code = v_normalised;

  RETURN jsonb_build_object(
    'tier_id', v_sub.tier_id,
    'expires_at', v_sub.current_period_end
  );
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_creator_code(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_creator_code(TEXT) TO authenticated;
