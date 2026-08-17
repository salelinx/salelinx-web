-- Fix a false positive in the trial-farming link guard (found on launch day
-- by hitting it with a legitimate flow).
--
-- The bug: a user on their own free trial links their shop (which tombstones
-- it in trial_history), unlinks, then re-links the SAME shop on the SAME
-- account. The trigger only asked "is the linker trial-only?" and "is the
-- shop tombstoned?", never "who created the tombstone?" - so the user was
-- blocked by their own footprint with platform_account_already_trialed.
-- Any real customer who unlinks and re-links mid-trial hits this.
--
-- The fix: exempt the re-link when link_history already records this exact
-- (user, platform account) pair. That table is append-only and survives
-- unlink, so a genuine re-link always has a row there.
--
-- Why this does not reopen the farming loop:
--   * A farmer's fresh account has NO link_history row for the shop, so the
--     rejection still fires exactly as before.
--   * An account that linked the shop while free (creating link_history but
--     no tombstone) can never later start a trial once the shop is
--     tombstoned: has_trialed_platform_account() gates checkout on
--     link_history x trial_history (migration 017), so the trial itself is
--     denied. The exemption therefore only ever fires for an account whose
--     trial predates or coexists with its own link - re-linking grants it
--     nothing it does not already have.
--
-- Layered on top of 017_close_abuse_residuals.sql: every line of that
-- version is retained (UPDATE no-op guard, tombstone write, link_history
-- append). The only change is the added NOT EXISTS clause on the rejection.

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

-- Trigger definition unchanged from 016 (INSERT OR UPDATE); CREATE OR
-- REPLACE swaps the function body in place.
