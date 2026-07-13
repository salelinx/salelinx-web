-- Core sync schema: listings, platform credentials, user settings, linked accounts.
--
-- Consolidated baseline (July 2026). This file is the net result of the
-- original migrations 001, 002, 004-008, 010, 012_add_markdown_fields, 013
-- and 014 - the full per-change history lives in git (see this folder's
-- README.md). The live Supabase project already reflects this state; these
-- files exist to rebuild a fresh project from scratch.

-- =============================================================================
-- 1. listings - synced from the extension's local IndexedDB
-- =============================================================================
-- Column notes:
--   enriched_data / enriched_at   full JSON blob from the item-level API
--                                 endpoint + ms timestamp of last enrichment
--   platform_user_id              which platform account the listing came from
--   link_id                       cross-platform item linking; listings sharing
--                                 a link_id are the same physical item. TEXT so
--                                 it can store IDB composite IDs ("depop_abc123")
--   restock_*                     restock state lives directly on listings
--   markdown_*                    Auto-Markdown scheduled price drops:
--     markdown_percent            % drop applied each time the interval elapses
--     markdown_interval_days      cadence - drop once the listing has aged this
--                                 many days since creation or the last drop
--     original_price              price at the FIRST drop; never overwritten
--                                 (prevents compounding across runs)
--     markdown_drop_count         cycle N targets original_price * (1 - N*pct/100)
--     min_price                   hard per-listing floor; null = no floor
--     markdown_started_at         manual schedule basis; null = count from
--                                 the listing's created_at
--   last_synced_at / created_at / updated_at   ms timestamps from the extension

CREATE TABLE public.listings (
  id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL DEFAULT 'vinted' CHECK (platform IN ('depop', 'vinted')),
  platform_listing_id TEXT NOT NULL,
  platform_user_id TEXT,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'GBP',
  photos TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'unknown'
    CONSTRAINT listings_status_check
    CHECK (status IN ('active', 'sold', 'reserved', 'draft', 'hidden', 'delayed', 'unknown')),
  brand TEXT,
  size TEXT,
  condition TEXT,
  colour TEXT,
  category TEXT,
  likes INTEGER,
  views INTEGER,
  url TEXT NOT NULL,
  offers INTEGER,
  messages INTEGER,
  earnings NUMERIC(10,2),
  shipping TEXT,
  buyer_info JSONB,
  promotion JSONB,
  enriched_data JSONB,
  enriched_at BIGINT,
  link_id TEXT,
  restock_enabled BOOLEAN NOT NULL DEFAULT false,
  restock_quantity INTEGER NOT NULL DEFAULT 0,
  markdown_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  markdown_percent NUMERIC,
  markdown_interval_days NUMERIC,
  original_price NUMERIC,
  last_markdown_at BIGINT,
  markdown_drop_count INTEGER NOT NULL DEFAULT 0,
  min_price NUMERIC,
  markdown_started_at TIMESTAMPTZ,
  last_synced_at BIGINT NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL DEFAULT 0,
  updated_at BIGINT NOT NULL DEFAULT 0,
  cloud_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, id)
);

-- Deliberately NO index on (user_id, platform_user_id) - it was dropped in the
-- original migration 007 and never restored.
CREATE INDEX idx_listings_platform ON public.listings(user_id, platform);
CREATE INDEX idx_listings_status ON public.listings(user_id, platform, status);
CREATE INDEX idx_listings_cloud_updated ON public.listings(user_id, cloud_updated_at);
CREATE INDEX idx_listings_restock_enabled
  ON public.listings(user_id)
  WHERE restock_enabled = true;
CREATE INDEX idx_listings_link_id
  ON public.listings(user_id, link_id)
  WHERE link_id IS NOT NULL;

-- Auto-update cloud_updated_at on every write
CREATE OR REPLACE FUNCTION update_cloud_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.cloud_updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER listings_cloud_timestamp
  BEFORE INSERT OR UPDATE ON public.listings
  FOR EACH ROW EXECUTE FUNCTION update_cloud_timestamp();

-- =============================================================================
-- 2. platform_credentials - encrypted client-side
-- =============================================================================

CREATE TABLE public.platform_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('depop', 'vinted')),
  encrypted_data TEXT NOT NULL,
  iv TEXT NOT NULL,
  salt TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, platform)
);

-- =============================================================================
-- 3. user_settings
-- =============================================================================

CREATE TABLE public.user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  delay INTEGER NOT NULL DEFAULT 7,
  max_count INTEGER NOT NULL DEFAULT 70,
  preferences JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- 4. linked_accounts - ties Depop/Vinted accounts to the cloud user
-- =============================================================================
-- Enables mismatch detection and hard-blocks operations on wrong accounts.

CREATE TABLE public.linked_accounts (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('depop', 'vinted')),
  platform_user_id TEXT NOT NULL,
  platform_username TEXT,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, platform)
);

-- =============================================================================
-- 5. Row Level Security
-- =============================================================================

ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.linked_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own listings"
  ON public.listings FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users access own credentials"
  ON public.platform_credentials FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users access own settings"
  ON public.user_settings FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users access own linked accounts"
  ON public.linked_accounts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
