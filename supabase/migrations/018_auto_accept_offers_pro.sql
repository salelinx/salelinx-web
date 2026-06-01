-- Introduce `auto_accept_offers` — the scheduled auto-accept rule inside the
-- Offers tab — as its own boolean feature, gated at Pro+.
--
-- Previously auto-accept had no feature key of its own: it lived inside the
-- Offers tab, which is gated at Starter+ (`offers`), so any Starter user got
-- auto-accept for free. The Offers tab itself stays Starter+ (manual
-- accept / decline / counter); only the auto-accept automation moves to Pro+.

-- Free + Starter: feature off.
UPDATE public.tier_limits
SET features = features || jsonb_build_object('auto_accept_offers', false)
WHERE tier_id IN ('free', 'starter') AND effective_until IS NULL;

-- Pro + Business: feature on.
UPDATE public.tier_limits
SET features = features || jsonb_build_object('auto_accept_offers', true)
WHERE tier_id IN ('pro', 'business') AND effective_until IS NULL;
