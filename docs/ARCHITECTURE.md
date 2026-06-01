# System architecture

High-level map of the whole SaleLinx system. Read this first if you're
new to the project or starting a cross-cutting task.

For deeper dives, each section links to a subordinate doc.

## The product

SaleLinx is a **Chrome extension that automates listing workflows on
Depop and Vinted** - crosslisting, relisting, refreshing, following,
auto-offers, and restocking. Users install it from the Chrome Web Store,
sign in, link their Depop / Vinted shop, and the bot runs actions from
their browser.

The business model is **subscription SaaS** (Free / Starter / Pro /
Business monthly plans) plus per-feature usage caps enforced by the
extension.

## Two repositories, one Supabase project

| Repo                             | Role                                                                                             | Distributed as                                    |
| -------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------- |
| `resale-bot-web` (this repo)     | Marketing site, auth UI, Stripe billing, user account dashboard, Edge Functions                  | Vercel deploy - web URL                           |
| `muiltiplatform-seller-bot`      | Chrome MV3 extension - content scripts, background worker, Depop/Vinted automation, linking UX   | Webpack-built `dist/` → zip → Chrome Web Store    |

**Both point at the same Supabase project** - one user pool, one auth
store, one DB. A user created via the website is the same user the
extension sees, and vice versa.

```
┌──────────────────────────┐     ┌──────────────────────────┐
│  resale-bot-web (Vercel) │     │  Extension (Chrome)      │
│  Next.js App Router      │     │  MV3 service worker +    │
│  pricing / account / ... │     │  content scripts         │
└──────────┬───────────────┘     └──────────┬───────────────┘
           │                                │
           │      single Supabase project   │
           │                                │
           ▼                                ▼
     ┌──────────────────────────────────────────────────┐
     │  Postgres + GoTrue (auth) + Edge Functions       │
     │  ↑ schema owned by the extension repo (for now)  │
     └──────────────────────────────────────────────────┘
                        │
                        ▼  (webhook events only)
                      Stripe
```

## What each repo owns

### Website (`resale-bot-web`) owns

- Public marketing page (`/features` - one page that hosts features, pricing, and roadmap as scroll-linked sections)
- Legal pages (`/legal/*`)
- Product content surfaces (`/docs`, `/docs/status`, `/docs/changelog`, `/faq`)
- Redirect stubs (`/pricing` -> `/features#pricing`, `/roadmap` -> `/features#roadmap`) so old links and Stripe `cancelUrl` keep working
- Email/password auth UI (`/auth/*`) - Supabase Auth does the work
- Account dashboard (`/account`) - current tier, manage subscription
- **Stripe integration** - Checkout session, Customer Portal, webhook (all in `supabase/functions/`)
- Server-rendered tier cards in the `/features#pricing` section (reads `tier_limits` from Supabase)
- **Support hub** (`/account/support`) - user-facing: new-ticket form + the user's own thread. The extension only files + reads.
- **Admin console** (`/admin`) - internal staff tool, a top-level non-localized route subtree with its own shell (escapes the marketing chrome), gated to `admin_users`. First module is support management; built to grow. See `docs/ADMIN.md` for the routing and security model.
- Edge Functions: `stripe-webhook`, `create-checkout-session`, `create-portal-session`, `send-auth-email`, `send-support-email`

### Extension (`muiltiplatform-seller-bot`) owns

- Chrome MV3 manifest + service worker
- Depop/Vinted content scripts (scraping, action dispatch)
- Shop linking flow (OAuth-style handshake to link platform accounts)
- Bot runtime (action queue, delay/backoff, retry, cancellation)
- Per-user feature enforcement (`tryConsume`, `check`, `checkQuota`)
- **Supabase migrations** for the entire schema - including tables the website reads
- Extension-facing cloud sync for listings

### Shared contracts (keep in sync - nothing enforces this)

| Contract                                  | Where                                                                     |
| ----------------------------------------- | ------------------------------------------------------------------------- |
| `TierId` union + `TierConfig` type        | `resale-bot-web/lib/types/tiers.ts` ↔ `muiltiplatform-seller-bot/src/entitlements/types.ts` |
| `tier_limits.features` / `limits` keys    | JSON keys referenced by both repos (e.g. `auto_offer`, `crosslists_per_month`) |
| Stripe price metadata                     | `tier_id` + `billing_cycle` on each Stripe Price - the webhook maps to `subscriptions.tier_id` |
| Stripe API version `2025-02-24.acacia`    | Pinned in `supabase/functions/*` - bump all or none                       |

## Database tables and who writes to them

All in the shared Supabase project. Migrations live in the extension
repo (`supabase/migrations/`).

| Table                    | Read by            | Written by                                    | Purpose                                                                 |
| ------------------------ | ------------------ | --------------------------------------------- | ----------------------------------------------------------------------- |
| `auth.users`             | both               | Supabase Auth (email/password, magic link)    | User identity                                                           |
| `tier_limits`            | both               | SQL migrations only                           | Tier definitions - features (bool) and limits (numeric caps)            |
| `subscriptions`          | both               | `stripe-webhook` Edge Function (service role) | Per-user billing state - tier, status, period end, cancel_at_period_end |
| `usage_counters`         | both               | `increment_usage_counter` RPC (extension)     | Per-user/feature/period counters - monthly or daily buckets             |
| `listings`               | extension only     | extension                                     | Cached listing state for crosslist / relist / refresh                   |
| `linked_accounts`        | extension only     | extension                                     | Maps Supabase user → Depop/Vinted shop IDs                              |
| `platform_credentials`   | extension only     | extension (encrypted)                         | Encrypted platform session tokens                                       |
| `user_settings`          | extension only     | extension                                     | Per-user bot timing preferences                                         |
| `support_tickets`        | both               | both (web + extension) + `stripe-webhook` n/a | Support tickets - bug / feature / feedback, status, diagnostics         |
| `support_ticket_replies` | both               | both (web users + web admins)                 | Ticket conversation thread; `is_admin` flag stamped server-side         |
| `admin_users`            | both               | SQL/dashboard only                            | Support-admin membership; backs `is_admin()` RLS helper                 |

See `docs/ENTITLEMENTS.md` for the entitlement model (features, limits,
quotas, grandfathering via `tier_version`).

## End-to-end user journey

```
1. User lands on the website → /pricing
2. Clicks Subscribe on Pro → /auth/signup (if not signed in)
   Supabase sends verification email → user verifies
3. Clicks Subscribe again → SubscribeButton calls
   create-checkout-session Edge Function → redirect to Stripe Checkout
4. User pays (test card 4242...) → Stripe fires checkout.session.completed
5. stripe-webhook Edge Function inserts subscriptions row with tier_id=pro
6. User redirected to /account?checkout=success - sees Pro tier active
7. User installs Chrome extension from Web Store
8. Extension boots, asks user to sign in → reuses existing Supabase session
9. Extension links Depop/Vinted shop (writes to linked_accounts)
10. User hits Crosslist → extension calls increment_usage_counter RPC
    → checks count against tier_limits.limits.crosslists_per_month
    → allows or blocks
11. User clicks Manage subscription on /account
    → create-portal-session Edge Function → Stripe Customer Portal
    → cancel/upgrade → webhook updates subscriptions row
```

## Entitlement enforcement - who decides what

**The extension is the enforcement point.** The website displays the
tier a user is on but doesn't block actions. Bot actions happen in
the browser, so the extension is the only place that can block them.

Flow per-action in the extension:

1. Look up the current user's `subscriptions.tier_id` (cached, refreshed periodically)
2. Look up the matching `tier_limits` row by `(tier_id, tier_version)`
3. For a **boolean feature** (e.g. `restocker`), check `features[key] === true`
4. For a **metered limit** (e.g. `crosslists_per_month`), call `increment_usage_counter` RPC and compare the returned count against `limits[key]`
5. Allow or return a gated reason (`feature_disabled`, `limit_exceeded`, etc.)

The website can look up the same data (it uses `tier_limits` to render
the pricing grid and `subscriptions` + `usage_counters` on `/account`),
but it never gates anything - there's nothing to gate.

## Billing architecture

Pre-Stripe-UI-free-by-design: we don't build card fields. All payment
UI is Stripe-hosted (Checkout + Customer Portal).

```
/pricing
  ▼ SubscribeButton POST
create-checkout-session (Edge Function, verifies user JWT in-handler)
  ▼
stripe.checkout.sessions.create({ mode: 'subscription',
                                  client_reference_id: user.id })
  ▼ redirect user to session.url
Stripe hosts the payment page
  ▼ user pays
Stripe redirects to successUrl + fires checkout.session.completed
  ▼
stripe-webhook (verify_jwt=false, Stripe-Signature verified with whsec_...)
  ▼
supabase.from('subscriptions').upsert({ ... })
```

See `docs/STRIPE.md` + `docs/EDGE-FUNCTIONS.md`.

## Tech stack at a glance

| Concern          | Website                            | Extension                                  |
| ---------------- | ---------------------------------- | ------------------------------------------ |
| Language         | TypeScript strict                  | TypeScript strict                          |
| Framework        | Next.js 16 App Router              | Chrome MV3 + Webpack                       |
| UI               | React 19 + Tailwind 4              | Mostly vanilla DOM + React panels          |
| Tests            | (not yet)                          | Vitest                                     |
| Auth client      | `@supabase/ssr`                    | `@supabase/supabase-js`                    |
| Stripe           | Edge Functions only (no Node-side) | None (never calls Stripe)                  |
| Deploy           | Vercel (`main` → prod)             | Chrome Web Store (manual upload of `dist/`)|

## Deployment targets

- **Website** - Vercel. Push to `main` → auto-deploy. Env vars set in Vercel dashboard.
- **Edge Functions** - deployed to Supabase via Dashboard (paste) or CLI (`supabase functions deploy <name>`). Secrets set via `supabase secrets set`.
- **Migrations** - applied to Supabase via Dashboard SQL Editor or CLI (`supabase db push`). Source of truth: `muiltiplatform-seller-bot/supabase/migrations/`.
- **Extension** - `npm run build` in the extension repo → zip `dist/` → upload to Chrome Web Store developer dashboard. Users get the new version via Chrome's auto-update.

## Environments

Right now: **one Supabase project, one Stripe account (in Test mode)**.
When going live, the moves are:

1. Switch Stripe to Live mode, create live-mode Products + Prices, get a live `sk_live_...`
2. Create a new Stripe webhook destination pointing at the same Edge Function URL
3. Update Edge Function secrets: `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`
4. Update `.env.local` (and Vercel env): swap `NEXT_PUBLIC_STRIPE_PRICE_*` to the live price IDs
5. No DB migration needed - same Supabase project serves both modes (Stripe events are segmented by mode)

A separate staging Supabase project would be nicer but costs more; we haven't
split yet.

## Related docs

- `docs/OVERVIEW.md` - web-repo stack, folder layout, env vars
- `docs/AUTH.md` - signup / login / reset flows
- `docs/ENTITLEMENTS.md` - tier system, gating rules, period keys, grandfathering
- `docs/STRIPE.md` - billing flow, webhook events, test cards
- `docs/EDGE-FUNCTIONS.md` - Deno functions, deploy, secrets, gotchas
- `../muiltiplatform-seller-bot/docs/ARCHITECTURE.md` - deep dive on the extension itself (content scripts, bot runtime, linking flow)
