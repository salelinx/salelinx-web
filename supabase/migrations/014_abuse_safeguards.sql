-- Abuse safeguards: trial farming via platform accounts + support ticket spam.
--
-- Problem 1 (trial farming): trial eligibility lives on the Supabase user_id
-- (create-checkout-session: any prior subscriptions row burns it). But user
-- accounts are free to mint - a farmer signs up with a throwaway email, runs
-- the 7-day trial, then repeats with a fresh email while linking the SAME
-- Depop/Vinted account every time. Platform accounts are the expensive,
-- scarce identity here (phone verification, sales history), so trial history
-- must stick to THEM, not to the email.
--
-- Problem 2 (ticket spam): support_tickets INSERT was gated only on
-- auth.uid() = user_id, so any throwaway account could file unlimited
-- tickets, each fanning out to two Resend emails (staff notify + auto-ack).
--
-- What this migration adds:
--   1. One platform account, one SaleLinx account: UNIQUE(platform,
--      platform_user_id) on linked_accounts.
--   2. trial_history: permanent tombstones (salted hash of platform identity)
--      recording that a platform account has been attached to a billed user.
--      Deliberately NOT keyed to auth.users so it survives account deletion -
--      GDPR-wise it stores no identifiable data, only a keyed hash.
--   3. Triggers that write tombstones on both orderings (subscribe-then-link
--      and link-then-subscribe) and REJECT a link when the platform account
--      already burned a trial and the linking user is on a trial themselves.
--   4. has_trialed_platform_account(): checkout-time check used by
--      create-checkout-session to deny a new trial to any user whose linked
--      platform accounts already consumed one.
--   5. Rate limits on support_tickets: max 3 open, max 5 per rolling 24h.

-- =============================================================================
-- 0. pgcrypto for digest() (already present on most Supabase projects)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =============================================================================
-- 1. Deduplicate, then enforce one platform account per SaleLinx account
-- =============================================================================
-- Keep the earliest link when the same platform account is linked to several
-- users (tie-broken by user_id so the delete is deterministic).

DELETE FROM public.linked_accounts a
USING public.linked_accounts b
WHERE a.platform = b.platform
  AND a.platform_user_id = b.platform_user_id
  AND (a.linked_at, a.user_id) > (b.linked_at, b.user_id);

CREATE UNIQUE INDEX linked_accounts_platform_identity_key
  ON public.linked_accounts (platform, platform_user_id);

-- =============================================================================
-- 2. trial_history - platform accounts that have been through billing
-- =============================================================================
-- No FK to auth.users on purpose: rows must outlive the accounts that created
-- them, or deleting the account (GDPR self-serve or admin) would reset trial
-- eligibility. Stores only a hash so the table holds nothing identifiable.

CREATE TABLE public.trial_history (
  platform_account_hash TEXT PRIMARY KEY,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS on, zero client policies: only the service role and the SECURITY
-- DEFINER functions below touch it.
ALTER TABLE public.trial_history ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.platform_account_hash(
  p_platform TEXT,
  p_platform_user_id TEXT
)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT encode(digest('slx-trial:' || p_platform || ':' || p_platform_user_id, 'sha256'), 'hex');
$$;

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

CREATE TRIGGER trg_record_trial_history_on_subscription
  AFTER INSERT ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.record_trial_history_on_subscription();

-- (b) User links a platform account: if they already have billing history,
--     tombstone the account (covers the subscribe-first-then-link order,
--     which is the normal gate order in the extension). And if the account
--     being linked ALREADY burned a trial elsewhere while this user is
--     trial-only, reject the link - that is the farmer's exact move.
--     "Trial-only" = has a trialing row and has never had an active one, so
--     paying customers and lapsed-paid users are never blocked from linking.
CREATE OR REPLACE FUNCTION public.enforce_and_record_trial_history_on_link()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash TEXT := platform_account_hash(NEW.platform, NEW.platform_user_id);
  v_has_billing BOOLEAN;
  v_trial_only BOOLEAN;
BEGIN
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

CREATE TRIGGER trg_enforce_trial_history_on_link
  BEFORE INSERT ON public.linked_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_and_record_trial_history_on_link();

-- =============================================================================
-- 4. Checkout-time check for create-checkout-session
-- =============================================================================
-- SECURITY DEFINER because trial_history has no client policies; scoped to
-- auth.uid() so a caller can only ever learn about their own links.

CREATE OR REPLACE FUNCTION public.has_trialed_platform_account()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM linked_accounts la
    JOIN trial_history th
      ON th.platform_account_hash = platform_account_hash(la.platform, la.platform_user_id)
    WHERE la.user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.has_trialed_platform_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_trialed_platform_account() TO authenticated;

-- =============================================================================
-- 5. Support ticket rate limits
-- =============================================================================
-- Server-side, so neither the website form nor a bot with a stolen JWT can
-- bypass it. Limits chosen loose enough that a real user never notices:
-- 3 concurrently-open tickets, 5 created per rolling 24 hours.

CREATE OR REPLACE FUNCTION public.enforce_support_ticket_limits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (
    SELECT count(*) FROM support_tickets
    WHERE user_id = NEW.user_id AND created_at > now() - interval '24 hours'
  ) >= 5 THEN
    RAISE EXCEPTION 'support_ticket_daily_limit'
      USING HINT = 'You can open at most 5 tickets in 24 hours.';
  END IF;

  IF (
    SELECT count(*) FROM support_tickets
    WHERE user_id = NEW.user_id AND status = 'open'
  ) >= 3 THEN
    RAISE EXCEPTION 'support_ticket_open_limit'
      USING HINT = 'Please wait for a reply on your open tickets before opening another.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_support_ticket_limits
  BEFORE INSERT ON public.support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_support_ticket_limits();
