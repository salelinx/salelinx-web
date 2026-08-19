-- =============================================================================
-- 029: Chosen leaderboard display name (with moderation)
-- =============================================================================
-- Until now the leaderboard named people from data they never chose for it:
-- their Depop/Vinted shop username, or the neutral 'Seller #<rank>' handle
-- that 021 put in place of the old email-derived label. This lets a referrer
-- pick the name they appear under instead.
--
-- Moderation lives HERE, not in the extension. The panel validates too, but
-- only for instant feedback, since a client check is a suggestion: anyone with
-- their own access token can call the API directly. Four layers:
--
--   1. CHECK constraint. Shape only: length plus an ASCII-only charset. ASCII
--      matters because it blocks Cyrillic/Greek homoglyphs (an "admin" spelled
--      with a Cyrillic a), which no wordlist can catch.
--   2. BEFORE trigger. Normalises, then runs the wordlist on every write path,
--      so a future INSERT/UPDATE RLS policy cannot open a side door round the
--      RPC.
--   3. set_referral_display_name() RPC. The surface the app calls. Returns a
--      structured {ok,error} rather than raising, so the UI can show a useful
--      message per failure.
--   4. admin_clear_referral_display_name() RPC. No wordlist is complete. This
--      is the backstop for anything that gets through: an admin blanks the
--      name and the row falls back to the derived one.
--
-- referral_codes today has SELECT-only RLS (see 010), so the RPC is already
-- the only write path; the trigger is defence in depth, not the current gate.

-- == Column ==================================================================

ALTER TABLE public.referral_codes
  ADD COLUMN IF NOT EXISTS display_name TEXT;

ALTER TABLE public.referral_codes
  DROP CONSTRAINT IF EXISTS referral_codes_display_name_shape;

ALTER TABLE public.referral_codes
  ADD CONSTRAINT referral_codes_display_name_shape CHECK (
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
  );

-- One name per person, case-insensitively. On a leaderboard, being able to
-- take the name of the person above you is the whole impersonation problem.
CREATE UNIQUE INDEX IF NOT EXISTS referral_codes_display_name_unique
  ON public.referral_codes (lower(display_name))
  WHERE display_name IS NOT NULL;

COMMENT ON COLUMN public.referral_codes.display_name IS
  'Optional self-chosen leaderboard name. NULL falls back to shop username, then Seller #<rank>. Moderated by referral_display_name_problem().';

-- == Moderation ==============================================================

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

REVOKE ALL ON FUNCTION public.referral_display_name_problem(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.referral_display_name_problem(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.referral_display_name_problem(TEXT) TO authenticated;

-- == Trigger: normalise and enforce on every write path =======================

CREATE OR REPLACE FUNCTION public.referral_codes_display_name_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
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

DROP TRIGGER IF EXISTS referral_codes_display_name_guard ON public.referral_codes;
CREATE TRIGGER referral_codes_display_name_guard
  BEFORE INSERT OR UPDATE OF display_name ON public.referral_codes
  FOR EACH ROW EXECUTE FUNCTION public.referral_codes_display_name_guard();

-- == RPC the app calls ========================================================

-- Pass NULL or '' to clear the name and fall back to the derived one.
-- Returns {ok:true, display_name:...} or {ok:false, error:'code'}, including
-- 'taken' for the unique-index collision, which the caller shows as "someone
-- already has that name" rather than a raw constraint error.
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

REVOKE ALL ON FUNCTION public.set_referral_display_name(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_referral_display_name(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_referral_display_name(TEXT) TO authenticated;

-- Moderation backstop for anything the wordlist misses. Gated on is_admin(),
-- which inherits the AAL2/MFA requirement from 009.
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

REVOKE ALL ON FUNCTION public.admin_clear_referral_display_name(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_clear_referral_display_name(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_clear_referral_display_name(UUID) TO authenticated;

-- == Leaderboard now prefers the chosen name ==================================
-- Same contract as 020/021 (rank, display_name, score, is_me). Only the name
-- resolution changes: chosen name, then shop username, then the neutral
-- rank-based handle.
--
-- The final fallback stays 'Seller #<rank>' from 021, NOT the email prefix
-- that 020 used. 021 removed that on purpose: two audits flagged that a
-- cross-user surface was labelling people with data derived from an email
-- they never consented to expose. Rebuilding this function from 020 would
-- quietly undo that, so the chosen name is added IN FRONT of 021's chain
-- rather than replacing it.

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

REVOKE ALL ON FUNCTION public.referral_leaderboard(INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.referral_leaderboard(INT) FROM anon;
GRANT EXECUTE ON FUNCTION public.referral_leaderboard(INT) TO authenticated;
