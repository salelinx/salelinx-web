-- Add the `trial` tier and raise the Starter / Pro allowances.
--
-- ALREADY APPLIED to the live project (via the Supabase API, 2026-09-16) and
-- written here afterwards so this folder stays the record of the schema. Safe
-- to re-run: the insert is ON CONFLICT DO NOTHING and the updates are
-- idempotent.
--
-- The trial used to share Starter's row: Stripe bills a trial against the
-- Starter price, so a trialing subscription says tier_id='starter'. That made
-- it impossible to cap the trial tighter than Starter, which is exactly what
-- sells the upgrade. Resolution now keys off subscriptions.status, not
-- tier_id, in three places that must agree:
--   - extension  src/utils/cloud/subscription.ts   (TRIAL_TIER_ID)
--   - website    lib/supabase/subscription.ts      (TRIAL_TIER_ID)
--   - function   supabase/functions/resolve-category/index.ts

-- The tier list was hardcoded in a CHECK, which is why adding a tier needed a
-- migration at all. Widened rather than dropped: the extension deliberately
-- types TierId as `string` so custom tiers need no deploy, but a typo'd
-- tier_id that silently accepts is worse than one that fails loudly here.
alter table public.tier_limits drop constraint if exists tier_limits_tier_id_check;
alter table public.tier_limits add constraint tier_limits_tier_id_check
  check (tier_id = any (array['free'::text, 'trial'::text, 'starter'::text, 'pro'::text, 'business'::text]));

-- Trial: same feature set as Starter (it is a trial *of* Starter), lower caps.
insert into public.tier_limits (tier_id, version, features, limits, effective_from)
select
  'trial',
  1,
  features,
  jsonb_build_object(
    'crosslists_per_month', 50,
    'relists_per_month', 100,
    'refreshes_per_day', 100,
    'follows_per_day', 100,
    'unfollows_per_day', 100,
    'support_response_days', 5
  ),
  now()
from public.tier_limits
where tier_id = 'starter' and version = 1
on conflict (tier_id, version) do nothing;

-- `||` merges, so keys not named here (support_response_days, storage) survive.
-- Never assign the whole limits column: that silently drops the rest.
update public.tier_limits
set limits = limits || jsonb_build_object(
      'crosslists_per_month', 150,
      'relists_per_month', 200,
      'refreshes_per_day', 200,
      'follows_per_day', 200,
      'unfollows_per_day', 200
    )
where tier_id = 'starter' and version = 1;

update public.tier_limits
set limits = limits || jsonb_build_object(
      'crosslists_per_month', 500,
      'relists_per_month', 750
    )
where tier_id = 'pro' and version = 1;

-- The `free` row is deliberately LEFT IN PLACE, even though there is no free
-- plan any more and nothing in current code reads it.
--
-- Extensions already installed in the field still do
-- `tierId = entitled?.tier_id ?? 'free'` and then look the row up. Deleting it
-- would make that lookup return null, leaving an empty limits map -- and an
-- absent limit key reads as UNLIMITED in preflightMetered. Dropping this row
-- before the new build has rolled out would therefore hand unlimited
-- crosslists, relists, follows and refreshes to exactly the users who have
-- stopped paying. Its limits are all 0, so leaving it costs nothing.
--
-- Drop it (and 'free' from the CHECK above) once extension telemetry shows no
-- installs older than the build that ships LOCKED_OUT / entitled:false.
