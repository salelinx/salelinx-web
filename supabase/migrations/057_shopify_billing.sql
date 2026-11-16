-- Shopify billing: a subscription row that Shopify bills rather than Stripe.
--
-- Merchants who find SaleLinx in the Shopify App Store first pay through
-- Shopify App Pricing. Everyone who was a SaleLinx customer before connecting a
-- store keeps paying through Stripe. A Shopify-billed row carries the store's id
-- (the numeric part of its Shop GID, the same value as shopify_tokens.shop_id)
-- and no Stripe ids. The Shopify plan sync in the edge functions is its only
-- writer.
--
-- Who bills a row is read off its ids, as it already was for comps:
--
--   stripe_subscription_id set   Stripe
--   shopify_shop_id set          Shopify
--   neither                      a comp (a support grant or a creator code)
--
-- The entitlement rule (all three copies: _shared/entitlement.ts,
-- lib/supabase/subscription.ts and the extension's entitlements/entitled.ts)
-- treats only the last as a comp, so a Shopify row's period end is a renewal
-- date the sync keeps moving, never a deadline. Every caller that selects
-- stripe_subscription_id for the rule must select shopify_shop_id too.
--
-- One row per store. A store's subscription moves between trialing, active and
-- canceled on the same row, and Shopify keeps each store's trial history
-- itself, so there is no per-subscription id to key on.
--
-- Apply this before deploying any function or building an extension that
-- selects the column: a select naming a column that does not exist fails.
--
-- One transaction, so a step that fails on live changes nothing.

BEGIN;

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS shopify_shop_id TEXT;

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_shopify_shop_id_key UNIQUE (shopify_shop_id);

-- One biller per row: a Shopify row never carries Stripe's ids.
ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_one_biller CHECK (
    shopify_shop_id IS NULL
    OR (stripe_subscription_id IS NULL AND stripe_customer_id IS NULL)
  );

COMMENT ON COLUMN public.subscriptions.shopify_shop_id IS
  'The store''s id (numeric part of its Shop GID) when Shopify App Pricing bills this row. NULL for Stripe rows and comps. Written only by the Shopify plan sync. With stripe_subscription_id also NULL the row is a comp, whose current_period_end is a deadline; on a Shopify row it is a renewal date.';

-- =============================================================================
-- redeem_creator_code: a live Shopify subscription refuses a code too
-- =============================================================================
-- The guard is about whether a biller still owns the user's plan: a comp
-- written underneath a live subscription is overwritten by the biller's next
-- write and the one-time code is spent for nothing. Shopify's plan sync is
-- that kind of writer now, so a live Shopify row refuses a code as a live
-- Stripe row does. Otherwise the same as 024.

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
      AND (s.stripe_subscription_id IS NOT NULL OR s.shopify_shop_id IS NOT NULL)
      AND s.status IN ('active', 'trialing', 'past_due')
      -- An expired trial is the biller's leftover, not a live subscription.
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

COMMIT;
