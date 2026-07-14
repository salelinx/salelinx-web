# Admin console

The internal staff console at `/admin`. It is a dedicated, English-only tool, deliberately kept distinct from the marketing site (its own shell, no Header/Footer, light "console" theme). It is unlinked from the public site - reachable only by typing the URL - and gated to `admin_users` members. Support tickets were the first module; the console is built to grow.

## Modules

| Module | Route | Status | Notes |
| --- | --- | --- | --- |
| Home (overview) | `/admin` | Live | Summary cards (open/needs-reply tickets, subscriber + per-tier counts) and recent audit activity. |
| Support | `/admin/support` | Live | Triage + reply to tickets (read/write). |
| Users | `/admin/users` | Live, read-only | Roster + per-user detail (subscription + tier, usage vs caps this period, ticket count, admin badge). |
| Subscriptions | `/admin/subscriptions` | Live, read-only | All subscriptions with emails; filter by status/tier; Stripe ids shown as text (no live Stripe API yet). |
| Tier limits | `/admin/tiers` | Live, read/write | Edit the numeric caps in `tier_limits.limits` for active tier versions (jsonb_set via RPC). |
| Feature flags | `/admin/flags` | Live, read/write | Toggle the boolean gates in `tier_limits.features` for active tier versions. |
| Usage | `/admin/usage` | Live, read-only | Cross-user consumption for the current period, sorted by percent-of-cap. |
| Audit log | `/admin/audit` | Live, read-only | Every admin mutation, newest first; reads `admin_audit_log` directly. |
| Storage | `/admin/storage` | Live, read-only | Per-user cloud storage bytes vs tier cap, from the `user_storage` gauge (migration `004_storage_quota.sql`). |

Users / Subscriptions / Usage / Storage / Audit are **read-only**: no mutations, no step-up reauth, no `log_admin_action` writes. Support and the two tier edit modules (Tier limits / Feature flags) mutate data; every mutation lands in the audit log (Support logs client-side via `log_admin_action`, the tier RPCs log server-side inside the function). Tier edits are reversible (the audit entry records the old value), so they use a confirm step, not step-up reauth; reauth stays reserved for destructive/irreversible actions (currently: ticket delete).

## Routing & layout

`/admin` is a **top-level route subtree** (`app/admin/`), a sibling of `app/[locale]/`, NOT nested under it. This is the load-bearing decision: the marketing `<html>`/`<body>`, Geist fonts, dark theme, `Header`, and `Footer` all live in `app/[locale]/layout.tsx`, and App Router layouts only nest (a child cannot remove a parent's chrome). A top-level sibling owns its own `<html><body>`, so the admin area fully escapes the marketing shell.

Consequences:

- **English-only.** No `[locale]` segment, so the admin UI does not use `next-intl` (there is no `NextIntlClientProvider` in this tree). Strings are plain English constants; dates use `"en-US"`. This is intentional for an internal tool.
- **Hard navigation across the boundary.** Moving between the marketing site and `/admin` is a full page reload (two separate `<html>` roots). The sidebar's "Back to site" link is a plain `<a href>`, not a soft-nav `Link`.
- **Adding a module is cheap:** append an entry to `lib/admin/modules.ts`, add `app/admin/<module>/page.tsx`, add `components/admin/<module>/*`, and (if it needs a privileged read) one migration with an `is_admin()`-gated RPC. No layout/shell changes.

| Concern | File |
| --- | --- |
| Shell + Layer-2 gate + theme/fonts | `app/admin/layout.tsx` |
| Console styles (forked from globals.css) | `app/admin/admin.css` |
| Sidebar (registry-driven nav) | `components/admin/AdminSidebar.tsx` |
| Module registry | `lib/admin/modules.ts` |
| `/admin` home dashboard | `app/admin/page.tsx` + `components/admin/AdminDashboard.tsx` |
| Support module | `app/admin/support/page.tsx` + `components/admin/support/*` |
| Users module | `app/admin/users/page.tsx` + `components/admin/users/*` |
| Subscriptions module | `app/admin/subscriptions/page.tsx` + `components/admin/subscriptions/*` |
| Tier limits module | `app/admin/tiers/page.tsx` + `components/admin/tiers/*` |
| Feature flags module | `app/admin/flags/page.tsx` + `components/admin/flags/*` |
| Usage module | `app/admin/usage/page.tsx` + `components/admin/usage/*` |
| Audit log module | `app/admin/audit/page.tsx` + `components/admin/audit/*` |
| Storage module | `app/admin/storage/page.tsx` + `components/admin/storage/*` |
| Shared needs-reply predicate | `lib/admin/needs-reply.ts` (support table + dashboard) |
| Usage period keys / cap mapping | `lib/admin/period.ts`, `lib/admin/usage-caps.ts` |
| Byte formatting (Storage module) | `lib/admin/format-bytes.ts` |
| Tier grid helpers (ordering, key union) | `lib/admin/tiers.ts` |
| Admin module data shapes | `lib/types/admin.ts` |
| Layer-1 edge gate + locale bypass | `proxy.ts` |
| Admin detection helper | `lib/supabase/admin.ts` (`isAdmin`) |
| Step-up re-auth helper | `lib/admin/reauth.ts` (`requireReauth`) |
| Audit + identity RPCs, audit table, read/write RPCs | migration `006_admin_console.sql` |

## Security model

Defense in depth, fail-closed (any error or uncertainty denies). Five layers, each independent:

1. **Edge gate (`proxy.ts`).** For `/admin/*` the middleware calls `supabase.auth.getUser()` (a verified call - re-validates the JWT, unlike `getSession()`), then checks `admin_users` membership. No user -> redirect `/auth/login`; not an admin -> redirect `/account`; any error -> redirect `/account`. A non-admin never reaches admin route code.
2. **Layout gate (`app/admin/layout.tsx`).** Re-runs the same check, fail-closed, so a missed matcher or bypassed middleware still denies. Uses `redirect` from `next/navigation` (NOT the localized `@/i18n/navigation`) with unprefixed paths.
3. **RLS is the real boundary.** Both app gates are UX + defense in depth, never the security boundary (Next renders layouts and pages in parallel and layouts do not re-run on every soft-nav). Every read/write of admin data is gated by `public.is_admin()` in Postgres. If both app gates were bypassed, RLS still rejects.
4. **Audit log.** `public.admin_audit_log` records every admin mutation. The only write path is the `log_admin_action(action, target_table, target_id, metadata)` SECURITY DEFINER RPC, which re-checks `is_admin()` and stamps `actor_id = auth.uid()` server-side (the client cannot forge the actor). The table has a SELECT-for-admins policy and no client write policies, so it is append-only and tamper-resistant.
5. **`admin_users` hardening + step-up re-auth.** `admin_users` has no client INSERT/UPDATE/DELETE policies (no self-promotion); admin is granted via the Supabase dashboard only (see below). Destructive actions (currently: ticket delete) require step-up re-auth via `requireReauth()` - the admin re-enters their password and we re-verify it before proceeding; the audit entry records `reauthenticated: true`.

### Identity lookups

`support_tickets` (and other tables) store `user_id`, not email. The web app never holds the service-role key (Edge Functions only), so identity is resolved by the `admin_user_emails(uuid[])` SECURITY DEFINER RPC, which returns `user_id -> email` for admins and zero rows for everyone else (the `is_admin()` predicate is in its `WHERE`). The support module batches the ticket/reply author ids through it and shows email when resolved, monospace `user_id` as fallback.

### Cross-user read RPCs (migration `006_admin_console.sql`)

The Users / Subscriptions / Usage modules need data ACROSS users, but the billing tables are own-row-only under RLS (`subscriptions` and `usage_counters` both gate on `auth.uid() = user_id`) and `auth.users` is not directly readable. A plain `select("*")` as an admin would return only the admin's own rows. So, exactly like `admin_user_emails`, each cross-user read is a SECURITY DEFINER function that **re-checks `public.is_admin()` itself** (in the `WHERE`, or the body for the JSONB one), making non-admins get zero rows / an exception:

- `admin_list_users()` - the roster: `auth.users` LEFT JOINed to `subscriptions` for current tier/status.
- `admin_list_subscriptions()` - every `subscriptions` row (emails resolved separately via `admin_user_emails`).
- `admin_list_usage(period_keys[])` - `usage_counters` rows for the passed period keys. Scoped to the current period so the read stays bounded (the table grows ~ users x features x periods; daily rows accumulate one per user per day). If the base grows, add pagination / a top-N cap.
- `admin_user_detail(user_id, period_keys[])` - a single JSONB bundle for the detail drawer: subscription + usage for the periods + ticket count + the **target** user's `is_admin` flag (display-only; the caller is still gated on being an admin).

All are READ-only and `GRANT EXECUTE ... TO authenticated` (safe because of the in-function `is_admin()` check). The audit module needs no RPC: `admin_audit_log` already has an `is_admin()` SELECT policy, so it reads directly. Tier caps for the usage views come from the public-read `tier_limits` table via `getTierConfigs()`.

### Tier write RPCs (migration `006_admin_console.sql`)

The Tier limits / Feature flags modules edit `tier_limits`, which is public-read with **no client write policies** (service-role only, see `002_billing_tiers.sql`). The web app never holds the service-role key, so - same pattern again - each write is a SECURITY DEFINER function that re-checks `public.is_admin()` itself:

- `admin_set_tier_limit(tier_id, version, key, value)` - `jsonb_set` one cap in `limits`. `value` is a JSON number or null (unlimited).
- `admin_set_tier_feature(tier_id, version, key, enabled)` - `jsonb_set` one boolean in `features`.

Guardrails built into both functions (not the UI):

- **Active rows only** (`effective_until IS NULL`). Historical versions are grandfathering records and must not be rewritten.
- **Known keys only.** A typo'd key raises instead of silently creating a key nobody reads (gating treats absent keys as "not applicable"/"disabled", so a stray key is invisible corruption). Limits require the key on the target row (absent = "not applicable", shown as `-` and not editable); features require the key on any active row (absent = disabled, so enabling a feature on a tier whose row lacks the key is legitimate and creates it). Introducing a brand-new key stays a deliberate SQL-editor operation (see `docs/ENTITLEMENTS.md`).
- **Audit is server-side.** Each function calls `log_admin_action` itself (`tier.limit_update` / `tier.feature_update`, metadata carries `key`, `old`, `new`), so a mutation can never skip the audit log and every change is reversible from it.

Reads for these modules come from the public-read `tier_limits` table via the same `getTierConfigs()` the pricing page uses. Edits propagate on the existing cache TTLs (pricing page ~60s revalidate, extension ~1h).

### Storage read RPC (migration `006_admin_console.sql`)

The Storage module's data source is the `user_storage` gauge from migration `004_storage_quota.sql`: a running per-user byte total for the `listing-images` bucket, kept in lockstep by triggers on `storage.objects` (the same gauge the quota-enforcement triggers read). The table is own-row-only under RLS, so - same pattern as the other cross-user reads - the read is a SECURITY DEFINER RPC that re-checks `public.is_admin()` itself:

- `admin_list_storage()` - every `user_storage` row (`user_id`, `bytes_used`, `updated_at`), largest first. One row per user who has ever uploaded, so the read stays bounded without pagination.

Emails come from `admin_user_emails`, tiers from `admin_list_users` / `admin_list_subscriptions`, and the `cloud_storage_bytes` cap from the public-read `tier_limits` table via `getTierConfigs()`. Cap semantics differ from the count caps: `null` means unlimited, while an **absent** `cloud_storage_bytes` key means the tier has no storage allowance at all (Free/Starter) - shown as `-` with no percent.

## Per-module security checklist

Every new module MUST satisfy all of these (no exceptions):

- [ ] Every write goes through an RLS policy that independently calls `public.is_admin()`.
- [ ] Every mutation calls `log_admin_action(...)` so it lands in the audit log.
- [ ] Destructive/irreversible actions call `requireReauth()` first and abort cleanly on cancel/failure.
- [ ] Any privileged read (e.g. across users) is a SECURITY DEFINER RPC that re-checks `is_admin()` itself - never assume the app gate.
- [ ] Any new admin table gets the commented-out AAL2 RESTRICTIVE policy stub (see the end of `006_admin_console.sql`) so MFA enforcement is a one-step uncomment later.
- [ ] The module's data fetch is RLS-scoped and does not trust a prior gate.

## Granting admin

Admin is membership in `public.admin_users`. There are no client write policies, so grants happen only via the Supabase dashboard SQL editor (service role):

```sql
insert into public.admin_users (user_id)
values ('<the-user-uuid>')
on conflict do nothing;
```

Revoke by deleting the row. Keep the admin set small; every member has full read of all tickets and user emails. Grants/revokes are deliberate, manual, and traceable in the dashboard's SQL history.

## TODO(admin-mfa): require MFA (AAL2)

The single biggest future hardening. **Deferred** only because no MFA enroll/challenge flow exists in the web app yet (enforcing now would lock admins out). It is designed-for, not forgotten:

- **Database:** the end of migration `006_admin_console.sql` contains the exact `RESTRICTIVE` policies, commented out, on `support_tickets`, `support_ticket_replies`, and `admin_audit_log`. They require `(select auth.jwt()->>'aal') = 'aal2'`, ANDed with the existing admin policies. Uncomment to enforce at the DB level.
- **App gate:** `app/admin/layout.tsx` and `proxy.ts` each carry a `TODO(admin-mfa)` marker showing where to add a `supabase.auth.mfa.getAuthenticatorAssuranceLevel()` check that redirects to an MFA challenge/enroll page when `currentLevel !== 'aal2'`.
- **Prerequisite:** build a TOTP enroll + challenge flow (Supabase `auth.mfa.enroll` / `challenge` / `verify`) reachable from `/account/security`, then enroll every admin before flipping the RESTRICTIVE policies on (otherwise admins lose access).

## Related docs

- `docs/SUPPORT.md` - the support ticket lifecycle and the email/notification flow
- `docs/ARCHITECTURE.md` - the two-repo / one-Supabase picture
- `docs/ENTITLEMENTS.md` - `tier_limits` / `usage_counters` (candidate future modules)
