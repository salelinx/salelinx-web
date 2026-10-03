ALTER TABLE public.trial_nudges ADD COLUMN winback_sent_at TIMESTAMPTZ;

-- One "we miss you" email per person whose last plan or trial ended 3 to 60
-- days ago and who has not come back.
CREATE OR REPLACE FUNCTION public.winback_due()
RETURNS TABLE (user_id UUID, email TEXT, paid BOOLEAN)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id, u.email::TEXT,
    EXISTS (SELECT 1 FROM public.subscriptions p WHERE p.user_id = u.id AND p.first_paid_at IS NOT NULL)
  FROM auth.users u
  LEFT JOIN public.trial_nudges n ON n.user_id = u.id
  WHERE u.email IS NOT NULL
    AND u.email_confirmed_at IS NOT NULL
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
