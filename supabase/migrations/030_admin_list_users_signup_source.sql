-- Adds signup_source (first-touch source the site stores in user metadata at
-- signup) to the admin roster. New return column, so DROP + CREATE.

drop function if exists public.admin_list_users();

create function public.admin_list_users()
returns table(
  user_id uuid,
  email text,
  created_at timestamp with time zone,
  last_sign_in_at timestamp with time zone,
  tier_id text,
  status text,
  cancel_at_period_end boolean,
  current_period_end timestamp with time zone,
  is_admin boolean,
  linked_platforms text[],
  last_device_seen_at timestamp with time zone,
  extension_version text,
  signup_source text,
  signup_campaign text
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  SELECT
    u.id,
    u.email,
    u.created_at,
    u.last_sign_in_at,
    s.tier_id,
    s.status,
    COALESCE(s.cancel_at_period_end, FALSE) AS cancel_at_period_end,
    s.current_period_end,
    EXISTS (
      SELECT 1 FROM public.admin_users a WHERE a.user_id = u.id
    ) AS is_admin,
    COALESCE(la.platforms, ARRAY[]::TEXT[]) AS linked_platforms,
    ds.last_seen_at AS last_device_seen_at,
    ds.extension_version,
    u.raw_user_meta_data -> 'signup_source' ->> 'source' AS signup_source,
    u.raw_user_meta_data -> 'signup_source' ->> 'campaign' AS signup_campaign
  FROM auth.users u
  LEFT JOIN LATERAL (
    SELECT sub.tier_id, sub.status, sub.cancel_at_period_end, sub.current_period_end
    FROM public.subscriptions sub
    WHERE sub.user_id = u.id
    ORDER BY sub.updated_at DESC
    LIMIT 1
  ) s ON TRUE
  LEFT JOIN LATERAL (
    SELECT array_agg(l.platform ORDER BY l.platform) AS platforms
    FROM public.linked_accounts l
    WHERE l.user_id = u.id
  ) la ON TRUE
  LEFT JOIN LATERAL (
    SELECT d.last_seen_at, d.extension_version
    FROM public.device_sessions d
    WHERE d.user_id = u.id
    ORDER BY d.last_seen_at DESC
    LIMIT 1
  ) ds ON TRUE
  WHERE public.is_admin()
  ORDER BY u.created_at DESC;
$function$;

revoke all on function public.admin_list_users() from public, anon;
grant execute on function public.admin_list_users() to authenticated, service_role;
