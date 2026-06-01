-- Initial schema for Resale Bot cloud database
-- Run this in Supabase SQL Editor or via supabase db push

-- ── Listings (synced from local IndexedDB) ───────────────────────────────────

CREATE TABLE public.listings (
  id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('depop', 'vinted')),
  platform_listing_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'GBP',
  photos TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'unknown'
    CHECK (status IN ('active', 'sold', 'reserved', 'draft', 'unknown')),
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
  last_synced_at BIGINT NOT NULL,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  cloud_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, id)
);

CREATE INDEX idx_listings_platform ON public.listings(user_id, platform);
CREATE INDEX idx_listings_status ON public.listings(user_id, platform, status);
CREATE INDEX idx_listings_cloud_updated ON public.listings(user_id, cloud_updated_at);

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

-- ── Platform credentials (encrypted client-side) ────────────────────────────

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

-- ── User settings ────────────────────────────────────────────────────────────

CREATE TABLE public.user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  delay INTEGER NOT NULL DEFAULT 7,
  max_count INTEGER NOT NULL DEFAULT 70,
  preferences JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Row Level Security ───────────────────────────────────────────────────────

ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

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
