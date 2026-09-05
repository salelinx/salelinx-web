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
| `20260813_usage_period_key_server_side.sql` | Derives the usage `period_key` from `now()` at UTC instead of trusting the caller, and adds a `usage_feature_periods` table | No equivalent for the function change. `002_billing_tiers.sql` still writes the caller-supplied key (per the pre-squash 038/039, the server-side variant is NOT applied in production); the `usage_feature_periods` table itself IS in 002 |
| `20260813_lock_internal_storage_functions.sql` | Revokes PUBLIC EXECUTE on `apply_storage_delta(uuid,bigint)` and `get_user_storage_cap(uuid)` | Mostly covered by `004_storage_quota.sql`, EXCEPT that this chain never revokes `anon` on `get_user_storage_cap` (see "Known grant warts" below) |

**Whether these are already live is unknown.** Check before doing anything:

```sql
select prosrc from pg_proc where proname = 'increment_usage_counter';
```

If the live definition computes the key from `now()`, the fix is already
applied and the correct cleanup is deleting the two dated files from the
extension repo so the repos stop disagreeing. If it still writes
`p_period_key` (what 002 assumes), decide then whether to port them into this
sequence.

Scope note if you do port them: the exposure is a signed-in user tampering with
their own client to under-report their own usage (the RPC is already revoked
from `anon`). Since the extension is the enforcement point and runs in the
user's browser, this narrows one bypass route rather than closing the class.

## Consolidated baseline (September 2026)

These 14 files are a squash of the previous 40-file chain (the July 2026
6-file baseline plus incrementals 007-040). They were verified to produce a
**byte-identical schema** to the old chain: both sets were applied to fresh
Postgres 16 databases (with a Supabase-environment stub including the
default-privilege grants to anon/authenticated/service_role) and the full
catalog was diffed - tables, columns and their order, defaults, constraints
including NOT VALID states, indexes, RLS policies, function bodies, ACLs and
search_path configs, triggers, publication membership, sequences, column
comments, and seed rows.

The incremental history is preserved in git. The last pre-squash state of
this folder is the parent of the squash commit:

```
git log -- supabase/migrations
```

| File | Contents | Replaces originals |
| --- | --- | --- |
| `001_core_schema.sql` | listings, platform_credentials, user_settings, linked_accounts (+ platform-identity unique index) | July 001, 007 (buyer_info), 014 (unique index), 024 (partly) |
| `002_billing_tiers.sql` | subscriptions, tier_limits (+ seed), usage_counters, increment_usage_counter (final), usage_feature_periods (+ seed), stripe_webhook_events | July 002, 012, 013 (webhook events), 018 (counter parts), 024 (partly), 038, 039 |
| `003_support.sql` | tickets, replies, admin_users, is_admin() with AAL2, rate limits, reopen-on-reply, retention purge | July 003, 007 (cascade + purge), 009, 013 (length caps), 014 (ticket limits), 018 (reply limits), 024 (partly), 027, 028 (replies index) |
| `004_storage_quota.sql` | user_storage gauge + quota triggers on storage.objects | July 004, 019, 024 (partly), 040 (apply_storage_delta) |
| `005_release_notes.sql` | release_notes | July 005, 022 |
| `006_trial_abuse_guards.sql` | trial_history, link_history, platform_account_hash, link/subscription triggers, row caps | 014, 016, 017, 023, 024 (partly) |
| `007_referrals.sql` | referral_codes (+ display_name), referrals, claim/code RPCs, moderation, leaderboard | 010, 020, 021, 029, 040 (guard revoke) |
| `008_device_sessions.sql` | device_sessions, claim RPC, Realtime publication | 015, 026 |
| `009_admin_console.sql` | admin_audit_log, log_admin_action, admin read/write RPCs, subscription editing, usage period index | July 006, 008, 011, 024 (partly), 025, 028 (usage index) |
| `010_endpoint_health.sql` | endpoint_health (+ reports), ingest, admin + public reads, prune | 030, 031, 032 |
| `011_status_overrides.sql` | status_overrides + public/admin RPCs | 033 |
| `012_endpoint_selftest.sql` | selftest runs/results, ingest, admin reads, prune | 034 |
| `013_uninstall_feedback.sql` | uninstall_feedback | 035 |
| `014_crash_health.sql` | crash_health, ingest, admin read, prune | 036, 037 |

## Known grant warts (preserved, not fixed)

The squash reproduces the live chain's final state exactly, including three
hygiene gaps the old chain never closed. Fix them in a NEW numbered migration
(and apply the same statements to the live project), never by editing the
baseline files:

- `get_user_storage_cap(uuid)` still grants EXECUTE to `anon` (via Supabase's
  default privileges; 019 revoked only `authenticated`). An anonymous caller
  can probe another user's storage cap, which discloses their coarse tier.
- `admin_set_tier_limit` / `admin_set_tier_feature` still grant EXECUTE to
  `anon` (024 missed them). Harmless - both gate on `is_admin()` internally -
  but it is the advisor-warning class 024 exists to close.
- `referral_display_name_problem(text)` has no pinned `search_path` (029 and
  040 both skipped it). IMMUTABLE plpgsql with no table references, so inert.

## Rebuilding from scratch

Run the files in order, 001 -> 014, against a fresh Supabase project. Caveats:

- `tier_limits` is runtime-editable via the admin console, so the seed in
  `002_billing_tiers.sql` reflects the values as of the squash, not
  necessarily the current live rows. Check the live table (or the
  `admin_audit_log` history) before treating the seed as current.
- The storage backfill at the end of `004_storage_quota.sql` recomputes
  per-user byte totals from whatever is in the `listing-images` bucket at
  run time; on an empty project it is a no-op.
- `is_admin()` requires AAL2 (MFA). On a fresh project, enroll every admin
  (Account > Security) before expecting the console to work.
- pg_cron scheduling is guarded: files that schedule a purge job print a
  NOTICE when pg_cron is off. Enable the extension (Database > Extensions)
  and see "Post-apply steps" below.

## Conventions

- New migrations continue the numbering (`015_...`) and state their intent in
  a header comment. **Claim the number when you open the PR, not when you
  merge.** Two branches numbering off the same main both pick the same next
  number, and the CLI keys the ledger on the version alone - so the second
  one applied silently OVERWRITES the first's row in
  `supabase_migrations.schema_migrations`. This happened once pre-squash (the
  old 029 collision); the recovery is to renumber the unmerged one and
  `supabase migration repair --status applied <n>` so the already-applied
  objects are recorded rather than re-run.
- Every `CREATE [OR REPLACE] FUNCTION` must be paired with an explicit
  `REVOKE` (see the CLAUDE.md gotcha); `tests/migration-grant-hygiene.test.ts`
  enforces this across the whole folder.
- Never overwrite whole `tier_limits` jsonb columns; use `jsonb_set` /
  `||` merges (see CLAUDE.md gotchas).
- Cross-user admin reads/writes are SECURITY DEFINER functions that re-check
  `public.is_admin()` themselves; RLS is the real security boundary, the
  app-level admin gate is defense in depth. See `docs/ADMIN.md`.

## Post-apply steps

Some migrations add a prune function but cannot schedule it themselves when
pg_cron is not enabled on the project (Database > Extensions). With pg_cron
on, 002 and 003 schedule their own jobs (usage counters, support tickets) and
012 schedules the selftest prune; these two must still be scheduled by hand:

- `010_endpoint_health.sql` - 90-day retention for the telemetry counters:
  `SELECT cron.schedule('prune-endpoint-health', '23 3 * * *', 'SELECT public.prune_endpoint_health()');`
  Without it the table grows without bound. See `docs/GDPR.md`.
- `014_crash_health.sql` - 90-day retention for crash counters:
  `SELECT cron.schedule('prune-crash-health', '29 3 * * *', 'SELECT public.prune_crash_health()');`
