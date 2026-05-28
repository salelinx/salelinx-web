-- Move shop_designer and messages down to Starter+. Previously:
-- shop_designer was Business-only; messages was Pro+.
--
-- Also introduce a new `offers` feature (incoming offers tab) gated at
-- Starter+. Free users see the lock badge + in-tab card. Auto-Offers
-- (`auto_offer`) stays Pro+ as before — different feature key.

-- Free tier: keep all three features off. Just adds the new `offers` key
-- (false) so every active row has it explicitly. shop_designer + messages
-- were already false for free in the v1 seed; reasserting that here keeps
-- the row's shape consistent if someone hand-edited it earlier.
UPDATE public.tier_limits
SET features = features
  || jsonb_build_object('shop_designer', false)
  || jsonb_build_object('messages', false)
  || jsonb_build_object('offers', false)
WHERE tier_id = 'free' AND effective_until IS NULL;

UPDATE public.tier_limits
SET features = features
  || jsonb_build_object('shop_designer', true)
  || jsonb_build_object('messages', true)
  || jsonb_build_object('offers', true)
WHERE tier_id IN ('starter', 'pro', 'business') AND effective_until IS NULL;
