# Entitlements

Config-driven tier system. **Tier limits live as data in Supabase, not hardcoded.** Change a `tier_limits` row and every client (website + extension) picks it up within the cache TTL.

## Tables

### `tier_limits`

One row per (tier_id, version). Features are boolean flags; limits are numeric caps.

```
tier_id           free | starter | pro | business
version           int                     -- for grandfathering
features          jsonb                   -- { auto_refresh: true, restocker: false, ... }
limits            jsonb                   -- { crosslists_per_month: 3500, cloud_storage_bytes: null, ... }
effective_from    timestamptz
effective_until   timestamptz nullable
PK (tier_id, version)
```

**Semantics:**

- Feature absent or false = disabled
- Feature true = enabled
- Limit value `null` = unlimited
- Limit missing entirely = not applicable for this tier

RLS: public read, no client write policies. Writes happen via the service role (Supabase dashboard) or the `is_admin()`-gated `admin_set_tier_limit` / `admin_set_tier_feature` RPCs behind the admin console (migration `009_admin_console.sql`, see `docs/ADMIN.md`).

### `usage_counters`

Per-user, per-feature, per-period running totals. Feature + period key together identify which bucket to increment.

```
user_id       uuid references auth.users
feature       text        -- 'crosslist', 'follow', 'refresh', ...
period_key    text        -- 'YYYY-MM' for monthly, 'YYYY-MM-DD' for daily
count         bigint
updated_at    timestamptz
PK (user_id, feature, period_key)
```

RLS: users can only SELECT their own rows. Inserts/updates go through the RPC.

### `increment_usage_counter(feature, period_key, delta)`

Atomic upsert. Uses `auth.uid()` so the caller can only mutate their own counters. Returns the new count.

```sql
SELECT public.increment_usage_counter('crosslist', '2026-04', 1);
-- returns: 42
```

`SECURITY DEFINER` so it bypasses RLS during the insert/update - but it still scopes everything to `auth.uid()`, so users can't touch each other's counters.

## How the two sides use this

### Website (this repo)

- `/pricing` reads `tier_limits` and renders the tier grid
- `/account` reads the user's current tier (from `subscriptions`) + their usage counters to render meters
- Never increments - extensions do that

### Extension

- `src/entitlements/gate.ts` wraps every gateable action (shipped and live)
- `checkFeature(featureKey)` â†’ boolean feature gate
- `preflightMetered(...)` â†’ reads the cap and current period count, returns `{ allowed, cappedAmount, remaining }` without writing
- `consumeMetered(...)` â†’ calls the `increment_usage_counter` RPC with the delta actually completed, after the run
- `gateBotStart(...)` â†’ the combined pre-flight used by bot handlers
- Fails closed: no cached subscription or a signed-out user yields `auth_required`, never an allow

## Not everything in usage_counters is a tier limit

The website also writes `usage_counters` rows for per-day ABUSE RATE LIMITS that
have nothing to do with entitlements: `checkout_sessions` and `portal_sessions`
(20/day), `shipping_label_emails` (15/day), `delete_account_requests` and
`email_change_requests` (5/day). They reuse the `increment_usage_counter` RPC
because it is already `auth.uid()`-scoped and needs no new table.

These caps are hardcoded constants in the calling Edge Function or component,
NOT keys in `tier_limits`, and are identical for every tier. Do not add
`tier_limits` entries for them, and do not assume a row in `usage_counters` is
tier-metered: check `lib/admin/usage-sources.ts`, which is the registry the admin
console uses to tell the two apart (Extension usage vs Web usage). See
`docs/ADMIN.md`.

## Period keys

| Feature kind | Period key format | Example      |
| ------------ | ----------------- | ------------ |
| Monthly      | `YYYY-MM`         | `2026-04`    |
| Daily        | `YYYY-MM-DD`      | `2026-04-17` |

**Computed by the client, in UTC.** The extension's `getPeriodKey`
(`src/entitlements/gate.ts`) builds the key with `getUTCFullYear` /
`getUTCMonth` / `getUTCDate` and passes it to `increment_usage_counter`, which
writes to whatever key it receives (it validates the shape, not the value). So a
user's period rolls over at UTC midnight, not local midnight. Periods reset
implicitly - a new period key just means a new row.

Because the bucket is chosen client-side, anything calling the RPC directly can
name a period nothing reads, and that usage never counts against the current
cap. The extension is the enforcement point and runs in the user's browser, so
this is one bypass route among several rather than a distinct hole. A migration
that derives the key server-side exists in the extension repo but was never
reconciled into this repo's sequence; see `supabase/migrations/README.md` for
what to check before acting on it.

## Seed data (v1)

See migration `002_billing_tiers.sql` (creates `subscriptions`, `tier_limits`, `usage_counters`, plus the `increment_usage_counter` RPC and seeds tier v1 with the full feature set: `account_linking` Pro+, `auto_markdown` Business, `dead_stock` / `shop_designer` / `messages` / `offers` Starter+, `auto_accept_offers` Pro+, `shipping_label_email` Business). Auto-offers (`auto_offer`) stays Pro+. Summary:

| Label                       | JSON key                 | Free | Starter | Pro       | Business  |
| --------------------------- | ------------------------ | ---- | ------- | --------- | --------- |
| Crosslists / mo             | `crosslists_per_month`   | 0    | 150     | 3,500     | Unlimited |
| Relists / mo                | `relists_per_month`      | 0    | 150     | 3,500     | Unlimited |
| Refreshes / day             | `refreshes_per_day`      | 0    | 100     | Unlimited | Unlimited |
| Follows / day               | `follows_per_day`        | 0    | 500     | Unlimited | Unlimited |
| Unfollows / day             | `unfollows_per_day`      | 0    | 500     | Unlimited | Unlimited |
| Cloud storage               | `cloud_storage_bytes`    | -    | -       | 500 MB    | 1 GB      |
| Support response (days)     | `support_response_days`  | 7    | 5       | -         | -         |
| Support response (hours)    | `support_response_hours` | -    | -       | 48        | 24        |
| Auto-refresh                | `auto_refresh`           | âœ—    | âœ—       | âœ“         | âœ“         |
| Cloud sync                  | `cloud_sync`             | âœ—    | âœ—       | âœ“         | âœ“         |
| Shipping labels             | `shipping_labels`        | âœ—    | âœ—       | âœ“         | âœ“         |
| Account linking             | `account_linking`        | âœ—    | âœ—       | âœ“         | âœ“         |
| Auto-offers                 | `auto_offer`             | âœ—    | âœ—       | âœ“         | âœ“         |
| Offers (incoming)           | `offers`                 | âœ—    | âœ“       | âœ“         | âœ“         |
| Messages                    | `messages`               | âœ—    | âœ“       | âœ“         | âœ“         |
| Shop Designer               | `shop_designer`          | âœ—    | âœ“       | âœ“         | âœ“         |
| Dead Stock                  | `dead_stock`             | âœ—    | âœ“       | âœ“         | âœ“         |
| Restocker                   | `restocker`              | âœ—    | âœ—       | âœ—         | âœ“         |
| Price Drops (auto-markdown) | `auto_markdown`          | âœ—    | âœ—       | âœ—         | âœ“         |

**Note:** the JSON feature key for auto-offers is `auto_offer` (singular), not `auto_offers`. Match the key exactly when reading - typos silently fail as "feature absent" = disabled.

**Free is a fallback, not a plan.** The product model is a 14-day Starter trial (card required) followed by a paid plan; there is no advertised free tier. The `free` row exists so signed-in users with no `subscriptions` row (never trialed, or trial expired without a card) resolve to a concrete tier config. Its metered limits are all 0, so bot / crosslist / relist actions surface the upgrade prompt while manual listing management keeps working. The extension additionally fails closed for signed-out users (see the extension repo's `docs/technical/ENTITLEMENTS.md`).

## Changing caps without a deploy

Admins can edit existing caps and toggle existing feature flags from the admin console (`/admin/tiers` and `/admin/flags`, audit-logged). Introducing a brand-new key is still a SQL-editor operation:

```sql
UPDATE tier_limits
SET limits = jsonb_set(limits, '{crosslists_per_month}', '5000'::jsonb)
WHERE tier_id = 'pro' AND version = 1;
```

Within ~60s (Next.js revalidate) the pricing page shows the new cap. Within 1h (extension cache TTL) every installed extension picks it up.

## Grandfathering

Each user has a `tier_version` on their `subscriptions` row. Existing users stay on v1; new signups can get v2 with different limits.

**To introduce v2:**

```sql
INSERT INTO tier_limits (tier_id, version, features, limits, effective_from)
VALUES ('pro', 2, '{...}'::jsonb, '{...}'::jsonb, NOW());
```

Then point new signups at v2 while existing Pro users keep v1. If you want to migrate everyone forward, batch-update `subscriptions.tier_version`.

## Custom / bespoke tiers

For partnership deals or support staff comps, create a tier_id like `pro_custom_acme`:

```sql
INSERT INTO tier_limits (tier_id, version, features, limits) VALUES
('pro_custom_acme', 1, '{...}'::jsonb, '{...}'::jsonb);
```

Then set `subscriptions.tier_id = 'pro_custom_acme'` for that user - either from the admin console (`/admin/users` detail drawer, "Edit subscription"; custom tiers show up automatically because the form lists active `tier_limits` rows) or via SQL. All the same gating code works.

## Shared types (keep in sync with extension)

`lib/types/tiers.ts` defines:

- `TierId` - union of tier IDs (`free | starter | pro | business | ...`)
- `TierConfig` - row shape
- `GateResult` - return shape of `checkFeature()` / `preflightMetered()` / `consumeMetered()`
- `FeatureKind` - `'boolean' | 'metered' | 'quota'`

When this repo's `tiers.ts` diverges from the extension's `src/entitlements/types.ts`, either copy-paste or publish as an npm package. No tooling enforces it yet - be disciplined.

## Gotchas

- **Period key must be derived at call time**, not cached - users crossing midnight or month boundaries need a fresh key
- **Supabase `auth.uid()` returns null if called without a session** - the RPC raises `'not authenticated'` in that case
- **Adding a limit key to a live tier requires a jsonb_set**, not `UPDATE`, or you'll wipe the other keys
- **Storage bytes are a number in the jsonb limit** - website formats as GB for display, extension compares as bytes
- **Don't hardcode tier IDs in enforcement code** - always look up via `tier_limits`. Code should treat `pro_custom_acme` the same as `pro`.

## Trial abuse safeguards (006_trial_abuse_guards.sql)

Trial eligibility is checked in `create-checkout-session` and is denied when ANY of:

- the user has any prior `subscriptions` row (original rule, unchanged)
- any Depop/Vinted account the user has EVER linked appears in `trial_history` - permanent, hashed tombstones written whenever a platform account coexists with a billed user (both link-then-subscribe and subscribe-then-link orderings are covered by triggers). Tombstones deliberately have no FK to `auth.users`, so deleting the account does not reset them. The eligibility check joins `trial_history` against `link_history`, an append-only record of every platform account a user has linked, NOT against currently-linked accounts - otherwise unlinking before checkout would evade the gate.
- the account email is on the disposable-domain blocklist (`supabase/functions/_shared/disposable-domains.ts`, mirrored at `lib/auth/disposable-domains.ts`)

`linked_accounts` also has `UNIQUE (platform, platform_user_id)`: one platform account can only be linked to one SaleLinx account at a time, and a BEFORE INSERT OR UPDATE trigger rejects linking an already-trialed platform account to a trial-only user (`platform_account_already_trialed`). Paying and lapsed-paid users are never blocked from linking. The rejection is skipped when `link_history` already records the same (user, platform account) pair: a trial user who unlinks and re-links their own shop mid-trial is not a farmer, and the tombstone their first link wrote must not block them. A farmer's fresh account has no such history, so the guard still fires for the real attack.

## Concurrent-device cap (008_device_sessions.sql)

Account sharing is capped by simultaneous ACTIVE use, not by logins: the extension heartbeats `claim_device_session(device_id)` while its panel is in use, and a claim is denied when other devices were active in the last 10 minutes beyond the tier's cap (`limits->>'max_active_devices'`, default 1 for every tier; raise per tier via jsonb_set if a multi-device allowance is ever sold). Denied devices show a gate with a "Use here instead" takeover that evicts the stalest active device. Rows live in `device_sessions` (user-readable, RPC-writable only, 30-day self-pruning).
