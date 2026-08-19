# Admin console

The internal staff console at `/admin`. It is a dedicated, English-only tool, deliberately kept distinct from the marketing site (its own shell, no Header/Footer, light "console" theme). It is unlinked from the public site - reachable only by typing the URL - and gated to `admin_users` members. Support tickets were the first module; the console is built to grow.

## Modules

| Module | Route | Status | Notes |
| --- | --- | --- | --- |
| Home (overview) | `/admin` | Live | Summary cards (open/needs-reply tickets, subscriber + per-tier counts) and recent audit activity. |
| Support | `/admin/support` | Live | Triage + reply to tickets (read/write). |
| Users | `/admin/users` | Live, read/write | Roster + per-user detail (subscription + tier, linked marketplace accounts, devices, listings + storage, usage vs caps this period, ticket count, admin badge). See "User observability" below. The detail drawer can edit the user's subscription (tier / version / status) via `admin_set_user_subscription` (audit-logged), change a customer's paid plan in Stripe via the `admin-change-plan` Edge Function (step-up reauth, audit-logged), and delete the account via the `admin-delete-user` Edge Function (step-up reauth, audit-logged, GDPR runbook). |
| Subscriptions | `/admin/subscriptions` | Live, read-only | All subscriptions with emails; filter by status/tier; Stripe ids shown as text (no live Stripe API yet). |
| Tier limits | `/admin/tiers` | Live, read/write | Edit the numeric caps in `tier_limits.limits` for active tier versions (jsonb_set via RPC). |
| Feature flags | `/admin/flags` | Live, read/write | Toggle the boolean gates in `tier_limits.features` for active tier versions. |
| Extension usage | `/admin/usage` | Live, read-only | Product metering for the current period (crosslist, relist, refresh, follow, unfollow), measured against the user's `tier_limits` caps. Sorted by percent-of-cap. |
| Web usage | `/admin/usage/web` | Live, read-only | Web abuse rate limits for the current period (checkout / portal sessions, deletion requests, label emails, email changes), measured against the hardcoded per-day cap in the calling code. |
| Endpoint health | `/admin/health` | Live, read-only | Marketplace endpoint health from passive extension telemetry (migration `030_endpoint_health.sql`). One row per Vinted / Depop endpoint the extension calls, with the failure rate over the last 24h against the endpoint's own 7-day baseline. See "Endpoint health telemetry" below. |
| Audit log | `/admin/audit` | Live, read-only | Every admin mutation, newest first; reads `admin_audit_log` directly. |
| Storage | `/admin/storage` | Live, read-only | Per-user cloud storage bytes vs tier cap, from the `user_storage` gauge (migration `004_storage_quota.sql`). |

Subscriptions / Usage / Storage / Audit are **read-only**: no mutations, no step-up reauth, no `log_admin_action` writes. Support, the two tier edit modules (Tier limits / Feature flags), and the Users subscription edit mutate data; every mutation lands in the audit log (Support logs client-side via `log_admin_action`, the tier and subscription RPCs log server-side inside the function). Tier and subscription edits are reversible (the audit entry records the old value), so they use a confirm step, not step-up reauth; reauth stays reserved for destructive/irreversible actions (currently: ticket delete, the Stripe plan change below, which bills the customer, and account deletion).

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
| Extension usage module | `app/admin/usage/page.tsx` + `components/admin/usage/*` |
| Web usage module | `app/admin/usage/web/page.tsx` (same table component) |
| Usage source split + web caps | `lib/admin/usage-sources.ts` |
| Shared usage loader | `lib/admin/usage-data.ts` |
| Audit log module | `app/admin/audit/page.tsx` + `components/admin/audit/*` |
| Storage module | `app/admin/storage/page.tsx` + `components/admin/storage/*` |
| Shared needs-reply predicate | `lib/admin/needs-reply.ts` (support table + dashboard) |
| Per-request memoized gate lookups | `lib/admin/session.ts` (`getAdminUser`, `getIsAal2`) |
| Module loading skeletons | `components/admin/AdminSkeleton.tsx` + `app/admin/**/loading.tsx` |
| Table row windowing | `lib/admin/use-windowed-rows.ts` + `components/admin/AdminTableFooter.tsx` |
| Usage period keys / cap mapping | `lib/admin/period.ts`, `lib/admin/usage-caps.ts` |
| Byte formatting (Storage module) | `lib/admin/format-bytes.ts` |
| Marketplace profile URLs (Users module) | `lib/admin/platform-links.ts` |
| Relative ages + staleness tone | `lib/admin/relative-time.ts` |
| Hydration-safe clock for relative ages | `lib/admin/use-client-now.ts` |
| Tier grid helpers (ordering, key union) | `lib/admin/tiers.ts` |
| Admin module data shapes | `lib/types/admin.ts` |
| Layer-1 edge gate + locale bypass | `proxy.ts` |
| Admin detection helper | `lib/supabase/admin.ts` (`isAdmin`) |
| Step-up re-auth helper | `lib/admin/reauth.ts` (`requireReauth`, `getReauthKind`) |
| Step-up re-auth modal (shared) | `components/admin/ReauthModal.tsx` |
| MFA challenge page | `app/[locale]/auth/mfa/page.tsx` |
| MFA enforcement in `is_admin()` | migration `009_admin_mfa.sql` |
| Audit + identity RPCs, audit table, read/write RPCs | migration `006_admin_console.sql` |
| Subscription write RPC | migration `008_admin_edit_subscription.sql` |
| Users observability widening (linked accounts, devices, listings, storage) | migration `025_admin_user_observability.sql` |

## Security model

Defense in depth, fail-closed (any error or uncertainty denies). Six layers, each independent:

1. **Edge gate (`proxy.ts`).** For `/admin/*` the middleware calls `supabase.auth.getUser()` (a verified call - re-validates the JWT, unlike `getSession()`), then checks `admin_users` membership. No user -> redirect `/auth/login`; not an admin -> redirect `/account`; any error -> redirect `/account`. A non-admin never reaches admin route code.
2. **Layout gate (`app/admin/layout.tsx`).** Re-runs the same check, fail-closed, so a missed matcher or bypassed middleware still denies. Uses `redirect` from `next/navigation` (NOT the localized `@/i18n/navigation`) with unprefixed paths.
3. **RLS is the real boundary.** Both app gates are UX + defense in depth, never the security boundary (Next renders layouts and pages in parallel and layouts do not re-run on every soft-nav). Every read/write of admin data is gated by `public.is_admin()` in Postgres. If both app gates were bypassed, RLS still rejects.
4. **Audit log.** `public.admin_audit_log` records every admin mutation. The only write path is the `log_admin_action(action, target_table, target_id, metadata)` SECURITY DEFINER RPC, which re-checks `is_admin()` and stamps `actor_id = auth.uid()` server-side (the client cannot forge the actor). The table has a SELECT-for-admins policy and no client write policies, so it is append-only and tamper-resistant.
5. **`admin_users` hardening + step-up re-auth.** `admin_users` has no client INSERT/UPDATE/DELETE policies (no self-promotion); admin is granted via the Supabase dashboard only (see below). Destructive actions (ticket delete, Stripe plan change, account deletion) require step-up re-auth via `requireReauth()`: a fresh TOTP code once the admin is enrolled (which also keeps the session at AAL2), or the password as a pre-enrollment fallback.
6. **MFA (AAL2).** `is_admin()` only returns true for AAL2 sessions, so every admin policy, RPC, and Edge Function requires a verified second factor. See the MFA section below.

### Identity lookups

`support_tickets` (and other tables) store `user_id`, not email. The web app never holds the service-role key (Edge Functions only), so identity is resolved by the `admin_user_emails(uuid[])` SECURITY DEFINER RPC, which returns `user_id -> email` for admins and zero rows for everyone else (the `is_admin()` predicate is in its `WHERE`). The support module batches the ticket/reply author ids through it and shows email when resolved, monospace `user_id` as fallback.

### Cross-user read RPCs (migration `006_admin_console.sql`)

The Users / Subscriptions / Usage modules need data ACROSS users, but the billing tables are own-row-only under RLS (`subscriptions` and `usage_counters` both gate on `auth.uid() = user_id`) and `auth.users` is not directly readable. A plain `select("*")` as an admin would return only the admin's own rows. So, exactly like `admin_user_emails`, each cross-user read is a SECURITY DEFINER function that **re-checks `public.is_admin()` itself** (in the `WHERE`, or the body for the JSONB one), making non-admins get zero rows / an exception:

- `admin_list_users()` - the roster: `auth.users` LEFT JOINed to `subscriptions` for current tier/status, plus `linked_platforms` and `last_device_seen_at` (migration `025_admin_user_observability.sql`).
- `admin_list_subscriptions()` - every `subscriptions` row (emails resolved separately via `admin_user_emails`).
- `admin_list_usage(period_keys[])` - `usage_counters` rows for the passed period keys. Scoped to the current period so the read stays bounded (the table grows ~ users x features x periods; daily rows accumulate one per user per day). If the base grows, add pagination / a top-N cap.
- `admin_user_detail(user_id, period_keys[])` - a single JSONB bundle for the detail drawer: subscription + usage for the periods + ticket count + the **target** user's `is_admin` flag (display-only; the caller is still gated on being an admin) + the observability keys below.

All are READ-only and `GRANT EXECUTE ... TO authenticated` (safe because of the in-function `is_admin()` check). The audit module needs no RPC: `admin_audit_log` already has an `is_admin()` SELECT policy, so it reads directly. Tier caps for the usage views come from the public-read `tier_limits` table via `getTierConfigs()`.

### User observability (migration `025_admin_user_observability.sql`)

The Users module answers "what is this account actually doing", not just "what does it pay". Migration 025 records nothing new: every field below already existed in the schema and was simply never surfaced. No new table, no new RLS policy, no new write path, and both widened functions stay READ-only (so neither writes to `admin_audit_log` - the log records mutations, and a row per drawer open would bury the real entries).

| Surface | Shows | Source table |
| --- | --- | --- |
| Roster: `Linked` column | Which marketplaces are connected (D / V badges), filterable, including "Nothing linked" | `linked_accounts` (001) |
| Roster: `Last active` column | The more recent of last sign-in and freshest device heartbeat, sortable, with an activity filter (7 days / 30 days / dormant / never) | `auth.users` + `device_sessions` (015) |
| Drawer: header | Joined, Last sign-in, Last seen, each with a relative age | same |
| Drawer: Linked accounts | Per platform: username, marketplace account ID, linked date, and an "Open shop" link to the live profile | `linked_accounts` |
| Drawer: Devices | Up to 10 installs, freshest first: browser, OS, truncated device ID, last seen | `device_sessions` |
| Drawer: Listings and storage | Total synced listings, a per-platform breakdown by status, last sync, bytes used | `listings` (001), `user_storage` (004) |

Things that are easy to get wrong here:

- **Last sign-in is not liveness.** A refresh token keeps a session alive for weeks, so a daily user can have a months-old `last_sign_in_at`. The device heartbeat (written by `claim_device_session` whenever the extension panel is in use) is the truer signal, which is why the roster column is the max of the two and the drawer shows both separately.
- **A missing device row is ambiguous.** `claim_device_session` prunes rows idle for 30+ days, so "no devices" means either never installed or long dormant. The drawer says so rather than implying the former.
- **Depop profiles are keyed by username, Vinted by numeric ID.** `linked_accounts` stores both, but `platform_username` is null on older rows (the extension backfills it opportunistically), and a Depop row without one is genuinely not linkable. `lib/admin/platform-links.ts` returns null in that case and the UI degrades to plain text instead of a dead link. Vinted runs a domain per market and we do not record which; the UK domain is used and Vinted redirects a member ID to the right market itself.
- **Two clocks on listings.** `listings.last_synced_at` is epoch **milliseconds** written by the extension (`0` is the column default, meaning never synced, not a 1970 date); `cloud_updated_at` is a server-side timestamp. The drawer leads with the server one and shows the extension's beside it, because a large gap between them is itself the diagnosis.
- **`platform_credentials` is deliberately not exposed.** It is encrypted client-side and the console holds no key, so it would be unreadable noise. Whether a platform is connected is already answered by `linked_accounts`.
- **Relative timestamps need a hydration-safe clock.** The tables are Client Components that Next also renders on the server; reading `Date.now()` independently on each side is a hydration mismatch, and reading it in an effect trips the repo's `react-hooks/set-state-in-effect` lint rule. `lib/admin/use-client-now.ts` uses `useSyncExternalStore` (null through hydration, ticking afterwards). Use it for any new relative timestamp rather than reinventing the pattern.

No GDPR change: every category above is already in the `docs/GDPR.md` ROPA with the same lawful basis and retention, and all of it already cascades on account deletion. This widens who inside the company can see it (staff admins, who could already read it via the Supabase dashboard), not what is collected or how long it is kept.

### Tier write RPCs (migration `006_admin_console.sql`)

The Tier limits / Feature flags modules edit `tier_limits`, which is public-read with **no client write policies** (service-role only, see `002_billing_tiers.sql`). The web app never holds the service-role key, so - same pattern again - each write is a SECURITY DEFINER function that re-checks `public.is_admin()` itself:

- `admin_set_tier_limit(tier_id, version, key, value)` - `jsonb_set` one cap in `limits`. `value` is a JSON number or null (unlimited).
- `admin_set_tier_feature(tier_id, version, key, enabled)` - `jsonb_set` one boolean in `features`.

Guardrails built into both functions (not the UI):

- **Active rows only** (`effective_until IS NULL`). Historical versions are grandfathering records and must not be rewritten.
- **Known keys only.** A typo'd key raises instead of silently creating a key nobody reads (gating treats absent keys as "not applicable"/"disabled", so a stray key is invisible corruption). Limits require the key on the target row (absent = "not applicable", shown as `-` and not editable); features require the key on any active row (absent = disabled, so enabling a feature on a tier whose row lacks the key is legitimate and creates it). Introducing a brand-new key stays a deliberate SQL-editor operation (see `docs/ENTITLEMENTS.md`).
- **Audit is server-side.** Each function calls `log_admin_action` itself (`tier.limit_update` / `tier.feature_update`, metadata carries `key`, `old`, `new`), so a mutation can never skip the audit log and every change is reversible from it.

Reads for these modules come from the public-read `tier_limits` table via the same `getTierConfigs()` the pricing page uses. Edits propagate on the existing cache TTLs (pricing page ~60s revalidate, extension ~1h).

### Subscription write RPC (migration `008_admin_edit_subscription.sql`)

The Users detail drawer's "Edit subscription" form calls `admin_set_user_subscription(user_id, tier_id, tier_version, status)`. `subscriptions` is own-row-read-only under RLS with no client write policies, so - same pattern again - the write is a SECURITY DEFINER function that re-checks `public.is_admin()` itself. It updates the user's current subscription row (the same row tier resolution prefers: newest entitled row, else newest of any status), or inserts a comp row (Stripe ids null) when the user has none - the "bespoke tiers / support comps" path from `docs/ENTITLEMENTS.md`, reachable from the console.

Guardrails built into the function (not the UI):

- **Valid status only.** Must be one of the `subscriptions.status` CHECK values.
- **Known tier only.** The `(tier_id, tier_version)` pair must exist in `tier_limits`; assigning an unconfigured tier would silently resolve to nothing. Historical (grandfathered) versions are allowed.
- **Audit is server-side.** The function calls `log_admin_action` itself (`user.subscription_update`, metadata carries `old`, `new`, and a `stripe_managed` flag), so the change is reversible from the log.

**Stripe caveat** (also shown in the UI): if the target row is Stripe-managed (`stripe_subscription_id` set), the next webhook event for that subscription overwrites `tier_id`/`status` again, and the override never changes what Stripe charges. Overrides are durable only for comp rows or lapsed subscriptions; real plan changes for paying customers use the Stripe plan change below (or the Stripe dashboard).

### Stripe plan change (`admin-change-plan` Edge Function)

The Users drawer's "Change plan" button (shown only for entitled Stripe-managed subscriptions) is the real paid plan change. It cannot be a Postgres RPC because it needs `STRIPE_SECRET_KEY`, which only Edge Functions hold, so the pattern shifts: the function validates the caller's JWT via `getUser()`, then gates on `admin_users` membership via a service-role read (authoritative, RLS-independent), then swaps the price on the customer's live Stripe subscription with `proration_behavior: 'create_prorations'`.

Key properties:

- **Stripe stays the source of truth.** The function never writes `tier_id`/`status` itself; Stripe fires `customer.subscription.updated` and the existing `stripe-webhook` maps the new price's `tier_id` metadata back onto the row (usually within seconds). No sync problem, no override to clobber.
- **Tier -> price mapping is metadata**, the same `tier_id` / `billing_cycle` metadata the webhook reads. No lookup table; tiers without an active monthly Stripe price return `no_price_for_tier`.
- **Step-up reauth.** It bills the customer (immediate prorated charge or credit), so the UI requires `requireReauth()` first, like ticket deletion.
- **Audit is server-side.** The function inserts the `user.stripe_plan_change` entry itself (service role, verified caller as actor; metadata carries old/new tier and price ids, UUIDs only).
- **Errors:** `no_stripe_subscription` (comp row or lapsed - use the entitlement override instead), `already_on_plan`, `no_price_for_tier`, `subscription_canceled`.

See `docs/EDGE-FUNCTIONS.md` for deploy and `docs/STRIPE.md` for the billing flow.

### Account deletion (`admin-delete-user` Edge Function)

The Users drawer's "Delete account" button (danger zone, hidden for admins) runs the GDPR erasure runbook from the console. It is an Edge Function for the same reason as the plan change: it needs the service role (`auth.admin.deleteUser`, Storage cleanup, audit write) and `STRIPE_SECRET_KEY`, which the web app never holds. Same gate: `getUser()` then an authoritative `admin_users` service-role read.

It mirrors `scripts/delete-user-account.mjs` exactly: delete `listing-images/{userId}/` storage objects (DB cascade does not touch Storage), delete the Stripe customer(s) (cancels any subscription; a Stripe failure aborts BEFORE the account is touched, so a user is never deleted while still chargeable), then delete the auth user, which cascades every user-owned row.

Guardrails: an admin cannot delete themselves, and cannot delete another admin (revoke admin in the dashboard first; `admin_audit_log.actor_id`'s FK would block it anyway). Step-up reauth is required (irreversible). The audit entry (`user.delete`) records counts only, never the user id, per `docs/GDPR.md` - it is the record that an erasure happened, and it must not itself reference the erased user.

Manual follow-up the function cannot do (also shown in the UI): purge the user's threads from the `support@salelinx.com` inbox.

The Storage module's data source is the `user_storage` gauge from migration `004_storage_quota.sql`: a running per-user byte total for the `listing-images` bucket, kept in lockstep by triggers on `storage.objects` (the same gauge the quota-enforcement triggers read). The table is own-row-only under RLS, so - same pattern as the other cross-user reads - the read is a SECURITY DEFINER RPC that re-checks `public.is_admin()` itself:

- `admin_list_storage()` - every `user_storage` row (`user_id`, `bytes_used`, `updated_at`), largest first. One row per user who has ever uploaded, so the read stays bounded without pagination.

Emails come from `admin_user_emails`, tiers from `admin_list_users` / `admin_list_subscriptions`, and the `cloud_storage_bytes` cap from the public-read `tier_limits` table via `getTierConfigs()`. Cap semantics differ from the count caps: `null` means unlimited, while an **absent** `cloud_storage_bytes` key means the tier has no storage allowance at all (Free/Starter) - shown as `-` with no percent.

## Rendering performance

The console is server-rendered per request and never cached (every route is
dynamic, and must stay that way - the data is cross-user and admin-only). Two
things keep it responsive:

**Memoized gate lookups.** Layers 1 and 2 both still run, but rendering a single
request used to repeat `getUser()`, the `admin_users` read, and the AAL check
several times across the layout and the page. `lib/admin/session.ts` wraps them
in React `cache()`, so each resolves once per request. This is per-request and
per-render memoization: nothing is shared between users or across requests, and
every helper returns the denying value on error, so the fail-closed behaviour is
unchanged. It removes duplicate execution, never a check.

**Parallel independent reads.** Each module's fetches are issued with
`Promise.all` where they do not depend on each other (for example Usage runs
`admin_list_usage`, `admin_list_users`, `admin_list_subscriptions` and
`getTierConfigs` together). Every RPC still re-checks `is_admin()` server-side;
concurrency changes only the order of the round-trips.

**Loading skeletons.** Every route has a `loading.tsx` rendering
`components/admin/AdminSkeleton.tsx`, so navigation paints the shell immediately
instead of blocking on the queries. These are presentation-only components: they
receive no data, perform no reads, and render before the gate resolves, so they
must never be given real content.

**Bounded reads.** The `/admin` overview needs only counts, so it selects just
the columns the predicate reads (`id,status` and `ticket_id,is_admin`) and skips
closed tickets, which can never need a reply. That keeps the read bounded as the
archive grows and, incidentally, means ticket and reply message bodies are not
fetched on the overview at all.

**Deferred detail drawers.** `AdminUserDetail` (~1k lines) and
`AdminTicketDetail` only render after a row click, but a static import bundled
them into their table's own chunk, so every visit downloaded and parsed them.
Both are now `next/dynamic` with `ssr: false` (they sit behind client state and
were never in the server markup). This cut the users roster chunk from ~29 KB to
~11 KB, with the drawer's ~22 KB fetched on first open. Keep new drawer-style
components on the same pattern.

**Indexes** (`028_admin_console_indexes.sql`). Two reads were scanning whole
tables:

- `usage_counters(period_key)` - the PK is `(user_id, feature, period_key)`, so
  filtering on `period_key` alone (what `admin_list_usage` does) could not use
  it. This is the fastest-growing table in the schema, so the scan got worse
  every day.
- `support_ticket_replies(ticket_id, created_at)` - `ticket_id` is a foreign
  key, and Postgres does not index those automatically. Both the support module
  and the overview fetch replies by ticket id and order by `created_at`, which
  the composite index now satisfies end to end.

**Windowed rendering.** Every table fetches its full result set but renders only
the first `ADMIN_PAGE_SIZE` (100) rows into the DOM, via
`lib/admin/use-windowed-rows.ts` plus the shared
`components/admin/AdminTableFooter.tsx`. The important property is that this is a
RENDERING boundary, not a data one:

- Search, filters and sorting still run over the whole fetched set, so a search
  can never miss a row that happens to be past the window.
- Header counts and empty states still report the full filtered set
  (`visible.length`); only the `.map` reads `win.windowed`.
- The open detail drawer resolves its row from the full source array, so
  filtering never closes a drawer.
- The footer renders nothing when everything already fits, so tables below 100
  rows look and behave exactly as before.

The window resets when the filtered set changes identity. That reset is derived
during render rather than in an effect, because the repo lints against
`react-hooks/set-state-in-effect` (the same rule that shaped
`lib/admin/use-client-now.ts`). Follow that pattern in new tables.

Still outstanding if the base grows:

- The Usage and Storage modules each call `admin_list_users()` +
  `admin_list_subscriptions()` purely to resolve a tier and version per row.
  Folding that into the respective RPC as a join would remove two full
  cross-user reads per page view.
- **The fetch is still unpaginated**, even though the render no longer is. Each
  module pulls its whole result set over the wire, and `admin_list_users()` runs
  three correlated LATERAL subqueries per user. Those per-user lookups are
  index-backed (`user_id` leads the PK on `linked_accounts` and
  `device_sessions`, and `subscriptions` has `idx_subscriptions_user_id`), so it
  is linear rather than quadratic. When that becomes the bottleneck the next step
  is `LIMIT`/`OFFSET` on the RPCs, which also means moving search and filtering
  server-side: doing one without the other would silently reduce filters to
  searching only the current page.

## Endpoint health telemetry

`/admin/health` answers one question: has a marketplace shipped a change that
broke us?

**Why it is passive.** Every Vinted / Depop endpoint the extension calls needs a
live logged-in browser session: a CSRF token captured by the webRequest
listener, session cookies, requests routed through the MAIN-world content-script
bridge, a real open tab, and clearance past DataDome. No server-side probe can
reach any of it - `vintedFetch` throws `NO_VINTED_TAB` before a request is even
attempted. A cron curling those URLs would fail every run and tell us nothing,
while training DataDome to treat our infrastructure as hostile.

So the users' own calls are the probe. The extension wraps its two fetch
chokepoints (`vintedFetch`, `depopFetch` - all ~150 marketplace call sites go
through them), counts outcomes locally, and reports once a day.

**Reading the table.** Compare the failure rate against the BASELINE column, not
against an absolute number: endpoints differ hugely in their normal error rate.
`severityFor()` in `lib/admin/health-data.ts` marks an endpoint broken when it is
3x its own baseline, at least 20% absolute, and backed by at least 5 distinct
install reports. That last floor is what stops one user stuck in a CAPTCHA loop
from lighting up the dashboard.

**Outcome buckets.** Only `client_error` (400/422), `server_error` (5xx) and
`network` count as failures. `auth`, `blocked` (DataDome) and `no_tab` are
conditions of the user's own session and are deliberately excluded - counting
them would make ordinary anti-bot pressure indistinguishable from a real
breakage. A spike of 422s is the schema-drift signal worth acting on.

**No per-user drill-down, by design.** `endpoint_health` has no `user_id`
column, which is what keeps it non-personal (see `docs/GDPR.md`). The trade is
deliberate: the dashboard can say "412 installs are failing this endpoint", never
which ones. Per-user debugging stays on the existing extension logs.

Useful for support triage: when a ticket says crosslisting is broken, this page
distinguishes "everyone" from "just them" immediately.

### Feature status rollup

Above the endpoint table, the page groups endpoints into the **features a user
would actually name** (Crosslist, Relist, Refresh, Shipping labels, Messages,
Offers, Follow, Auto-markdown, Restocker, My listings, Feedback bot, Account
linking). Telemetry is keyed by endpoint because that is all the fetch wrappers
can see, so the inverse mapping lives in `lib/admin/feature-endpoints.ts`.

**Every entry is scoped to ONE marketplace**, and the grid groups by platform.
A feature that exists on both is two entries, because that is how it actually
breaks: Vinted changing its draft schema takes out Vinted crosslisting while
Depop keeps working, and a merged card would show that as a partial failure with
no way to tell which side. The roll-up matches on `platform|endpoint` rather
than the path alone - several paths (`/api/v2/products/:slug/`,
`/api/v2/drafts/`) exist on both marketplaces, so matching on path would credit
Vinted traffic to a Depop feature.

The same grid renders on `/admin` (the Overview landing page), where the whole
band links into this module. It is hidden entirely there when nothing is
reporting, since a wall of "no data" cards above the real summaries is noise.

Two rules matter for reading it:

- **A feature is as healthy as its WORST endpoint**, never an average. A
  crosslist that uploads photos fine but cannot create the draft is broken, and
  averaging would hide that behind the healthy majority.
- **"No data" is its own state, never green.** A feature broken badly enough
  that nobody can use it has zero traffic, which is indistinguishable from a
  feature nobody happened to touch. Cards also show `n/m endpoints seen` so a
  green card backed by one of ten endpoints does not read as a full all-clear.

The map is hand-maintained, and its failure mode is silent: a typo means that
feature reports "no data" forever while looking like a quiet period.
`scripts/check-feature-endpoints.mjs` runs from `prebuild`/`predev` and fails the
build on a pattern that could never match a real key (query strings, platform
prefixes, literal ids, wrong method/path shape). Add to the map when a feature
starts calling a new endpoint.

## Two kinds of usage counter

`usage_counters` holds two things that look alike and are not. Both are written
through the same `increment_usage_counter` RPC, so they land in one table, but
they are capped by different mechanisms and answer different questions. They are
split across two modules for that reason.

| | Extension usage (`/admin/usage`) | Web usage (`/admin/usage/web`) |
| --- | --- | --- |
| Counters | `crosslist`, `relist`, `refresh`, `follow`, `unfollow` | `checkout_sessions`, `portal_sessions`, `delete_account_requests`, `shipping_label_emails`, `email_change_requests` |
| Written by | The extension, per metered action | Web Edge Functions + the account UI |
| Cap source | The user's `tier_limits` row, so it varies by tier | A hardcoded constant in the calling function, identical for every tier |
| Period | Monthly or daily depending on the limit key | Always daily |
| A high number means | Approaching a plan limit: a billing / upgrade signal | Hit an abuse safety valve and was served a 429: a support / abuse signal |

Mixing them on one page actively misled: a web counter has no `tier_limits` key,
so `capForFeature()` returned null and the Cap column rendered **"unlimited"**
for the counters that are in fact the most tightly capped in the system (5-20 per
day). The Web usage page shows the real limit and a true percentage.

The web caps are mirrored in `lib/admin/usage-sources.ts`. There is no runtime
link between that table and the Edge Functions, so **changing a cap in a function
means changing it there too** or the console will report the old number.

Classification is by exception: anything not registered in `WEB_COUNTERS` is
treated as extension metering, so a new extension feature appears on the
Extension page automatically. A new web rate limit must be registered or it will
be misfiled, which is the deliberate trade-off (new product features are common;
new rate limits are rare and always involve a code change here anyway).

## Client Component props must be serializable

Every admin table is a Client Component rendered by a Server Component page, so
their props cross the RSC boundary and must be serializable. **A function prop
throws at request time and `npm run build` does NOT catch it** - the route
compiles, then 500s on the first real visit.

This bit the Web usage module: the page passed `labelFor={usageLabel}` to map
counter names to friendly labels. The fix is to pass a serializable flag
(`friendlyLabels`) and import the helper inside the client component instead.
`lib/admin/usage-sources.ts` has no imports and no server-only dependencies, so
the client can import it directly.

When adding a module, pass data (strings, numbers, booleans, plain objects and
arrays) and keep formatters, predicates and callbacks inside the client
component. Verifying a new admin route means loading it in a browser as a real
admin, not just a green build.

## Per-module security checklist

Every new module MUST satisfy all of these (no exceptions):

- [ ] Every write goes through an RLS policy that independently calls `public.is_admin()`.
- [ ] Every mutation calls `log_admin_action(...)` so it lands in the audit log.
- [ ] Destructive/irreversible actions call `requireReauth()` first and abort cleanly on cancel/failure.
- [ ] Any privileged read (e.g. across users) is a SECURITY DEFINER RPC that re-checks `is_admin()` itself - never assume the app gate.
- [ ] Every gate/policy goes through `is_admin()` (never a bare `admin_users` EXISTS), so it inherits the AAL2 (MFA) requirement from migration `009_admin_mfa.sql` automatically.
- [ ] The module's data fetch is RLS-scoped and does not trust a prior gate.

## Granting admin

Admin is membership in `public.admin_users`. There are no client write policies, so grants happen only via the Supabase dashboard SQL editor (service role):

```sql
insert into public.admin_users (user_id)
values ('<the-user-uuid>')
on conflict do nothing;
```

Revoke by deleting the row. Keep the admin set small; every member has full read of all tickets and user emails. Grants/revokes are deliberate, manual, and traceable in the dashboard's SQL history.

## MFA (AAL2) enforcement

Implemented (was `TODO(admin-mfa)`). Every admin surface requires an AAL2 session: password login AND a verified TOTP code this session.

- **Database (the boundary):** `is_admin()` itself requires `auth.jwt()->>'aal' = 'aal2'` (migration `009_admin_mfa.sql`). Every admin RLS policy and every admin SECURITY DEFINER RPC calls `is_admin()`, so this single function covers all of it, including the RPCs that bypass RLS. The commented RESTRICTIVE policies at the end of 006 are superseded and stay commented.
- **Edge Functions:** `admin-change-plan` and `admin-delete-user` read the (already `getUser()`-validated) JWT's `aal` claim and return 403 `mfa_required` below AAL2. A stolen session token without the phone cannot change billing or delete accounts.
- **App gates:** `proxy.ts` and `app/admin/layout.tsx` redirect non-AAL2 admin sessions to `/auth/mfa?next=<path>`. The membership check they run first uses the `admin_users` self-read policy, which intentionally stays AAL1-readable so the gates can tell admins apart and route them to the challenge instead of `/account`.
- **Enroll / challenge UI:** enroll lives in the Account > Security card (all users may enroll; see `docs/AUTH.md`); the challenge page is `/auth/mfa`.
- **Step-up reauth is TOTP now:** once a factor is enrolled, `requireReauth()` verifies a fresh 6-digit code (which also keeps the session at AAL2) instead of the password. The password path survives only as a pre-enrollment fallback - it must never be used by an enrolled admin because `signInWithPassword` mints a fresh AAL1 session.

**Deploy order (lockout warning):** deploy the web app, enroll every admin via Account > Security, and only THEN apply migration 009 and redeploy the two admin Edge Functions. Applying 009 first locks all admins out of the console until they enroll. Recovery of last resort: remove a lost factor in the Supabase dashboard (Authentication > Users > factors) - dashboard access does not depend on app MFA. Supabase TOTP has no backup codes; the dashboard is the backup.

## Related docs

- `docs/SUPPORT.md` - the support ticket lifecycle and the email/notification flow
- `docs/ARCHITECTURE.md` - the two-repo / one-Supabase picture
- `docs/ENTITLEMENTS.md` - `tier_limits` / `usage_counters` (candidate future modules)
