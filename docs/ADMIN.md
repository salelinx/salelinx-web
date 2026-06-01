# Admin console

The internal staff console at `/admin`. It is a dedicated, English-only tool, deliberately kept distinct from the marketing site (its own shell, no Header/Footer, light "console" theme). It is unlinked from the public site - reachable only by typing the URL - and gated to `admin_users` members. Support tickets are the first module; the console is built to grow.

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
| `/admin` index redirect | `app/admin/page.tsx` -> `/admin/support` |
| Support module | `app/admin/support/page.tsx` + `components/admin/support/*` |
| Layer-1 edge gate + locale bypass | `proxy.ts` |
| Admin detection helper | `lib/supabase/admin.ts` (`isAdmin`) |
| Step-up re-auth helper | `lib/admin/reauth.ts` (`requireReauth`) |
| Audit + identity RPCs, audit table | migration `027_admin_console_foundation.sql` |

## Security model

Defense in depth, fail-closed (any error or uncertainty denies). Five layers, each independent:

1. **Edge gate (`proxy.ts`).** For `/admin/*` the middleware calls `supabase.auth.getUser()` (a verified call - re-validates the JWT, unlike `getSession()`), then checks `admin_users` membership. No user -> redirect `/auth/login`; not an admin -> redirect `/account`; any error -> redirect `/account`. A non-admin never reaches admin route code.
2. **Layout gate (`app/admin/layout.tsx`).** Re-runs the same check, fail-closed, so a missed matcher or bypassed middleware still denies. Uses `redirect` from `next/navigation` (NOT the localized `@/i18n/navigation`) with unprefixed paths.
3. **RLS is the real boundary.** Both app gates are UX + defense in depth, never the security boundary (Next renders layouts and pages in parallel and layouts do not re-run on every soft-nav). Every read/write of admin data is gated by `public.is_admin()` in Postgres. If both app gates were bypassed, RLS still rejects.
4. **Audit log.** `public.admin_audit_log` records every admin mutation. The only write path is the `log_admin_action(action, target_table, target_id, metadata)` SECURITY DEFINER RPC, which re-checks `is_admin()` and stamps `actor_id = auth.uid()` server-side (the client cannot forge the actor). The table has a SELECT-for-admins policy and no client write policies, so it is append-only and tamper-resistant.
5. **`admin_users` hardening + step-up re-auth.** `admin_users` has no client INSERT/UPDATE/DELETE policies (no self-promotion); admin is granted via the Supabase dashboard only (see below). Destructive actions (currently: ticket delete) require step-up re-auth via `requireReauth()` - the admin re-enters their password and we re-verify it before proceeding; the audit entry records `reauthenticated: true`.

### Identity lookups

`support_tickets` (and other tables) store `user_id`, not email. The web app never holds the service-role key (Edge Functions only), so identity is resolved by the `admin_user_emails(uuid[])` SECURITY DEFINER RPC, which returns `user_id -> email` for admins and zero rows for everyone else (the `is_admin()` predicate is in its `WHERE`). The support module batches the ticket/reply author ids through it and shows email when resolved, monospace `user_id` as fallback.

## Per-module security checklist

Every new module MUST satisfy all of these (no exceptions):

- [ ] Every write goes through an RLS policy that independently calls `public.is_admin()`.
- [ ] Every mutation calls `log_admin_action(...)` so it lands in the audit log.
- [ ] Destructive/irreversible actions call `requireReauth()` first and abort cleanly on cancel/failure.
- [ ] Any privileged read (e.g. across users) is a SECURITY DEFINER RPC that re-checks `is_admin()` itself - never assume the app gate.
- [ ] Any new admin table gets the commented-out AAL2 RESTRICTIVE policy stub (see migration `027`) so MFA enforcement is a one-step uncomment later.
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

- **Database:** migration `027` contains the exact `RESTRICTIVE` policies, commented out, on `support_tickets`, `support_ticket_replies`, and `admin_audit_log`. They require `(select auth.jwt()->>'aal') = 'aal2'`, ANDed with the existing admin policies. Uncomment to enforce at the DB level.
- **App gate:** `app/admin/layout.tsx` and `proxy.ts` each carry a `TODO(admin-mfa)` marker showing where to add a `supabase.auth.mfa.getAuthenticatorAssuranceLevel()` check that redirects to an MFA challenge/enroll page when `currentLevel !== 'aal2'`.
- **Prerequisite:** build a TOTP enroll + challenge flow (Supabase `auth.mfa.enroll` / `challenge` / `verify`) reachable from `/account/security`, then enroll every admin before flipping the RESTRICTIVE policies on (otherwise admins lose access).

## Related docs

- `docs/SUPPORT.md` - the support ticket lifecycle and the email/notification flow
- `docs/ARCHITECTURE.md` - the two-repo / one-Supabase picture
- `docs/ENTITLEMENTS.md` - `tier_limits` / `usage_counters` (candidate future modules)
