DROP FUNCTION public.trial_nudge_due();

CREATE FUNCTION public.trial_nudge_due()
RETURNS TABLE (user_id UUID, email TEXT, step SMALLINT, installed BOOLEAN)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id, u.email::TEXT, COALESCE(n.step, 0)::SMALLINT, i.installed
  FROM auth.users u
  LEFT JOIN public.trial_nudges n ON n.user_id = u.id
  CROSS JOIN LATERAL (
    SELECT EXISTS (SELECT 1 FROM public.device_sessions d WHERE d.user_id = u.id) AS installed
  ) i
  WHERE u.email IS NOT NULL
    AND u.email_confirmed_at IS NOT NULL
    AND (
      (u.raw_user_meta_data->>'marketing_opt_out') = 'false'
      -- 7 days keeps the first run off the 60-day backlog.
      OR (COALESCE(n.step, 0) = 0 AND NOT i.installed
          AND u.created_at > NOW() - INTERVAL '7 days')
    )
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
