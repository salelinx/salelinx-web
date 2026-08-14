# Supabase migrations

Schema for the shared Supabase project (this repo owns the schema; the
extension repo reads the same database).

## How these files are applied

By hand, in numeric order, via the Supabase dashboard SQL editor (or
`supabase db push`). There is no CLI-tracked migration history; the live
project already has everything here applied.

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
  a header comment.
- Never overwrite whole `tier_limits` jsonb columns; use `jsonb_set` /
  `||` merges (see CLAUDE.md gotchas).
- Cross-user admin reads/writes are SECURITY DEFINER functions that re-check
  `public.is_admin()` themselves; RLS is the real security boundary, the
  app-level admin gate is defense in depth. See `docs/ADMIN.md`.
