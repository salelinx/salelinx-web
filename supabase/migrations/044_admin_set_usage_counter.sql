-- Admins set a user's usage for a period, so the console can show what a user at
-- (or past) their cap sees. The extension and the crosslist gate read usage_counters
-- live, so the new count applies on the next check.

CREATE OR REPLACE FUNCTION public.admin_set_usage_counter(
  p_user_id UUID,
  p_feature TEXT,
  p_period_key TEXT,
  p_count BIGINT
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF p_feature IS NULL OR p_feature NOT IN ('crosslist', 'relist', 'refresh', 'follow', 'unfollow') THEN
    RAISE EXCEPTION 'unknown feature %', COALESCE(p_feature, '(null)');
  END IF;

  -- A month or a day key, as the extension writes them; never an hour bucket.
  IF p_period_key IS NULL OR p_period_key !~ '^\d{4}-\d{2}(-\d{2})?$' THEN
    RAISE EXCEPTION 'invalid period key %', COALESCE(p_period_key, '(null)');
  END IF;

  IF p_count IS NULL OR p_count < 0 OR p_count > 1000000 THEN
    RAISE EXCEPTION 'invalid count';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p_user_id) THEN
    RAISE EXCEPTION 'no such user';
  END IF;

  INSERT INTO public.usage_counters (user_id, feature, period_key, count, updated_at)
  VALUES (p_user_id, p_feature, p_period_key, p_count, NOW())
  ON CONFLICT (user_id, feature, period_key) DO UPDATE
    SET count = p_count,
        updated_at = NOW();

  -- No user id in the audit entry (docs/GDPR.md).
  PERFORM public.log_admin_action(
    'user.usage_set',
    'usage_counters',
    NULL,
    jsonb_build_object('feature', p_feature, 'period_key', p_period_key, 'count', p_count)
  );

  RETURN p_count;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_usage_counter(UUID, TEXT, TEXT, BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_usage_counter(UUID, TEXT, TEXT, BIGINT) TO authenticated;
