-- Referral program: share links, claims, conversions, rewards.
--
-- Every user gets a share code (salelinx.com/r/CODE). A new signup that
-- arrives with a referral cookie claims it in the auth callback via
-- claim_referral(). The Stripe webhook flips the row to 'converted' on the
-- referee's first PAID invoice (amount_paid > 0 - trials do not convert).
-- The process-referral-rewards Edge Function grants the referrer one free
-- month (a negative Stripe customer-balance transaction) 7 days later.
-- See docs/REFERRALS.md for the full flow.
--
-- State machine (referrals.status):
--   pending    claimed at signup, referee has not paid yet
--   converted  first paid invoice seen; reward held for the refund window
--   rewarding  grant in flight (claimed by a reward-job run; crash recovery
--              re-enters via rewarding_claimed_at older than 1 hour)
--   rewarded   Stripe credit granted (stripe_balance_txn_id is the receipt)
--   void       referee lapsed before the hold ended, or reward expired
--              unclaimable (referrer had no subscription for 90 days)
--
-- Guardrails:
--   * One referral per referee, ever (referee_id UNIQUE).
--   * claim_referral() returns FALSE instead of raising on every guard
--     (self-referral, stale account, duplicate, unknown code) - it runs
--     inside the auth callback and must never break login.
--   * Referees get NO SELECT policy on referrals: a policy scoped to
--     referee_id would expose referrer_id (another user's UUID). The
--     referee-side read surface is has_pending_referral(), a boolean.
--   * Both FKs cascade from auth.users - required by the account deletion
--     runbook (docs/GDPR.md). Granted Stripe credits survive deletion of
--     the referee; they are the referrer's money.

-- =============================================================================
-- 1. referral_codes - one share code per user, created lazily
-- =============================================================================

CREATE TABLE public.referral_codes (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  -- 8 chars, ambiguity-free alphabet (no 0/O/1/I/L)
  code TEXT NOT NULL UNIQUE CHECK (code ~ '^[A-HJ-NP-Z2-9]{8}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;

-- Users read their own code; all writes go through get_or_create_referral_code()
CREATE POLICY "referral_codes own read"
  ON public.referral_codes FOR SELECT
  USING (auth.uid() = user_id);

-- =============================================================================
-- 2. referrals - one row per referred signup
-- =============================================================================

CREATE TABLE public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referee_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'converted', 'rewarding', 'rewarded', 'void')),
  -- Reward receipt, filled by process-referral-rewards
  reward_amount_cents INTEGER,
  reward_currency TEXT,
  stripe_balance_txn_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  converted_at TIMESTAMPTZ,
  rewarding_claimed_at TIMESTAMPTZ,
  rewarded_at TIMESTAMPTZ
);

CREATE INDEX idx_referrals_referrer ON public.referrals (referrer_id);
-- The reward job only ever scans in-flight rows
CREATE INDEX idx_referrals_working ON public.referrals (status)
  WHERE status IN ('pending', 'converted', 'rewarding');

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- Referrers see their own referrals (the /account card). Referees do NOT get
-- a policy - see header. Writes are service-role / SECURITY DEFINER only.
CREATE POLICY "referrals referrer read"
  ON public.referrals FOR SELECT
  USING (auth.uid() = referrer_id);

-- =============================================================================
-- 3. get_or_create_referral_code() - lazy code creation, collision-safe
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_or_create_referral_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_alphabet CONSTANT TEXT := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code TEXT;
  v_attempt INTEGER := 0;
  v_i INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT rc.code INTO v_code
  FROM public.referral_codes rc
  WHERE rc.user_id = v_user_id;
  IF FOUND THEN
    RETURN v_code;
  END IF;

  -- Codes are shared publicly, so random() is fine here; uniqueness is what
  -- matters and the UNIQUE constraint + retry loop guarantees it.
  LOOP
    v_attempt := v_attempt + 1;
    v_code := '';
    FOR v_i IN 1..8 LOOP
      v_code := v_code
        || substr(v_alphabet, 1 + floor(random() * 31)::INTEGER, 1);
    END LOOP;

    BEGIN
      INSERT INTO public.referral_codes (user_id, code)
      VALUES (v_user_id, v_code);
      RETURN v_code;
    EXCEPTION
      WHEN unique_violation THEN
        -- Either the code collided (retry) or a concurrent call inserted a
        -- row for this user (return it).
        SELECT rc.code INTO v_code
        FROM public.referral_codes rc
        WHERE rc.user_id = v_user_id;
        IF FOUND THEN
          RETURN v_code;
        END IF;
        IF v_attempt >= 5 THEN
          RAISE EXCEPTION 'could not allocate a referral code';
        END IF;
    END;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.get_or_create_referral_code() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_or_create_referral_code() TO authenticated;

-- =============================================================================
-- 4. claim_referral(p_code) - called from the auth callback after signup
-- =============================================================================

CREATE OR REPLACE FUNCTION public.claim_referral(p_code TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_code TEXT;
  v_referrer_id UUID;
  v_account_created TIMESTAMPTZ;
BEGIN
  -- Every guard returns FALSE, never raises: the caller is the auth callback
  -- and a failed claim must never break sign-in.
  IF v_user_id IS NULL OR p_code IS NULL THEN
    RETURN FALSE;
  END IF;

  v_code := upper(trim(p_code));
  IF v_code !~ '^[A-HJ-NP-Z2-9]{8}$' THEN
    RETURN FALSE;
  END IF;

  SELECT rc.user_id INTO v_referrer_id
  FROM public.referral_codes rc
  WHERE rc.code = v_code;
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- No self-referral
  IF v_referrer_id = v_user_id THEN
    RETURN FALSE;
  END IF;

  -- Only genuinely new accounts count: the callback also fires for password
  -- reset and email change, and cookies can outlive the signup by weeks.
  SELECT u.created_at INTO v_account_created
  FROM auth.users u
  WHERE u.id = v_user_id;
  IF v_account_created IS NULL OR v_account_created < NOW() - INTERVAL '48 hours' THEN
    RETURN FALSE;
  END IF;

  BEGIN
    INSERT INTO public.referrals (referrer_id, referee_id, code)
    VALUES (v_referrer_id, v_user_id, v_code);
  EXCEPTION
    WHEN unique_violation THEN
      -- Already claimed (callback replay) - idempotent no-op
      RETURN FALSE;
  END;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_referral(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_referral(TEXT) TO authenticated;

-- =============================================================================
-- 5. has_pending_referral() - the referee-side read surface (a boolean only)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.has_pending_referral()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.referrals r
    WHERE r.referee_id = auth.uid() AND r.status = 'pending'
  );
$$;

REVOKE ALL ON FUNCTION public.has_pending_referral() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_pending_referral() TO authenticated;
