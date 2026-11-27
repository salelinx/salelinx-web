-- Custom Analytics pages: a new boolean feature key, custom_dashboards.
--
-- The extension's Analytics tab (salelinx-app src/panel/tabs/analytics/,
-- docs/technical/ANALYTICS.md "Custom pages") lets a seller build their own
-- pages out of widgets: the tab's cards plus a custom widget (what to count,
-- what to split it by, number, chart or table). The built-in Analytics pages
-- stay on every plan; only making and opening custom pages is gated, in the
-- panel, on this key through hasFeature(). Fail-closed: a tier without the key
-- sees the "Included in Pro" card. Nothing about custom pages reaches the
-- server, so there is no server-side check.
--
-- Placement: Pro and Business on; off everywhere else (trial, Starter, the
-- retired free row). No table or column change, the key lives in the existing
-- features jsonb.
--
-- ALREADY APPLIED to the live project (2026-11-26, with
-- `supabase db query --linked -f`, after a ROLLBACK dry run; verified: true on
-- business/pro, false on free/starter/trial, every row 14 -> 15 keys).
--
-- Concatenation, not a column overwrite, so the other feature keys survive
-- (see CLAUDE.md on tier_limits edits). Every version of a tier gets the key
-- so grandfathered rows behave like current ones. Custom tiers (pro_custom_*)
-- are not matched; set the key on those by hand, or from /admin/flags once
-- the key is on an active row. Safe to re-run.

BEGIN;

UPDATE public.tier_limits
SET features = features || '{"custom_dashboards": true}'::jsonb
WHERE tier_id IN ('pro', 'business');

UPDATE public.tier_limits
SET features = features || '{"custom_dashboards": false}'::jsonb
WHERE NOT (features ? 'custom_dashboards');

COMMIT;
