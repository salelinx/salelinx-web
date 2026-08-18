-- =============================================================================
-- 028_admin_console_indexes.sql
--
-- Two missing indexes behind the admin console's slowest reads. Index-only
-- migration: no schema change, no RLS change, no function change, no grant
-- change. Nothing here alters who can read what - is_admin() still gates every
-- admin read (see docs/ADMIN.md). This only changes how Postgres FINDS rows the
-- caller was already entitled to.
--
-- Both are CREATE INDEX IF NOT EXISTS, so re-applying is a no-op.
--
-- Note on CONCURRENTLY: it is deliberately NOT used. CREATE INDEX CONCURRENTLY
-- cannot run inside a transaction block, and the Supabase CLI/dashboard applies
-- each migration file in one. Both tables are small enough today that the brief
-- ACCESS EXCLUSIVE lock is not worth splitting the migration for. If either
-- table has grown large by the time this is applied, run these two statements
-- by hand with CONCURRENTLY instead and skip the file.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. usage_counters(period_key)
--
-- admin_list_usage(p_period_keys) filters with `WHERE period_key = ANY($1)`
-- (006_admin_console.sql). The table's PRIMARY KEY is (user_id, feature,
-- period_key), so period_key is the THIRD column and the PK's btree cannot
-- serve a lookup that does not constrain user_id first. The result is a full
-- scan of the fastest-growing table in the schema: usage_counters accumulates
-- roughly users x features x periods, with a fresh row per user per feature per
-- day for the daily buckets.
--
-- The /admin/usage page reads exactly two period keys (this month + today), so
-- an index on period_key turns that scan into two small range reads.
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_usage_counters_period_key
  ON public.usage_counters(period_key);

-- -----------------------------------------------------------------------------
-- 2. support_ticket_replies(ticket_id, created_at)
--
-- ticket_id is a FOREIGN KEY, and Postgres does NOT create an index for foreign
-- keys automatically (it does for PRIMARY KEY and UNIQUE only). Both the admin
-- support module and the /admin overview fetch replies with
-- `.in("ticket_id", [...]).order("created_at")`, so every load scans the whole
-- replies table and then sorts.
--
-- created_at is included as the second column because both call sites order by
-- it, letting the index satisfy the sort as well as the lookup. This also
-- speeds up the per-ticket reply fetch in the user-facing ticket history and
-- the ON DELETE CASCADE from support_tickets, which has to find child rows by
-- ticket_id too.
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_support_ticket_replies_ticket_created
  ON public.support_ticket_replies(ticket_id, created_at);
