-- Gate the "Email Labels" sub-feature inside the Shipping Labels tab as
-- Business-only. The Shipping Labels tab itself stays Pro+ (see migration 011
-- — `shipping_labels` feature). Pro users can still print labels locally;
-- emailing a merged PDF via the Supabase Edge Function is the Business
-- automation slice.
--
-- Pattern mirrors migration 018 (auto_accept_offers): the parent feature
-- stays at its current tier, the sub-feature gets its own boolean key and
-- gates higher.

-- Free + Starter + Pro: feature off.
UPDATE public.tier_limits
SET features = features || jsonb_build_object('shipping_label_email', false)
WHERE tier_id IN ('free', 'starter', 'pro') AND effective_until IS NULL;

-- Business: feature on.
UPDATE public.tier_limits
SET features = features || jsonb_build_object('shipping_label_email', true)
WHERE tier_id = 'business' AND effective_until IS NULL;
