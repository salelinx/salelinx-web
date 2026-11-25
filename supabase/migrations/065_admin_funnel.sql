-- =============================================================================
-- 065: Signup funnel for the admin console
-- =============================================================================
-- /admin/analytics/funnel follows accounts from signup to paying, grouped by
-- when they signed up and where they came from. admin_list_users() only knows
-- the current state (shops linked now, the latest subscription row), so an
-- account that paid and then cancelled, or unlinked its shop, would drop out
-- of steps it did reach. This returns, per account, whether it EVER reached
-- each step:
--
--   confirmed       email confirmed (Google sign-ins arrive confirmed)
--   installed       any device_sessions row, i.e. the extension checked in
--   linked          a shop linked now, or ever (link_history is append-only)
--   features        every usage_counters feature with a count; the page keeps
--                   the extension's own (lib/admin/usage-sources.ts)
--   subscribed_at   first Stripe subscription (checkout done, trial or paid).
--                   Comps have no Stripe subscription and are left out
--   first_paid_at   first real payment (stripe-webhook stamps it only when an
--                   invoice takes money, never for a trial's free opening one)
--   in_trial_now    a running trial, which has not had its chance to pay yet
--   paying_now      an active Stripe subscription that has paid
--
-- No email or other contact detail: the page shows counts only. Admin
-- accounts are left out so our own testing does not count as customers, and
-- deleted accounts are gone from auth.users, so they are not counted either.
-- Read-only, SECURITY DEFINER with is_admin() in the WHERE like the other
-- admin_list_* reads (009), so non-admins and AAL1 sessions get zero rows.

CREATE OR REPLACE FUNCTION public.admin_funnel_accounts()
RETURNS TABLE (
  user_id uuid,
  signed_up_at timestamptz,
  confirmed boolean,
  source text,
  campaign text,
  device text,
  installed boolean,
  linked boolean,
  features text[],
  subscribed_at timestamptz,
  first_paid_at timestamptz,
  in_trial_now boolean,
  paying_now boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    u.id,
    u.created_at,
    u.email_confirmed_at IS NOT NULL,
    u.raw_user_meta_data -> 'signup_source' ->> 'source',
    u.raw_user_meta_data -> 'signup_source' ->> 'campaign',
    u.raw_user_meta_data -> 'signup_source' ->> 'device',
    EXISTS (SELECT 1 FROM public.device_sessions d WHERE d.user_id = u.id),
    EXISTS (SELECT 1 FROM public.linked_accounts l WHERE l.user_id = u.id)
      OR EXISTS (SELECT 1 FROM public.link_history h WHERE h.user_id = u.id),
    COALESCE(
      (SELECT array_agg(DISTINCT c.feature)
         FROM public.usage_counters c
        WHERE c.user_id = u.id AND c.count > 0),
      ARRAY[]::text[]
    ),
    s.subscribed_at,
    s.first_paid_at,
    COALESCE(s.in_trial_now, false),
    COALESCE(s.paying_now, false)
  FROM auth.users u
  LEFT JOIN LATERAL (
    SELECT
      min(sub.created_at) AS subscribed_at,
      min(sub.first_paid_at) AS first_paid_at,
      bool_or(
        sub.status = 'trialing'
        AND (sub.current_period_end IS NULL OR sub.current_period_end > now())
      ) AS in_trial_now,
      bool_or(sub.status = 'active' AND sub.first_paid_at IS NOT NULL) AS paying_now
    FROM public.subscriptions sub
    WHERE sub.user_id = u.id
      AND sub.stripe_subscription_id IS NOT NULL
  ) s ON TRUE
  WHERE public.is_admin()
    AND NOT EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = u.id)
  ORDER BY u.created_at;
$$;

REVOKE ALL ON FUNCTION public.admin_funnel_accounts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_funnel_accounts() TO authenticated;
