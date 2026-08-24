# Supabase migrations

Schema for the shared Supabase project (this repo owns the schema; the
extension repo reads the same database).

## How these files are applied

By hand, in numeric order, via the Supabase dashboard SQL editor (or
`supabase db push`). There is no CLI-tracked migration history, so nothing
verifies the live project against this folder: the numbered files here are
assumed applied, but see the section below for two that are known not to be
tracked either way.

## Unreconciled migrations in the extension repo

`salelinx-app/supabase/migrations/` still holds two dated SQL files, written
there before this repo took over schema ownership. Neither has an equivalent in
this numbered sequence:

| File (extension repo) | What it does | Status here |
| --- | --- | --- |
| `20260813_usage_period_key_server_side.sql` | Derives the usage `period_key` from `now()` at UTC instead of trusting the caller, and adds a `usage_feature_periods` table | No equivalent. `018_rate_limit_gaps.sql` validates the shape of `p_period_key` but then writes whatever the caller sent |
| `20260813_lock_internal_storage_functions.sql` | Revokes PUBLIC EXECUTE on `apply_storage_delta(uuid,bigint)` and `get_user_storage_cap(uuid)` | Partial. `019` covers the cap function and `024` covers the trigger functions, but nothing revokes `apply_storage_delta` |

**Whether these are already live is unknown.** The dated files are from Aug 13;
this repo's `018` was last touched Aug 17 and still has the caller-supplied key,
so either the Aug 13 fix was applied to the live project and `018` is a stale
file nobody reconciled, or it was never applied. The files alone cannot tell you
which.

Check before doing anything:

```sql
select prosrc from pg_proc where proname = 'increment_usage_counter';
```

If the live definition computes the key from `now()`, the fix is already applied
and the correct cleanup is deleting the two dated files from the extension repo
so the repos stop disagreeing. If it still writes `p_period_key`, decide then
whether to port them into this sequence.

Scope note if you do port them: the exposure is a signed-in user tampering with
their own client to under-report their own usage (the RPC is already revoked
from `anon`). Since the extension is the enforcement point and runs in the
user's browser, this narrows one bypass route rather than closing the class.

## Consolidated baseline (July 2026)

These 6 files are a squash of the original 31 incremental migrations
(001-031). They were verified to produce a byte-identical schema to the
original chain: both sets were applied to fresh Postgres databases and the
full catalog (tables, columns, defaults, constraints, indexes, RLS policies,
function definitions, grants, triggers, tier seed data) was diffed.

The incremental history is preserved in git. The last pre-squash state of
this folder is the parent of the squash commit (`889f567` and earlier):

```
git log -- supabase/migrations
```

| File | Contents | Replaces originals |
| --- | --- | --- |
| `001_core_schema.sql` | listings, platform_credentials, user_settings, linked_accounts | 001, 002, 004-008, 010, 012 (markdown), 013, 014 |
| `002_billing_tiers.sql` | subscriptions, tier_limits (+ seed), usage_counters, increment_usage_counter | 011, 015-019, 023 |
| `003_support.sql` | support_tickets, support_ticket_replies, admin_users, is_admin() | 009, 012 (admin/replies), 025, 026, 028 |
| `004_storage_quota.sql` | user_storage gauge + quota triggers on storage.objects | 020-022 |
| `005_release_notes.sql` | release_notes | 024 |
| `006_admin_console.sql` | admin_audit_log, log_admin_action, admin read/write RPCs | 027, 029-031 |

## Rebuilding from scratch

Run the files in order, 001 -> 006, against a fresh Supabase project. Two
caveats:

- `tier_limits` is runtime-editable via the admin console, so the seed in
  `002_billing_tiers.sql` reflects the values as of the squash, not
  necessarily the current live rows. Check the live table (or the
  `admin_audit_log` history) before treating the seed as current.
- The storage backfill at the end of `004_storage_quota.sql` recomputes
  per-user byte totals from whatever is in the `listing-images` bucket at
  run time; on an empty project it is a no-op.

## Conventions

- New migrations continue the numbering (`007_...`) and state their intent in
  a header comment. **Claim the number when you open the PR, not when you
  merge.** Two branches numbering off the same main both pick the same next
  number, and the CLI keys the ledger on the version alone - so the second
  one applied silently OVERWRITES the first's row in
  `supabase_migrations.schema_migrations`. Both sets of objects exist, but
  one becomes invisible to `supabase migration list`, and a from-scratch
  rebuild is then unreliable. This happened with 029 (endpoint_health vs
  referral_display_name); the recovery is to renumber the unmerged one and
  `supabase migration repair --status applied <n>` so the already-applied
  objects are recorded rather than re-run.
- Never overwrite whole `tier_limits` jsonb columns; use `jsonb_set` /
  `||` merges (see CLAUDE.md gotchas).
- Cross-user admin reads/writes are SECURITY DEFINER functions that re-check
  `public.is_admin()` themselves; RLS is the real security boundary, the
  app-level admin gate is defense in depth. See `docs/ADMIN.md`.

## Post-apply steps

Some migrations add a prune function but cannot schedule it themselves (pg_cron
must be enabled on the project first, under Database > Extensions):

- `030_endpoint_health.sql` - 90-day retention for the telemetry counters:
  `SELECT cron.schedule('prune-endpoint-health', '23 3 * * *', 'SELECT public.prune_endpoint_health()');`
  Without it the table grows without bound. See `docs/GDPR.md`.
