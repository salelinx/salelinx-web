-- =============================================================================
-- 014: Referral leaderboard read surface
-- =============================================================================
-- The extension's Referrals tab shows a small leaderboard to make referring
-- feel like a game. referrals RLS only lets a referrer SELECT their own rows
-- (010), so cross-user aggregates need a SECURITY DEFINER RPC. It exposes
-- ONLY (rank, display_name, score, is_me) - never user UUIDs or full emails.
--
-- display_name: the referrer's linked shop username (Depop preferred, then
-- Vinted - it's the name buyers already see publicly), falling back to the
-- first two characters of their email + '***' when nothing is linked.
--
-- score: referrals that actually converted (status converted/rewarding/
-- rewarded). pending is deliberately excluded so spam signups never move
-- the board. void never counts.
--
-- The caller's own row is always included, even when ranked below the top N,
-- so the UI can show "your rank" without a second call.

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
             (SELECT LEFT(u.email, 2) || '***'
                FROM auth.users u
               WHERE u.id = k.referrer_id)
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
