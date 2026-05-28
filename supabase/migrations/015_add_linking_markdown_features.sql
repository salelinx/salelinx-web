-- Add `account_linking` and `auto_markdown` boolean features to tier_limits.
--
-- Linking: Pro+ (account linking is the cross-platform plumbing — historically
-- ungated, but as it's now the gateway to crosslisting/restocker workflows we
-- treat it as a Pro entitlement).
-- Auto-markdown (Price Drops): Business-only.
--
-- Caps changes to existing rows are jsonb_set merges so we don't clobber other
-- feature keys (per the resale-bot-web CLAUDE.md gotcha).

UPDATE public.tier_limits
SET features = features
  || jsonb_build_object('account_linking', false)
  || jsonb_build_object('auto_markdown', false)
WHERE tier_id IN ('free', 'starter') AND effective_until IS NULL;

UPDATE public.tier_limits
SET features = features
  || jsonb_build_object('account_linking', true)
  || jsonb_build_object('auto_markdown', false)
WHERE tier_id = 'pro' AND effective_until IS NULL;

UPDATE public.tier_limits
SET features = features
  || jsonb_build_object('account_linking', true)
  || jsonb_build_object('auto_markdown', true)
WHERE tier_id = 'business' AND effective_until IS NULL;
