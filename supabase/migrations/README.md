# Supabase migrations

Schema for the shared Supabase project (this repo owns the schema; the
extension repo reads the same database).

## How these files are applied

By hand, in numeric order, via the Supabase dashboard SQL editor, or with the
CLI against the linked project without touching its history table:

```sh
supabase db query --linked -f supabase/migrations/016_usage_hour_buckets.sql
```

**Do not use `supabase db push`.** The live project's migration history table
still records the PRE-squash version numbers (001 through 037 plus three
timestamped entries), so `db push` would treat a post-squash `016` as already
applied and skip it, or try to replay files the squash renumbered. Nothing
verifies the live project against this folder: the numbered files here are
assumed applied.

## Former extension-repo migrations

Until October 2026, `salelinx-app/supabase/migrations/` held two dated SQL
files written before this repo took over the schema. Both were deleted from
there (their content is in that repo's git history):

| File (extension repo) | What it did | What became of it |
| --- | --- | --- |
| `20260813_usage_period_key_server_side.sql` | Replaced `increment_usage_counter` with a variant that derives the month/day `period_key` from `now()` at UTC instead of trusting the caller, reading daily vs monthly from `usage_feature_periods` | Dropped, not ported. It was never applied to live, and 016 and 017 have since replaced the function twice, so applying it now would silently remove the hour bucket and the event row (the live body was checked in October 2026 and writes `usage_events`, so 017 is what runs). `usage_feature_periods` is still created by 002 but nothing reads it. If server-derived keys are wanted, write a new migration on top of 017's body |
| `20260813_lock_internal_storage_functions.sql` | Revoked direct EXECUTE on `apply_storage_delta(uuid,bigint)` and `get_user_storage_cap(uuid)` | Ported as `036_lock_storage_cap_from_anon.sql`. 004 already covered `apply_storage_delta`; the missing piece was `anon` on `get_user_storage_cap`. On 14 Oct 2026 `anon` held no EXECUTE on either function on live (the dated file had evidently been run there), so 036 brings the repo in line with live rather than changing it |

The exposure the dropped period-key change addressed is a signed-in user
tampering with their own client to under-report their own usage (the RPC is
already revoked from `anon`). Since the extension is the enforcement point and
runs in the user's browser, server-derived keys would narrow one bypass route
rather than close the class.

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

## Post-squash migrations

Numbered files after 014 are normal incremental migrations on top of the
baseline, not part of the squash:

| File | Contents | Note |
| --- | --- | --- |
| `015_device_session_version.sql` | device_sessions.extension_version column, claim_device_session 4-arg signature, admin roster/detail version reporting | Applied to live as pre-squash `041`; renumbered only, content unchanged (in-body comments still say 041 to keep function bodies byte-identical to live) |
| `016_usage_hour_buckets.sql` | increment_usage_counter also upserts a server-derived UTC hour bucket (`YYYY-MM-DDTHH`); hour rows purged after 60 days and excluded from the 2000-row cap; partial index for the purge | Replaces `increment_usage_counter` outright, which is why the extension repo's dated period-key file could not be ported (see "Former extension-repo migrations" above): the live body is 002's caller-supplied-key variant plus the hour bucket. Set `HOUR_EPOCH` in `lib/admin/period.ts` to the day it was applied |
| `017_usage_events.sql` | usage_events table (one row per increment_usage_counter call, 7-day retention, hourly purge), increment_usage_counter writes it, admin_list_usage_events(since, until) | Replaces `increment_usage_counter` again (016 body plus the event insert). Set `EVENTS_EPOCH` in `lib/admin/period.ts` to the moment it was applied |
| `022_preset_sync_feature.sql` | Adds the `preset_sync` boolean to `tier_limits.features` (true on trial/starter/pro/business, false on the retired free row) via jsonb concatenation | Data only, no schema change. Applied to live on 20 Sep 2026 (verified: true on business/pro/starter/trial, false on free). Gates the extension's settings-preset cloud copy; apply before shipping an extension build that carries `src/utils/cloud/preset-sync.ts`'s gate, or presets stop syncing for everyone |
| `032_roadmap_items.sql` | `roadmap_items` table (public read of published cards via RLS, admin read of drafts via `is_admin()`), `admin_save_roadmap_item` / `admin_delete_roadmap_item` / `admin_reorder_roadmap_items`, seed of the nine cards that were hardcoded in `lib/roadmap/data.ts` (with eBay moved to Building) | Applied to live on 13 Oct 2026 (verified: 9 cards, eBay in Building). **Apply before deploying the web build that reads it** on any rebuilt project: the homepage roadmap section renders nothing while the table is missing. Re-runnable: the seed is `ON CONFLICT DO NOTHING`, so it never overwrites console edits |
| `033_roadmap_sync_main.sql` | Data only: replays the roadmap PR #200 rewrote in `lib/roadmap/data.ts` + `messages/*.json` (11 cards, eBay and eBay-only sellers in Building for Q4 2026, newer shipped items) into `roadmap_items`, and deletes the two cards it dropped | Touches only cards never saved in `/admin/roadmap` (`updated_at = created_at`), so console edits win and re-running is safe. **Apply before deploying the web build that reads `roadmap_items`**, or the site shows 032's older roadmap |
| `034_marketing_explicit_yes.sql` | Replaces `trial_nudge_due()` and `winback_due()`: only accounts whose `marketing_opt_out` is false (an explicit yes) are picked; unanswered accounts are no longer emailed under the soft opt-in | Function bodies otherwise identical to 028. Apply with `supabase db query --linked -f` (not `db push`, see the top of this file); the next daily trial-nudge run uses it |
| `036_lock_storage_cap_from_anon.sql` | Revokes `anon` EXECUTE on `get_user_storage_cap(uuid)` | Ported from the extension repo's `20260813_lock_internal_storage_functions.sql`; closes the first grant wart below. Idempotent, no client calls the function. Already in effect on live (checked 14 Oct 2026), so applying it there is a no-op |
| `037_sync_live_functions.sql` | Re-creates `admin_set_tier_limit` and `admin_set_tier_feature` (009), `admin_set_user_subscription` (009) and `bump_user_storage_on_delete` (004) with their baseline bodies, verbatim; the two tier RPCs revoke `anon` | A 14 Oct 2026 comparison of live function bodies against this folder found the two tier RPCs missing on live (pre-squash `030_admin_tier_write_rpcs.sql` never ran there) and the other two on older bodies. Signatures match live, so it replaces in place. Closes the second grant wart below. Re-runnable |
| `040_ebay.sql` | eBay as a third platform: the `listings.platform` and `linked_accounts.platform` CHECKs accept `ebay`, and the `ebay_tokens` table (one row per user, `ebay_user_id` UNIQUE, OAuth access and refresh tokens with their expiries, Trading site id) has RLS on with no policies and is revoked from PUBLIC, anon and authenticated, so only the service role (the `ebay` and `ebay-account-deletion` functions) can read it | Applied to live as `032_ebay.sql` (stated in PR #216); renumbered only, content unchanged. It was written on the eBay branch (10 Oct 2026) while `main` took 032 for the roadmap (13 Oct) and then 038 and 039, so it moved to the first number free on both. Re-running it would fail on the existing `ebay_tokens` table, so do not apply it again where 032_ebay already ran |

## Known grant warts (preserved, not fixed)

The squash reproduces the live chain's final state exactly, including three
hygiene gaps the old chain never closed. Fix them in a NEW numbered migration
(and apply the same statements to the live project), never by editing the
baseline files:

- `get_user_storage_cap(uuid)` still grants EXECUTE to `anon` (via Supabase's
  default privileges; 019 revoked only `authenticated`). An anonymous caller
  can probe another user's storage cap, which discloses their coarse tier.
  Fixed by `036_lock_storage_cap_from_anon.sql`. Live no longer has the gap
  (checked 14 Oct 2026); the extension repo's dated lock file had evidently
  been run there.
- `admin_set_tier_limit` / `admin_set_tier_feature` still grant EXECUTE to
  `anon` (024 missed them). Harmless - both gate on `is_admin()` internally -
  but it is the advisor-warning class 024 exists to close. Fixed by
  `037_sync_live_functions.sql`. Both functions were missing from live
  entirely until 037, so live never had this wart.
- `referral_display_name_problem(text)` has no pinned `search_path` (029 and
  040 both skipped it). IMMUTABLE plpgsql with no table references, so inert.

## Rebuilding from scratch

Run the files in numeric order, from 001 to the highest number, against a fresh
Supabase project. Caveats:

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

- New migrations continue the numbering (`016_...`) and state their intent in
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
