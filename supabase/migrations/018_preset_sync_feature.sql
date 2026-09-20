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
-- here. Placement: every paid plan including the trial (Starter, Pro,
-- Business); off on the free fallback row. No table or column change, the
-- key lives in the existing features jsonb.
--
-- Concatenation, not a column overwrite, so the other feature keys survive
-- (see CLAUDE.md on tier_limits edits). Every version of a tier gets the key
-- so grandfathered rows behave like current ones. Custom tiers
-- (pro_custom_*) are not matched; set the key on those by hand, or toggle it
-- from /admin/flags now that admin_set_tier_feature's typo guard sees it on
-- an active row.
--
-- 'trial' is not in this repo's seed (the trial is a Starter subscription
-- with status 'trialing'), but the live project still carries a legacy
-- tier_limits row with that id. It is included so any subscription that
-- still resolves to it is treated as the paid trial it represents; on a
-- fresh database the id simply matches nothing.

UPDATE public.tier_limits
SET features = features || '{"preset_sync": true}'::jsonb
WHERE tier_id IN ('starter', 'pro', 'business', 'trial');

UPDATE public.tier_limits
SET features = features || '{"preset_sync": false}'::jsonb
WHERE NOT (features ? 'preset_sync');
