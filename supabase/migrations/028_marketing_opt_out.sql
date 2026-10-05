-- Skip anyone who ticked the signup opt-out. Also restates trial_nudge_due's
-- live 60-day window, which 025 on main still shows as 14.

CREATE OR REPLACE FUNCTION public.trial_nudge_due()
RETURNS TABLE (user_id UUID, email TEXT, step SMALLINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id, u.email::TEXT, COALESCE(n.step, 0)::SMALLINT
  FROM auth.users u
  LEFT JOIN public.trial_nudges n ON n.user_id = u.id
  WHERE u.email IS NOT NULL
    AND u.email_confirmed_at IS NOT NULL
    AND (u.raw_user_meta_data->>'marketing_opt_out') IS DISTINCT FROM 'true'
    AND u.created_at > NOW() - INTERVAL '60 days'
    AND n.unsubscribed_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM public.subscriptions s WHERE s.user_id = u.id)
    AND NOT EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = u.id)
    -- Checkout would refuse these a trial, and the email offers one.
    AND NOT EXISTS (
      SELECT 1 FROM public.link_history l
      JOIN public.trial_history t USING (platform_account_hash)
      WHERE l.user_id = u.id
    )
    AND (
      (COALESCE(n.step, 0) = 0 AND u.created_at < NOW() - INTERVAL '1 day')
      OR (n.step = 1 AND u.created_at < NOW() - INTERVAL '4 days'
          AND n.last_sent_at < NOW() - INTERVAL '2 days')
    )
  ORDER BY u.created_at
  LIMIT 50;
$$;

REVOKE ALL ON FUNCTION public.trial_nudge_due() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trial_nudge_due() TO service_role;

CREATE OR REPLACE FUNCTION public.winback_due()
RETURNS TABLE (user_id UUID, email TEXT, paid BOOLEAN, stripe_customer_id TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id, u.email::TEXT,
    EXISTS (SELECT 1 FROM public.subscriptions p WHERE p.user_id = u.id AND p.first_paid_at IS NOT NULL),
    (SELECT c.stripe_customer_id FROM public.subscriptions c
      WHERE c.user_id = u.id AND c.stripe_customer_id IS NOT NULL
      ORDER BY c.created_at DESC LIMIT 1)
  FROM auth.users u
  LEFT JOIN public.trial_nudges n ON n.user_id = u.id
  WHERE u.email IS NOT NULL
    AND u.email_confirmed_at IS NOT NULL
    AND (u.raw_user_meta_data->>'marketing_opt_out') IS DISTINCT FROM 'true'
    AND n.unsubscribed_at IS NULL
    AND n.winback_sent_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = u.id)
    AND NOT EXISTS (
      SELECT 1 FROM public.subscriptions s
      WHERE s.user_id = u.id
        AND s.status IN ('active', 'trialing', 'past_due', 'unpaid', 'paused')
    )
    AND (SELECT MAX(s.current_period_end) FROM public.subscriptions s WHERE s.user_id = u.id)
      BETWEEN NOW() - INTERVAL '60 days' AND NOW() - INTERVAL '3 days'
  ORDER BY u.created_at
  LIMIT 50;
$$;

REVOKE ALL ON FUNCTION public.winback_due() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.winback_due() TO service_role;
