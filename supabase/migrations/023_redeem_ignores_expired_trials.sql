-- redeem_creator_code refused anyone holding a Stripe-managed row in
-- active/trialing/past_due. Migration 022 made an expired `trialing` row grant
-- nothing, so that guard started contradicting itself: a creator whose trial
-- lapsed would be told "you already have a subscription" while having no
-- access at all, and their one-time code would be refused.
--
-- The guard is not really about status. It is about whether Stripe still owns
-- the row: a comp written underneath a live subscription gets overwritten by
-- the next webhook, and the code would be spent for nothing. An expired trial
-- is not that. Stripe has finished with it, nothing is going to overwrite it,
-- and the person is locked out.
--
-- A past_due row that never paid stays refused deliberately. Stripe is still
-- running dunning there, so the subscription is live and a comp would be
-- clobbered even though the user currently has no access.

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
      -- An expired trial is Stripe's leftover, not a live subscription.
      AND NOT (
        s.status = 'trialing'
        AND s.current_period_end IS NOT NULL
        AND s.current_period_end < NOW()
      )
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
