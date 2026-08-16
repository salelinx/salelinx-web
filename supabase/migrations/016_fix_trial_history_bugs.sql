-- Two bugs in 014's trial-history enforcement, found in post-deploy audit.
--
-- Bug 1 (billing-breaking): platform_account_hash() called digest()
-- unqualified. On Supabase, pgcrypto lives in the `extensions` schema, and
-- the SECURITY DEFINER trigger functions pin search_path = public - so the
-- moment any trigger fired (i.e. the FIRST new subscription written by the
-- Stripe webhook, or the first account link by a billed user), it would
-- raise "function digest(text, unknown) does not exist" and fail the whole
-- INSERT. Confirmed by running the function under a pinned search_path.
-- Fix: schema-qualify extensions.digest and pin the function's own
-- search_path (empty - pg_catalog is always implicitly searched, and the
-- one non-catalog reference is now fully qualified).
--
-- Bug 2 (enforcement bypass): the extension's linkAccount() writes via
-- UPSERT ... ON CONFLICT (user_id, platform) DO UPDATE. Re-linking a
-- DIFFERENT platform account onto an existing row takes the UPDATE path,
-- which the BEFORE INSERT trigger never saw - a farmer could link a fresh
-- Depop account, start the trial, then overwrite the link with their real,
-- already-trialed account. Fix: fire on INSERT OR UPDATE, with a no-op
-- guard for updates that don't change the platform identity (e.g. username
-- refreshes on re-link of the same account).

-- =============================================================================
-- 1. platform_account_hash: qualify the pgcrypto call
-- =============================================================================
-- CREATE OR REPLACE keeps the OID, so the existing trigger functions and
-- has_trialed_platform_account() pick this up with no further changes.

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

-- =============================================================================
-- 2. Link enforcement: cover the UPSERT's UPDATE path
-- =============================================================================

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

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_trial_history_on_link ON public.linked_accounts;

CREATE TRIGGER trg_enforce_trial_history_on_link
  BEFORE INSERT OR UPDATE ON public.linked_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_and_record_trial_history_on_link();
