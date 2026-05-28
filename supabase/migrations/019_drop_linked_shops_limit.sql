-- 019_drop_linked_shops_limit.sql
--
-- Removes the `linked_shops` key from every tier_limits.limits row.
--
-- Background: `linked_shops` was seeded in migration 011 (1 for Free/Starter/Pro,
-- 3 for Business) but was never enforced anywhere in the extension or the
-- website. It existed only as a visual row in the pricing grid, where it was
-- actively misleading: it suggested users were capped at one connected
-- marketplace, when in fact every plan has always supported both Depop and
-- Vinted sessions in parallel.
--
-- The website's pricing UI no longer renders the row. This migration drops
-- the dead key from the data so the two stay in sync and nothing reads stale
-- values by accident.
--
-- Idempotent: jsonb_path_exists short-circuits when the key is already gone.

UPDATE public.tier_limits
SET limits = limits - 'linked_shops'
WHERE limits ? 'linked_shops';
