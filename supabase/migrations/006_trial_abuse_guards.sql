-- Trial-farming and row-flooding safeguards.
--
-- Consolidated baseline (September 2026). This file is the net result of the
-- original migrations 014 (trial history + link-time enforcement), 016
-- (pgcrypto schema-qualification fix + UPSERT path coverage), 017 (permanent
-- link history + row caps), 023 (same-user re-link false-positive fix) and
-- the 024 grant hygiene that applied to these functions. Full history in git.
--
-- The problem (trial farming): trial eligibility lives on the Supabase
-- user_id, but user accounts are free to mint - a farmer signs up with a
-- throwaway email, runs the trial, then repeats with a fresh email while
-- linking the SAME Depop/Vinted account every time. Platform accounts are the
-- expensive, scarce identity (phone verification, sales history), so trial
-- history sticks to THEM, not to the email:
--
--   * trial_history: permanent tombstones (salted hash of platform identity)
--     recording that a platform account has been attached to a billed user.
--     Deliberately NOT keyed to auth.users so it survives account deletion -
--     GDPR-wise it stores no identifiable data, only a keyed hash.
--   * link_history: append-only record of every (user, platform account) pair
--     ever seen, so unlink-before-checkout cannot evade the gate. Also no FK
--     to auth.users, or deleting the throwaway account would erase the
--     evidence and reopen the loop.
--   * Triggers cover both orderings (subscribe-then-link and
--     link-then-subscribe) plus the extension's UPSERT UPDATE path, and
--     REJECT a link when the platform account already burned a trial and the
--     linking user is trial-only - UNLESS this same account has linked this
--     same shop before (an innocent unlink + re-link of their own shop).
--   * has_trialed_platform_account(): checkout-time gate used by
--     create-checkout-session, checked against EVER-linked accounts.

-- =============================================================================
-- 0. pgcrypto for digest() (preinstalled in `extensions` on Supabase)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =============================================================================
-- 1. platform_account_hash()
-- =============================================================================
-- extensions.digest is schema-qualified and search_path pinned empty (original
-- 016): on Supabase pgcrypto lives in `extensions`, and the SECURITY DEFINER
-- callers pin search_path = public, so an unqualified digest() raised at the
-- first trigger firing.

CREATE OR REPLACE FUNCTION public.platform_account_hash(
  p_platform TEXT,
  p_platform_user_id TEXT
)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
SET search_path = ''
AS $$
  SELECT encode(extensions.digest('slx-trial:' || p_platform || ':' || p_platform_user_id, 'sha256'), 'hex');
$$;

-- Deliberately NOT revoked from anyone (original 024): it is not SECURITY
-- DEFINER and discloses nothing on its own.

-- =============================================================================
-- 2. trial_history + link_history
-- =============================================================================

CREATE TABLE public.trial_history (
  platform_account_hash TEXT PRIMARY KEY,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS on, zero client policies: only the service role and the SECURITY
-- DEFINER functions below touch it.
ALTER TABLE public.trial_history ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.link_history (
  user_id UUID NOT NULL,
  platform_account_hash TEXT NOT NULL,
  first_linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, platform_account_hash)
);

CREATE INDEX idx_link_history_hash ON public.link_history(platform_account_hash);

ALTER TABLE public.link_history ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 3. Tombstone writers + link-time enforcement
-- =============================================================================

-- (a) User subscribes (trial or paid): tombstone every platform account they
--     have linked at that moment. Covers the link-first-then-subscribe order.
CREATE OR REPLACE FUNCTION public.record_trial_history_on_subscription()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO trial_history (platform_account_hash)
  SELECT platform_account_hash(la.platform, la.platform_user_id)
  FROM linked_accounts la
  WHERE la.user_id = NEW.user_id
  ON CONFLICT (platform_account_hash) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_trial_history_on_subscription() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_record_trial_history_on_subscription
  AFTER INSERT ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.record_trial_history_on_subscription();

-- (b) User links a platform account (INSERT, or the UPSERT's UPDATE path when
--     the platform identity changes): record link history, tombstone when the
--     user has billing history, and reject the farmer's exact move - a
--     trial-only account linking an already-trialed shop it has never linked
--     before. Final form after originals 016 (UPDATE coverage), 017 (link
--     history) and 023 (own-footprint exemption).
CREATE OR REPLACE FUNCTION public.enforce_and_record_trial_history_on_link()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash TEXT;
  v_has_billing BOOLEAN;
  v_trial_only BOOLEAN;
BEGIN
  -- Same-identity updates (username refresh, linked_at touch) are not a
  -- re-link; skip so routine upserts stay cheap and can never be blocked.
  IF TG_OP = 'UPDATE'
     AND OLD.platform_user_id = NEW.platform_user_id
     AND OLD.platform = NEW.platform THEN
    RETURN NEW;
  END IF;

  v_hash := platform_account_hash(NEW.platform, NEW.platform_user_id);

  SELECT
    EXISTS (SELECT 1 FROM subscriptions s WHERE s.user_id = NEW.user_id),
    EXISTS (SELECT 1 FROM subscriptions s WHERE s.user_id = NEW.user_id AND s.status = 'trialing')
      AND NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.user_id = NEW.user_id AND s.status = 'active')
  INTO v_has_billing, v_trial_only;

  -- Reject a trial-only account linking an already-trialed shop, UNLESS this
  -- same account has linked this same shop before (an innocent re-link of
  -- their own shop, e.g. unlink + re-link during their own trial).
  IF v_trial_only
     AND EXISTS (
       SELECT 1 FROM trial_history th WHERE th.platform_account_hash = v_hash
     )
     AND NOT EXISTS (
       SELECT 1 FROM link_history lh
       WHERE lh.user_id = NEW.user_id
         AND lh.platform_account_hash = v_hash
     ) THEN
    RAISE EXCEPTION 'platform_account_already_trialed'
      USING HINT = 'This platform account has already used a free trial on another SaleLinx account.';
  END IF;

  IF v_has_billing THEN
    INSERT INTO trial_history (platform_account_hash)
    VALUES (v_hash)
    ON CONFLICT (platform_account_hash) DO NOTHING;
  END IF;

  -- Append-only link history, independent of billing state.
  INSERT INTO link_history (user_id, platform_account_hash)
  VALUES (NEW.user_id, v_hash)
  ON CONFLICT (user_id, platform_account_hash) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_and_record_trial_history_on_link() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_enforce_trial_history_on_link
  BEFORE INSERT OR UPDATE ON public.linked_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_and_record_trial_history_on_link();

-- =============================================================================
-- 4. Checkout-time check for create-checkout-session
-- =============================================================================
-- Gates on EVER-linked accounts (link_history), not just current ones, so
-- unlink-before-checkout does not evade it (original 017). auth.uid() scoped,
-- so a caller only learns about their own history.

CREATE OR REPLACE FUNCTION public.has_trialed_platform_account()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM link_history lh
    JOIN trial_history th
      ON th.platform_account_hash = lh.platform_account_hash
    WHERE lh.user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.has_trialed_platform_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_trialed_platform_account() TO authenticated;

-- =============================================================================
-- 5. Per-user row-count caps on listings and linked_accounts (original 017)
-- =============================================================================
-- RLS lets a user insert their own rows with no volume bound, so a stolen or
-- scripted session could flood these tables. Caps are far above any real
-- catalogue (a power seller lists thousands, not 100k) and above the platform
-- accounts anyone legitimately links.

CREATE OR REPLACE FUNCTION public.enforce_listings_row_cap()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (
    SELECT count(*) FROM listings WHERE user_id = NEW.user_id
  ) >= 100000 THEN
    RAISE EXCEPTION 'listing_row_limit'
      USING HINT = 'This account has reached the maximum number of synced listings.';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_listings_row_cap() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_enforce_listings_row_cap
  BEFORE INSERT ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_listings_row_cap();

CREATE OR REPLACE FUNCTION public.enforce_linked_accounts_row_cap()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (
    SELECT count(*) FROM linked_accounts WHERE user_id = NEW.user_id
  ) >= 50 THEN
    RAISE EXCEPTION 'linked_account_row_limit'
      USING HINT = 'This account has reached the maximum number of linked marketplace accounts.';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_linked_accounts_row_cap() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_enforce_linked_accounts_row_cap
  BEFORE INSERT ON public.linked_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_linked_accounts_row_cap();
