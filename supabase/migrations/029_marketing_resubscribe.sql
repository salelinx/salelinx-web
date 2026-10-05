-- Lets a signed-in user undo an unsubscribe made from an email link.
--
-- Marketing email is blocked by either of two flags: marketing_opt_out in the
-- user's own auth metadata (the answer given at signup, in the first-visit
-- prompt or on /account) and trial_nudges.unsubscribed_at (written by the
-- link in every email). A user can flip the first themselves but has no
-- policy on trial_nudges, so saying yes again after an email-link unsubscribe
-- would otherwise change nothing. Only ever touches the caller's own row.

CREATE OR REPLACE FUNCTION public.clear_marketing_unsubscribe()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.trial_nudges
  SET unsubscribed_at = NULL
  WHERE user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.clear_marketing_unsubscribe() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.clear_marketing_unsubscribe() TO authenticated;
