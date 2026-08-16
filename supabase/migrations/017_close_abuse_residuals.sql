-- Close residual abuse vectors an adversarial audit found after 014-016:
--   1. Trial farming via unlink-before-checkout: the platform-account trial
--      gate only saw CURRENTLY-linked accounts, so unlinking (or linking only
--      after the trial started) evaded it. Fix: remember every platform
--      account a user has EVER linked, and gate against that history.
--   2. Unbounded row flooding on listings and linked_accounts (RLS allowed
--      inserts with no per-user volume cap).
--
-- Layered on top of 016_fix_trial_history_bugs.sql: this migration PRESERVES
-- that migration's fixes (extensions.digest with search_path='', and the
-- INSERT OR UPDATE trigger with the same-identity no-op guard). The link
-- trigger function is re-created here to ALSO record link history; every line
-- of 016's logic is retained.

-- =============================================================================
-- 1. Permanent link history -> defeats unlink-before-checkout trial farming
-- =============================================================================
-- linked_accounts rows vanish on unlink and on account deletion, so trial
-- eligibility computed from them is evadable. link_history is append-only and
-- keyed to the user, recording every (user, platform account) pair ever seen.
-- Stores the same salted hash as trial_history (nothing identifiable) and,
-- like trial_history, deliberately has NO FK to auth.users so it survives
-- account deletion - otherwise deleting the throwaway account would erase the
-- evidence and reopen the loop.

CREATE TABLE public.link_history (
  user_id UUID NOT NULL,
  platform_account_hash TEXT NOT NULL,
  first_linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, platform_account_hash)
);

CREATE INDEX idx_link_history_hash ON public.link_history(platform_account_hash);

-- RLS on, no client policies: only the SECURITY DEFINER functions below and
-- the service role touch it.
ALTER TABLE public.link_history ENABLE ROW LEVEL SECURITY;

-- Re-create the link trigger function to also append to link_history.
-- IDENTICAL to 016's version except for the final INSERT into link_history:
--   * keeps SET search_path = public
--   * keeps the TG_OP = 'UPDATE' same-identity no-op guard (UPSERT path)
--   * keeps platform_account_hash() (which 016 fixed to use extensions.digest)
--   * keeps the trial-only rejection and the billing tombstone write
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

  IF v_trial_only AND EXISTS (
    SELECT 1 FROM trial_history th WHERE th.platform_account_hash = v_hash
  ) THEN
    RAISE EXCEPTION 'platform_account_already_trialed'
      USING HINT = 'This platform account has already used a free trial on another SaleLinx account.';
  END IF;

  IF v_has_billing THEN
    INSERT INTO trial_history (platform_account_hash)
    VALUES (v_hash)
    ON CONFLICT (platform_account_hash) DO NOTHING;
  END IF;

  -- Append-only link history, independent of billing state. This is the
  -- only addition over 016's function body.
  INSERT INTO link_history (user_id, platform_account_hash)
  VALUES (NEW.user_id, v_hash)
  ON CONFLICT (user_id, platform_account_hash) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Trigger definition unchanged from 016 (INSERT OR UPDATE); the function
-- above is picked up by CREATE OR REPLACE without touching the trigger.

-- Backfill history from whatever is linked right now (best effort for
-- existing users; farmers who already unlinked are not recoverable, but the
-- loop is closed going forward).
INSERT INTO public.link_history (user_id, platform_account_hash)
SELECT la.user_id, platform_account_hash(la.platform, la.platform_user_id)
FROM public.linked_accounts la
ON CONFLICT (user_id, platform_account_hash) DO NOTHING;

-- Gate now checks EVER-linked accounts, not just current ones. auth.uid()
-- scoped, so a caller only learns about their own history.
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

REVOKE ALL ON FUNCTION public.has_trialed_platform_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_trialed_platform_account() TO authenticated;

-- =============================================================================
-- 2. Per-user row-count caps on listings and linked_accounts
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

CREATE TRIGGER trg_enforce_linked_accounts_row_cap
  BEFORE INSERT ON public.linked_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_linked_accounts_row_cap();
