-- Settings presets sync: a new boolean feature key, preset_sync.
--
-- The extension (salelinx-app src/utils/cloud/preset-sync.ts) mirrors each
-- Settings panel's saved presets into user_settings.preferences.presets so
-- they follow the account across a reinstall or a second machine. The cloud
-- copy is gated on this key through checkFeature(), fail-closed: a tier
-- without it keeps presets in chrome.storage.local, exactly as before syncing
-- existed. Saving presets is never gated, and the gate is silent (no lock, no
-- upgrade modal), so the website is where a user learns the plan requirement.
--
-- The extension has no fallback for the key: which tiers carry it is decided
-- here. Placement: every live plan (trial, Starter, Pro, Business); off on
-- the retired `free` row, which 018_trial_tier_and_limits.sql keeps only for
-- extension builds that still look it up. No table or column change, the key
-- lives in the existing features jsonb.
--
-- ALREADY APPLIED to the live project (2026-09-20, verified: true on
-- business/pro/starter/trial, false on free). Safe to re-run.
--
-- Concatenation, not a column overwrite, so the other feature keys survive
-- (see CLAUDE.md on tier_limits edits). Every version of a tier gets the key
-- so grandfathered rows behave like current ones. Custom tiers
-- (pro_custom_*) are not matched; set the key on those by hand, or toggle it
-- from /admin/flags now that admin_set_tier_feature's typo guard sees it on
-- an active row.
--
-- The trial row (018_trial_tier_and_limits.sql) was cloned from Starter's
-- features before this key existed, so it is named here explicitly.

UPDATE public.tier_limits
SET features = features || '{"preset_sync": true}'::jsonb
WHERE tier_id IN ('starter', 'pro', 'business', 'trial');

UPDATE public.tier_limits
SET features = features || '{"preset_sync": false}'::jsonb
WHERE NOT (features ? 'preset_sync');
