-- =============================================================================
-- 021: Leaderboard display name - drop the email-derived fallback
-- =============================================================================
-- 020_referral_leaderboard fell back to LEFT(email, 2) || '***' when a
-- referrer had no linked shop, so a public, cross-user surface derived its
-- label from an email the user never consented to expose. Two independent
-- audits flagged it: the project rule is that emails must never leak to other
-- users, and even a 2-char prefix is email-derived PII shown to third parties.
--
-- Replace the fallback with a neutral, rank-based handle ("Seller #<rank>").
-- The rest of the function is IDENTICAL to 020: same (rank, display_name,
-- score, is_me) shape, same SECURITY DEFINER + search_path, same scoring,
-- same grants. Only the fallback branch changes, so this is a pure CREATE OR
-- REPLACE with no grant/permission churn.

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
             (SELECT la.platform_username
                FROM public.linked_accounts la
               WHERE la.user_id = k.referrer_id
                 AND la.platform_username IS NOT NULL
               ORDER BY CASE la.platform WHEN 'depop' THEN 0 ELSE 1 END
               LIMIT 1),
             -- Neutral, rank-based handle. Never derived from the email, so no
             -- email-identifying data is ever shown to other participants.
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
