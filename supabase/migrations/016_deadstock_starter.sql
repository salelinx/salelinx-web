-- Make Dead Stock a Starter feature (was Business-only).

UPDATE public.tier_limits
SET features = features || jsonb_build_object('dead_stock', true)
WHERE tier_id IN ('starter', 'pro', 'business') AND effective_until IS NULL;
