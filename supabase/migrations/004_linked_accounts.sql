-- Platform account linking — ties Depop/Vinted accounts to the cloud user
-- Enables mismatch detection and hard-blocks operations on wrong accounts

-- ── Linked accounts ─────────────────────────────────────────────────────────

CREATE TABLE public.linked_accounts (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('depop', 'vinted')),
  platform_user_id TEXT NOT NULL,
  platform_username TEXT,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, platform)
);

ALTER TABLE public.linked_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own linked accounts"
  ON public.linked_accounts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── Track which platform account each listing came from ─────────────────────

ALTER TABLE public.listings ADD COLUMN platform_user_id TEXT;
CREATE INDEX idx_listings_platform_user ON public.listings(user_id, platform_user_id);
