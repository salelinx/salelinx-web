-- Referral program: share links, claims, conversions, rewards, leaderboard.
--
-- Consolidated baseline (September 2026). This file is the net result of the
-- original migrations 010 (schema + claim flow), 020 + 021 (leaderboard, with
-- the email-derived fallback removed), 029 (self-chosen display name with
-- moderation), 024 + 040 (grant hygiene). Full history in git.
--
-- Every user gets a share code (salelinx.com/r/CODE). A new signup that
-- arrives with a referral cookie claims it via claim_referral(). The Stripe
-- webhook flips the row to 'converted' on the referee's first PAID invoice
-- (amount_paid > 0 - trials do not convert). The process-referral-rewards
-- Edge Function grants the referrer one free month (a negative Stripe
-- customer-balance transaction) 7 days later. See docs/REFERRALS.md.
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Optional self-chosen leaderboard name (original 029; last in the column
  -- order because it was ADDed to the live table), moderated by
  -- referral_display_name_problem() below.
  display_name TEXT
    CONSTRAINT referral_codes_display_name_shape CHECK (
      display_name IS NULL
      OR (
        char_length(display_name) BETWEEN 3 AND 20
        -- ASCII letters/digits plus space, dot, underscore, hyphen. Anything
        -- outside this (emoji, RTL overrides, homoglyphs, zero-width joiners)
        -- never reaches the wordlist because it cannot be stored.
        AND display_name ~ '^[A-Za-z0-9 ._-]+$'
        -- At least one letter: "..." and "123" are not names.
        AND display_name ~ '[A-Za-z]'
        -- No leading, trailing or doubled spaces. The trigger normalises these
        -- away; the constraint stops a direct write reintroducing them.
        AND display_name !~ '^\s'
        AND display_name !~ '\s$'
        AND display_name !~ '\s\s'
      )
    )
);

-- One name per person, case-insensitively. On a leaderboard, being able to
-- take the name of the person above you is the whole impersonation problem.
CREATE UNIQUE INDEX referral_codes_display_name_unique
  ON public.referral_codes (lower(display_name))
  WHERE display_name IS NOT NULL;

COMMENT ON COLUMN public.referral_codes.display_name IS
  'Optional self-chosen leaderboard name. NULL falls back to shop username, then Seller #<rank>. Moderated by referral_display_name_problem().';

ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;

-- Users read their own code; all writes go through the RPCs below.
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

REVOKE ALL ON FUNCTION public.get_or_create_referral_code() FROM PUBLIC, anon;
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

REVOKE ALL ON FUNCTION public.claim_referral(TEXT) FROM PUBLIC, anon;
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

REVOKE ALL ON FUNCTION public.has_pending_referral() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_pending_referral() TO authenticated;

-- =============================================================================
-- 6. Display-name moderation (original 029)
-- =============================================================================
-- Moderation lives HERE, not in the extension. The panel validates too, but
-- only for instant feedback, since a client check is a suggestion: anyone with
-- their own access token can call the API directly. Four layers:
--
--   1. CHECK constraint (on the table above). Shape only: length plus an
--      ASCII-only charset, which blocks Cyrillic/Greek homoglyphs no wordlist
--      can catch.
--   2. BEFORE trigger. Normalises, then runs the wordlist on every write path,
--      so a future INSERT/UPDATE RLS policy cannot open a side door round the
--      RPC.
--   3. set_referral_display_name() RPC. The surface the app calls. Returns a
--      structured {ok,error} rather than raising.
--   4. admin_clear_referral_display_name() RPC. No wordlist is complete; an
--      admin blanks anything that gets through and the row falls back to the
--      derived name.

-- Returns NULL when the name is acceptable, else a stable error code the UI
-- maps to a message: too_short / too_long / bad_chars / no_letters /
-- blocked_word / impersonation.
--
-- Matching runs against a normalised copy: lowercased, leetspeak folded
-- (4 to a, 3 to e, 0 to o, 1 to i, $ to s and so on), then everything that is
-- not a letter stripped, so "f.u.c.k", "5h1t" and "b_i_t_c_h" all collapse
-- onto the plain word.
--
-- Three lists, because one matching rule cannot serve all terms. Substring
-- matching is right for long unambiguous words and wrong for short ones: the
-- Scunthorpe problem, where a substring rule for "ass" rejects Cassie, class
-- and bass. See each list for which rule it gets and why.
CREATE OR REPLACE FUNCTION public.referral_display_name_problem(p_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_trimmed  TEXT;
  v_flat     TEXT;
  v_words    TEXT[];
  v_word     TEXT;
  v_term     TEXT;
  v_exempt   BOOLEAN;
  v_ok       TEXT;
  -- Rule 1, match anywhere. These have no common innocent embedding. "cunt"
  -- is the known cost: it rejects Scunthorpe. That is the deliberate trade,
  -- a rare false reject the user recovers from by picking another name, in
  -- exchange for catching every xCUNTx style evasion.
  v_substrings TEXT[] := ARRAY[
    'fuck', 'shit', 'cunt', 'bitch', 'bastard', 'wanker', 'whore', 'slut',
    'penis', 'vagina', 'pussy', 'porn', 'molest', 'paedo',
    'nigger', 'nigga', 'faggot', 'retard', 'tranny', 'chink', 'spastic',
    'hitler', 'nazi', 'killyourself'
  ];
  -- Rule 2, whole word only. Each of these is a substring of an ordinary
  -- word, so a substring rule here is the Scunthorpe problem in miniature:
  -- "anal" rejects canal and analysis, "coon" raccoon, "rapist" therapist,
  -- "sex" Sussex, "ass" Cassie, "kike" the name Kikelomo, "rape" grape.
  v_words_blocked TEXT[] := ARRAY[
    'ass', 'arse', 'tit', 'tits', 'twat', 'prick', 'wank', 'jizz', 'cum',
    'sex', 'xxx', 'nsfw', 'anal', 'coon', 'rape', 'rapist',
    'pedo', 'kike', 'paki', 'nonce', 'kys', 'fag', 'dyke', 'hoe',
    'team', 'mod', 'mods'
  ];
  -- Rule 3, inside a word but exempted by the allowlist below. Whole-word
  -- matching alone let "BigD1ck" through (one word, "bigdick", which equals
  -- nothing in the list), while substring matching alone rejects Dickinson
  -- and cocktail. The allowlist is short because the innocent words carrying
  -- these two are countable, which is exactly why they get this rule and
  -- "ass" does not: no list could hold every name containing it.
  v_compound TEXT[] := ARRAY['dick', 'cock'];
  v_compound_ok TEXT[] := ARRAY[
    'dickens', 'dickinson', 'dickie', 'dicky', 'benedick',
    'cocktail', 'cockburn', 'cockney', 'cockpit', 'cockle', 'cocker',
    'peacock', 'hancock', 'woodcock', 'shuttlecock'
  ];
  -- Passing yourself off as us or as staff. Substring, since these have no
  -- innocent short form on a leaderboard.
  v_impersonation TEXT[] := ARRAY[
    'salelinx', 'sale linx', 'admin', 'administrator', 'moderator',
    'official', 'support', 'staff', 'helpdesk', 'system', 'root',
    'owner', 'founder', 'ceo'
  ];
BEGIN
  IF p_name IS NULL THEN RETURN NULL; END IF;

  v_trimmed := regexp_replace(btrim(p_name), '\s+', ' ', 'g');

  IF char_length(v_trimmed) < 3  THEN RETURN 'too_short'; END IF;
  IF char_length(v_trimmed) > 20 THEN RETURN 'too_long';  END IF;
  IF v_trimmed !~ '^[A-Za-z0-9 ._-]+$' THEN RETURN 'bad_chars';  END IF;
  IF v_trimmed !~ '[A-Za-z]'           THEN RETURN 'no_letters'; END IF;

  -- Leet-folded, letters only, whole name as one run.
  v_flat := regexp_replace(
    translate(lower(v_trimmed), '4@3107$5!|', 'aaeioossil'), '[^a-z]', '', 'g');

  FOREACH v_term IN ARRAY v_substrings LOOP
    IF position(v_term IN v_flat) > 0 THEN RETURN 'blocked_word'; END IF;
  END LOOP;

  FOREACH v_term IN ARRAY v_impersonation LOOP
    IF position(regexp_replace(v_term, '[^a-z]', '', 'g') IN v_flat) > 0 THEN
      RETURN 'impersonation';
    END IF;
  END LOOP;

  -- Leet-folded word split, so "s_e_x" and "sex." are caught while Sussex
  -- and Essex are not.
  v_words := regexp_split_to_array(
    regexp_replace(
      translate(lower(v_trimmed), '4@3107$5!|', 'aaeioossil'), '[^a-z]+', ' ', 'g'),
    '\s+');

  FOREACH v_term IN ARRAY v_words_blocked LOOP
    IF v_term = ANY (v_words) THEN RETURN 'blocked_word'; END IF;
  END LOOP;

  FOREACH v_word IN ARRAY v_words LOOP
    CONTINUE WHEN v_word = '';
    FOREACH v_term IN ARRAY v_compound LOOP
      IF position(v_term IN v_word) > 0 THEN
        v_exempt := FALSE;
        FOREACH v_ok IN ARRAY v_compound_ok LOOP
          IF position(v_ok IN v_word) > 0 THEN
            v_exempt := TRUE;
            EXIT;
          END IF;
        END LOOP;
        IF NOT v_exempt THEN RETURN 'blocked_word'; END IF;
      END IF;
    END LOOP;
  END LOOP;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.referral_display_name_problem(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.referral_display_name_problem(TEXT) TO authenticated;

-- Trigger: normalise and enforce on every write path.
CREATE OR REPLACE FUNCTION public.referral_codes_display_name_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_problem TEXT;
BEGIN
  IF NEW.display_name IS NULL THEN
    RETURN NEW;
  END IF;

  NEW.display_name := regexp_replace(btrim(NEW.display_name), '\s+', ' ', 'g');
  IF NEW.display_name = '' THEN
    NEW.display_name := NULL;
    RETURN NEW;
  END IF;

  v_problem := public.referral_display_name_problem(NEW.display_name);
  IF v_problem IS NOT NULL THEN
    RAISE EXCEPTION 'referral display name rejected: %', v_problem
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.referral_codes_display_name_guard()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER referral_codes_display_name_guard
  BEFORE INSERT OR UPDATE OF display_name ON public.referral_codes
  FOR EACH ROW EXECUTE FUNCTION public.referral_codes_display_name_guard();

-- RPC the app calls. Pass NULL or '' to clear the name and fall back to the
-- derived one. Returns {ok:true, display_name:...} or {ok:false,
-- error:'code'}, including 'taken' for the unique-index collision.
CREATE OR REPLACE FUNCTION public.set_referral_display_name(p_name TEXT)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_name    TEXT;
  v_problem TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  v_name := regexp_replace(btrim(COALESCE(p_name, '')), '\s+', ' ', 'g');
  IF v_name = '' THEN
    UPDATE public.referral_codes SET display_name = NULL WHERE user_id = v_uid;
    RETURN jsonb_build_object('ok', true, 'display_name', NULL);
  END IF;

  v_problem := public.referral_display_name_problem(v_name);
  IF v_problem IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', v_problem);
  END IF;

  -- The row is created by get_or_create_referral_code. If the caller somehow
  -- has no code yet there is nothing to name.
  IF NOT EXISTS (SELECT 1 FROM public.referral_codes WHERE user_id = v_uid) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_referral_code');
  END IF;

  BEGIN
    UPDATE public.referral_codes SET display_name = v_name WHERE user_id = v_uid;
  EXCEPTION
    WHEN unique_violation THEN
      RETURN jsonb_build_object('ok', false, 'error', 'taken');
  END;

  RETURN jsonb_build_object('ok', true, 'display_name', v_name);
END;
$$;

REVOKE ALL ON FUNCTION public.set_referral_display_name(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_referral_display_name(TEXT) TO authenticated;

-- Moderation backstop for anything the wordlist misses. Gated on is_admin(),
-- which inherits the AAL2/MFA requirement (003_support.sql).
CREATE OR REPLACE FUNCTION public.admin_clear_referral_display_name(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_admin');
  END IF;
  UPDATE public.referral_codes SET display_name = NULL WHERE user_id = p_user_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_clear_referral_display_name(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_clear_referral_display_name(UUID) TO authenticated;

-- =============================================================================
-- 7. referral_leaderboard() - cross-user read surface
-- =============================================================================
-- The extension's Referrals tab shows a small leaderboard. referrals RLS only
-- lets a referrer SELECT their own rows, so cross-user aggregates need a
-- SECURITY DEFINER RPC. It exposes ONLY (rank, display_name, score, is_me) -
-- never user UUIDs or emails.
--
-- Name resolution: chosen display name, then linked shop username (Depop
-- preferred - it's the name buyers already see publicly), then a neutral
-- 'Seller #<rank>' handle. The final fallback is deliberately NOT derived
-- from the email: two audits flagged the original LEFT(email, 2) fallback as
-- email-derived PII shown to third parties (original 021). Do not rebuild
-- this from a version that has the email fallback.
--
-- score: referrals that actually converted (converted/rewarding/rewarded).
-- pending is deliberately excluded so spam signups never move the board.
-- The caller's own row is always included, even below the top N.

CREATE OR REPLACE FUNCTION public.referral_leaderboard(p_limit INT DEFAULT 10)
RETURNS TABLE (rank BIGINT, display_name TEXT, score BIGINT, is_me BOOLEAN)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH scores AS (
    SELECT r.referrer_id,
           COUNT(*)::bigint AS score,
           MIN(r.converted_at) AS first_converted
    FROM public.referrals r
    WHERE r.status IN ('converted', 'rewarding', 'rewarded')
    GROUP BY r.referrer_id
  ),
  ranked AS (
    -- Ties break toward whoever converted a referral first.
    SELECT s.referrer_id, s.score,
           ROW_NUMBER() OVER (ORDER BY s.score DESC, s.first_converted ASC) AS rank
    FROM scores s
  ),
  named AS (
    SELECT k.rank, k.score, k.referrer_id,
           COALESCE(
             (SELECT rc.display_name
                FROM public.referral_codes rc
               WHERE rc.user_id = k.referrer_id),
             (SELECT la.platform_username
                FROM public.linked_accounts la
               WHERE la.user_id = k.referrer_id
                 AND la.platform_username IS NOT NULL
               ORDER BY CASE la.platform WHEN 'depop' THEN 0 ELSE 1 END
               LIMIT 1),
             -- Neutral, rank-based handle. Never derived from the email, so
             -- no email-identifying data is shown to other participants.
             'Seller #' || k.rank::text
           ) AS display_name
    FROM ranked k
  )
  SELECT n.rank, n.display_name, n.score, (n.referrer_id = auth.uid()) AS is_me
  FROM named n
  WHERE n.rank <= GREATEST(1, LEAST(COALESCE(p_limit, 10), 25))
     OR n.referrer_id = auth.uid()
  ORDER BY n.rank;
$$;

REVOKE ALL ON FUNCTION public.referral_leaderboard(INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.referral_leaderboard(INT) TO authenticated;
