# Entitlements

Config-driven tier system. **Tier limits live as data in Supabase, not hardcoded.** Change a `tier_limits` row and every client (website + extension) picks it up within the cache TTL.

## Tables

### `tier_limits`

One row per (tier_id, version). Features are boolean flags; limits are numeric caps.

```
tier_id           trial | starter | pro | business
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
period_key    text        -- 'YYYY-MM' for monthly, 'YYYY-MM-DD' for daily,
                          -- 'YYYY-MM-DDTHH' for the server-derived hour series
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

Since migration `016_usage_hour_buckets.sql` the same call also upserts an hour bucket (`YYYY-MM-DDTHH`, UTC, derived from `now()` on the server) for the admin console's hour-resolution usage ranges. The caller-named bucket is still the one caps are enforced against and the one the return value reports; callers cannot name an hour bucket themselves (the shape is rejected). Hour rows are purged after 60 days and sit outside the 2000-row per-user cap. See `docs/ADMIN.md` "Hour buckets".

Since migration `017_usage_events.sql` the call also inserts one row into `usage_events` (user, feature, delta, server timestamp), the source for the admin console's trailing-window presets (last 5 minutes to last 72 hours). Rows live 7 days, at most 2000 per user per rolling hour are recorded, and nothing gates on them. See `docs/ADMIN.md` "Usage events".

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

The extension also writes 23 uncapped ACTIVITY counters (offers, chat replies,
labels, restocker, shop designer, photo edits, cloud saves, ...) through the same
RPC, month-bucketed, purely so the admin console can see which features get used.
`/admin/usage` shows them per user; `/admin/usage/features` aggregates them into
distinct users per feature, by plan, over time. The roster is
`lib/admin/extension-features.ts`; the counter-to-gate map that says which plan
each one needs is in `lib/admin/adoption.ts`.

## Period keys

| Feature kind | Period key format | Example         |
| ------------ | ----------------- | --------------- |
| Monthly      | `YYYY-MM`         | `2026-04`       |
| Daily        | `YYYY-MM-DD`      | `2026-04-17`    |
| Hour series  | `YYYY-MM-DDTHH`   | `2026-09-08T14` |

**Computed by the client, in UTC.** The extension's `getPeriodKey`
(`src/entitlements/gate.ts`) builds the month or day key with `getUTCFullYear` /
`getUTCMonth` / `getUTCDate` and passes it to `increment_usage_counter`, which
writes to whatever key it receives (it validates the shape, not the value). So a
user's period rolls over at UTC midnight, not local midnight. Periods reset
implicitly - a new period key just means a new row.

**The hour series is server-derived.** It is not a feature kind: every call
also lands in the UTC hour bucket of the moment it ran, whichever month or day
key the caller named. Nothing gates on it; it exists for the admin console's
hour-resolution usage ranges and is purged after 60 days.

**Events are not keyed at all.** `usage_events` records the server timestamp of
each call instead of a bucket, so the admin console can answer "last 15
minutes" exactly. Purged after 7 days.

Because the bucket is chosen client-side, anything calling the RPC directly can
name a period nothing reads, and that usage never counts against the current
cap. The extension is the enforcement point and runs in the user's browser, so
this is one bypass route among several rather than a distinct hole. A migration
that derives the key server-side exists in the extension repo but was never
reconciled into this repo's sequence; see `supabase/migrations/README.md` for
what to check before acting on it.

## Seed data (v1)

See migration `002_billing_tiers.sql` (creates `subscriptions`, `tier_limits`, `usage_counters`, plus the `increment_usage_counter` RPC and seeds tier v1 with the full feature set: `account_linking` Pro+, `auto_markdown` Business, `dead_stock` / `shop_designer` / `messages` / `offers` Starter+, `auto_accept_offers` Pro+, `shipping_label_email` Business). Auto-offers (`auto_offer`) stays Pro+. `preset_sync` (the cloud copy of the extension's settings presets; on every live plan including the trial row, off only on the retired free row) was added afterwards by `022_preset_sync_feature.sql`; the extension gates it silently and has no fallback for the key, so this seed alone decides who syncs. Summary:

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
| Auto-refresh                | `auto_refresh`           | ✗    | ✗       | ✓         | ✓         |
| Cloud sync                  | `cloud_sync`             | ✗    | ✗       | ✓         | ✓         |
| Shipping labels             | `shipping_labels`        | ✗    | ✗       | ✓         | ✓         |
| Account linking             | `account_linking`        | ✗    | ✗       | ✓         | ✓         |
| Auto-offers                 | `auto_offer`             | ✗    | ✗       | ✓         | ✓         |
| Offers (incoming)           | `offers`                 | ✗    | ✓       | ✓         | ✓         |
| Messages                    | `messages`               | ✗    | ✓       | ✓         | ✓         |
| Shop Designer               | `shop_designer`          | ✗    | ✓       | ✓         | ✓         |
| Dead Stock                  | `dead_stock`             | ✗    | ✓       | ✓         | ✓         |
| Settings presets sync       | `preset_sync`            | ✗    | ✓       | ✓         | ✓         |
| Restocker                   | `restocker`              | ✗    | ✗       | ✗         | ✓         |
| Price Drops (auto-markdown) | `auto_markdown`          | ✗    | ✗       | ✗         | ✓         |

**Note:** the JSON feature key for auto-offers is `auto_offer` (singular), not `auto_offers`. Match the key exactly when reading - typos silently fail as "feature absent" = disabled.

**There is no free plan, and no fallback tier row.** The product model is a 14-day trial (card required) followed by a paid plan. A signed-in user with no entitled `subscriptions` row - never trialed, cancelled, or a trial that expired - resolves to no tier at all: the extension builds a locked-out blob in code (`LOCKED_OUT` in `utils/cloud/subscription.ts`) carrying `entitled: false`, no features and no limits.

This used to be a zero-limit `free` row in `tier_limits`, and the indirection was a trap. An absent limit key reads as **unlimited** in `preflightMetered`, so if that row had ever gone missing or been renamed, every metered cap would have silently un-gated for exactly the users who had stopped paying. A constant cannot go missing. `entitled: false` is checked before the limits map is trusted, in both `checkFeature` and `preflightMetered`.

The extension additionally fails closed for signed-out users (see the extension repo's `docs/technical/ENTITLEMENTS.md`).

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

## Comp rows expire (021_creator_codes.sql)

A comp row is a `subscriptions` row with no `stripe_subscription_id`: a support comp from `/admin/users`, or a redeemed creator code. Since migration 021, `isSubscriptionEntitled` refuses one whose `current_period_end` has passed.

This only applies to comp rows. On a Stripe-managed row the period end is a renewal date the webhook keeps moving, and enforcing it would lock out paying customers in the gap between a renewal and its webhook landing. Comp rows written before 021 have a null period end and stay open-ended, so nothing already granted changed.

Any caller that wants the rule must select **both** `stripe_subscription_id` and `current_period_end`. A caller that selects neither keeps the old behaviour rather than reading an absent field as "comp row"; that is why `resolve-category` and the extension's `utils/cloud/subscription.ts` both had their selects widened in the same change. The extension caches its subscription blob for up to an hour, so a comp can outlive its end date there by that much.

## Creator codes (021_creator_codes.sql)

One-time codes that comp a tier for a fixed number of months, handed out for creator outreach (the tooling that generates them lives in `Marketing/youtube-research`).

```
code          text PK    -- ^[A-HJ-NP-Z2-9]{8}$, same alphabet as referral codes
tier_id       text       -- FK (tier_id, tier_version) -> tier_limits
tier_version  int
months        int        -- 1 to 12
issued_to     text       -- the channel it went to, for our records
redeemed_by   uuid       -- ON DELETE SET NULL, so an erasure cannot unspend a code
redeemed_at   timestamptz
```

RLS is on with no policies at all: reads would leak unredeemed codes, and the only write path is `redeem_creator_code(p_code)`. That function is `SECURITY DEFINER`, scopes to `auth.uid()`, normalises case and punctuation, and in one transaction inserts a comp row (`status = 'active'`, `current_period_end = NOW() + months`) and marks the code spent.

It refuses a caller who already has a live Stripe subscription (`already_subscribed`). `admin_set_user_subscription` documents why: the next webhook event overwrites a Stripe-managed row, so the comp would evaporate and the code would be gone with it. Those cases go to support by hand. A lapsed or comped row is no obstacle, because the insert adds a newer row and tier resolution prefers the newest entitled one.

Issuing codes is a SQL insert; there is no admin UI for it yet.

## Custom / bespoke tiers

For partnership deals or support staff comps, create a tier_id like `pro_custom_acme`:

```sql
INSERT INTO tier_limits (tier_id, version, features, limits) VALUES
('pro_custom_acme', 1, '{...}'::jsonb, '{...}'::jsonb);
```

Then set `subscriptions.tier_id = 'pro_custom_acme'` for that user - either from the admin console (`/admin/users` detail drawer, "Edit subscription"; custom tiers show up automatically because the form lists active `tier_limits` rows) or via SQL. All the same gating code works.

## Shared types (keep in sync with extension)

`lib/types/tiers.ts` defines:

- `TierId` - union of tier IDs (`trial | starter | pro | business | ...`)
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
