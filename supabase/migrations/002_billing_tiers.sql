-- Billing infrastructure: subscriptions, tier_limits, usage_counters + RPC,
-- usage_feature_periods, Stripe webhook replay guard.
-- Supports the website's Stripe integration; the extension reads from these
-- tables to enforce entitlements.
--
-- Consolidated baseline (September 2026). This file is the net result of the
-- July 2026 baseline 002 plus the later incremental migrations that touched
-- billing: 012 + 018 (increment_usage_counter input bounds, row cap and
-- retention), 013 (stripe_webhook_events), 024 (grant hygiene), 038 + 039
-- (usage_feature_periods roster). Full history in git.
--
-- NOTE: tier_limits is runtime-editable via the admin console (see
-- 009_admin_console.sql), so the LIVE rows may legitimately differ from this
-- seed. The seed reflects the migration-history state as of the squash.

-- =============================================================================
-- 1. subscriptions - one row per user per Stripe subscription
-- =============================================================================

CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT UNIQUE,
  tier_id TEXT NOT NULL,
  tier_version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL CHECK (status IN ('active', 'past_due', 'canceled', 'incomplete', 'trialing')),
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX idx_subscriptions_customer ON public.subscriptions(stripe_customer_id);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscriptions own read"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- =============================================================================
-- 2. tier_limits - config table, one row per (tier_id, version)
-- =============================================================================

CREATE TABLE public.tier_limits (
  tier_id TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  features JSONB NOT NULL DEFAULT '{}'::jsonb,
  limits JSONB NOT NULL DEFAULT '{}'::jsonb,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_until TIMESTAMPTZ,
  PRIMARY KEY (tier_id, version)
);

CREATE INDEX idx_tier_limits_active
  ON public.tier_limits(tier_id)
  WHERE effective_until IS NULL;

ALTER TABLE public.tier_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tier_limits public read"
  ON public.tier_limits FOR SELECT
  USING (true);

-- =============================================================================
-- 3. usage_counters - per-user, per-feature, per-period running totals
-- =============================================================================

CREATE TABLE public.usage_counters (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature TEXT NOT NULL,
  period_key TEXT NOT NULL,
  count BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, feature, period_key)
);

ALTER TABLE public.usage_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usage_counters own read"
  ON public.usage_counters FOR SELECT
  USING (auth.uid() = user_id);

-- =============================================================================
-- 4. increment_usage_counter RPC - atomic upsert, scoped to auth.uid()
-- =============================================================================
-- Final form of the RPC after the original migrations 012 (delta and key-shape
-- bounds) and 018 (per-user row cap): usage only ever goes up, key shapes are
-- validated, and a user cannot accumulate unbounded counter rows.
--
-- NOTE: the extension repo still holds an unreconciled dated migration
-- (20260813_usage_period_key_server_side.sql) that would derive the period key
-- server-side instead. Per the original 038/039 it is NOT applied in
-- production; the live function is this one. See README.md.

CREATE OR REPLACE FUNCTION public.increment_usage_counter(
  p_feature TEXT,
  p_period_key TEXT,
  p_delta BIGINT DEFAULT 1
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_new_count BIGINT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- Usage only ever goes up; caps reset by period_key rollover, never by
  -- clients decrementing. The upper bound stops absurd single-call jumps.
  IF p_delta IS NULL OR p_delta < 1 OR p_delta > 1000 THEN
    RAISE EXCEPTION 'invalid delta';
  END IF;

  -- Keys are short machine identifiers ("crosslists_per_month", "2026-08"),
  -- not free text. Blocks junk-row flooding with arbitrary strings.
  IF p_feature IS NULL OR p_feature !~ '^[a-z0-9_]{1,64}$' THEN
    RAISE EXCEPTION 'invalid feature';
  END IF;
  IF p_period_key IS NULL OR p_period_key !~ '^[A-Za-z0-9_-]{1,32}$' THEN
    RAISE EXCEPTION 'invalid period key';
  END IF;

  -- Row-count guard, checked only when this call would create a NEW row so
  -- existing counters keep incrementing even at the cap.
  IF NOT EXISTS (
    SELECT 1 FROM usage_counters
    WHERE user_id = v_user_id AND feature = p_feature AND period_key = p_period_key
  ) AND (
    SELECT count(*) FROM usage_counters WHERE user_id = v_user_id
  ) >= 2000 THEN
    RAISE EXCEPTION 'counter row limit reached';
  END IF;

  INSERT INTO public.usage_counters (user_id, feature, period_key, count, updated_at)
  VALUES (v_user_id, p_feature, p_period_key, p_delta, NOW())
  ON CONFLICT (user_id, feature, period_key) DO UPDATE
    SET count = usage_counters.count + p_delta,
        updated_at = NOW()
  RETURNING count INTO v_new_count;

  RETURN v_new_count;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_usage_counter(TEXT, TEXT, BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.increment_usage_counter(TEXT, TEXT, BIGINT) TO authenticated;

-- =============================================================================
-- 5. usage_counters retention (original 018)
-- =============================================================================
-- Counter rows are only ever read for the current period (caps) or recent
-- history; anything untouched for 14 months is dead weight.

CREATE OR REPLACE FUNCTION public.purge_stale_usage_counters()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM public.usage_counters
  WHERE updated_at < now() - interval '14 months';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- Service role / cron only.
REVOKE ALL ON FUNCTION public.purge_stale_usage_counters() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'purge-stale-usage-counters',
      '43 3 * * *',
      'SELECT public.purge_stale_usage_counters()'
    );
  ELSE
    RAISE NOTICE 'pg_cron not available; schedule purge_stale_usage_counters() manually.';
  END IF;
END;
$$;

-- =============================================================================
-- 6. usage_feature_periods - daily vs monthly bucket per counter
-- =============================================================================
-- Period lookup for the server-derived-period variant of
-- increment_usage_counter (salelinx-app repo,
-- supabase/migrations/20260813_usage_period_key_server_side.sql). That variant
-- is NOT applied in production: the live function above writes the client-sent
-- period key, and the extension already sends YYYY-MM for the monthly
-- counters, so this table is inert config until it lands. The rows are in
-- place first so an unknown-counter daily fallback never truncates these to
-- one-day windows. Web abuse rate-limit counters (checkout_sessions etc.) are
-- deliberately NOT listed: they must stay daily.

create table if not exists public.usage_feature_periods (
  feature text primary key,
  period text not null check (period in ('daily', 'monthly'))
);

-- No policies: only SECURITY DEFINER functions and the service role need it.
alter table public.usage_feature_periods enable row level security;

insert into public.usage_feature_periods (feature, period) values
  ('follow', 'daily'),
  ('unfollow', 'daily'),
  ('refresh', 'daily'),
  ('crosslist', 'monthly'),
  ('relist', 'monthly'),
  ('offer_accept', 'monthly'),
  ('offer_decline', 'monthly'),
  ('offer_counter', 'monthly'),
  ('offer_auto_accept', 'monthly'),
  ('offer_send', 'monthly'),
  ('auto_markdown', 'monthly'),
  ('chat_reply', 'monthly'),
  ('shipping_label', 'monthly'),
  ('restock', 'monthly'),
  ('feedback', 'monthly'),
  ('shop_design', 'monthly'),
  ('shop_sale', 'monthly'),
  ('csv_import', 'monthly'),
  ('listing_link', 'monthly'),
  ('listing_edit', 'monthly'),
  ('listing_delete', 'monthly'),
  ('listing_duplicate', 'monthly'),
  ('listing_publish', 'monthly'),
  ('relist_sold', 'monthly'),
  ('photo_edit', 'monthly'),
  ('cloud_save', 'monthly'),
  ('cloud_update', 'monthly'),
  ('order_cancel', 'monthly')
on conflict (feature) do update set period = excluded.period;

-- =============================================================================
-- 7. stripe_webhook_events - processed-event ids for the replay guard
-- =============================================================================
-- Written only by the stripe-webhook Edge Function (service role). Rows older
-- than 30 days are pruned by the function itself; Stripe never redelivers
-- beyond that horizon.

CREATE TABLE public.stripe_webhook_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stripe_webhook_events_received
  ON public.stripe_webhook_events(received_at);

-- Service role bypasses RLS; enabling it with no policies locks everyone
-- else out entirely.
ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 8. Seed data - tier_limits v1
-- =============================================================================
-- Cloud storage: 500 MB = 524288000 bytes, 1 GB = 1073741824 bytes.
-- limits:   JSON number = cap, JSON null = unlimited, key absent = n/a.
-- features: JSON true = enabled, false/absent = disabled.
--
-- Feature placement rationale (from the original migrations):
--   account_linking        Pro+   (gateway to crosslisting/restocker workflows)
--   auto_markdown          Business-only (Price Drops)
--   dead_stock             Starter+
--   shop_designer/messages Starter+
--   offers                 Starter+ (manual accept/decline/counter in the tab)
--   auto_accept_offers     Pro+   (the automation inside the Offers tab)
--   shipping_labels        Pro+   (print locally)
--   shipping_label_email   Business-only (emailed merged-PDF automation)

INSERT INTO public.tier_limits (tier_id, version, features, limits) VALUES
  (
    -- 'free' is a fallback, not an advertised plan: the product model is a
    -- 7-day Starter trial then a paid tier. Users with no subscriptions row
    -- (never trialed, or trial expired without a card) resolve here, so all
    -- metered caps are 0 and every boolean feature is off. Manual listing
    -- management in the extension still works; bot/crosslist/relist actions
    -- surface the upgrade prompt.
    'free',
    1,
    '{"auto_refresh":false,"cloud_sync":false,"auto_offer":false,"shipping_labels":false,"messages":false,"restocker":false,"shop_designer":false,"dead_stock":false,"account_linking":false,"auto_markdown":false,"offers":false,"auto_accept_offers":false,"shipping_label_email":false}'::jsonb,
    '{"crosslists_per_month":0,"relists_per_month":0,"refreshes_per_day":0,"follows_per_day":0,"unfollows_per_day":0,"support_response_days":7}'::jsonb
  ),
  (
    'starter',
    1,
    '{"auto_refresh":false,"cloud_sync":false,"auto_offer":false,"shipping_labels":false,"messages":true,"restocker":false,"shop_designer":true,"dead_stock":true,"account_linking":false,"auto_markdown":false,"offers":true,"auto_accept_offers":false,"shipping_label_email":false}'::jsonb,
    '{"crosslists_per_month":150,"relists_per_month":150,"refreshes_per_day":100,"follows_per_day":500,"unfollows_per_day":500,"support_response_days":5}'::jsonb
  ),
  (
    'pro',
    1,
    '{"auto_refresh":true,"cloud_sync":true,"auto_offer":true,"shipping_labels":true,"messages":true,"restocker":false,"shop_designer":true,"dead_stock":true,"account_linking":true,"auto_markdown":false,"offers":true,"auto_accept_offers":true,"shipping_label_email":false}'::jsonb,
    '{"crosslists_per_month":3500,"relists_per_month":3500,"refreshes_per_day":null,"follows_per_day":null,"unfollows_per_day":null,"cloud_storage_bytes":524288000,"support_response_hours":48}'::jsonb
  ),
  (
    'business',
    1,
    '{"auto_refresh":true,"cloud_sync":true,"auto_offer":true,"shipping_labels":true,"messages":true,"restocker":true,"shop_designer":true,"dead_stock":true,"account_linking":true,"auto_markdown":true,"offers":true,"auto_accept_offers":true,"shipping_label_email":true}'::jsonb,
    '{"crosslists_per_month":null,"relists_per_month":null,"refreshes_per_day":null,"follows_per_day":null,"unfollows_per_day":null,"cloud_storage_bytes":1073741824,"support_response_hours":24}'::jsonb
  );
