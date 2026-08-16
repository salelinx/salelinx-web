# Overview

Marketing site, auth, and subscription management for the SaleLinx Chrome extension.

Companion to the extension repo at `../salelinx-app`. Both share a **single Supabase project** so users are one pool.

## Stack

| Layer     | Tech                              | Why                                                           |
| --------- | --------------------------------- | ------------------------------------------------------------- |
| Framework | Next.js 16 App Router             | Server components, middleware (`proxy.ts`), built-in routing  |
| UI        | React 19 + Tailwind 4             | No component library - utility CSS is enough for a small site |
| Auth + DB | Supabase (`@supabase/ssr`)        | Same project as the extension; users are one pool             |
| Billing   | Stripe Checkout + Customer Portal | Off-the-shelf subscription UX; webhooks sync to Supabase      |
| Hosting   | Vercel                            | One repo → one project, automatic preview deploys             |
| Email     | Resend (via Supabase Send Email Hook) | Auth emails (signup, recovery, magic link, email change) rendered in `send-auth-email` Edge Function and delivered by Resend |

## Request lifecycle (signed-in user hitting `/account`)

```
browser ──▶ Vercel
  ▼
proxy.ts (refreshes Supabase auth cookies)
  ▼
app/account/page.tsx (Server Component)
  ▼
lib/supabase/server.ts (reads cookies, creates server client)
  ▼
Supabase (auth.users + subscriptions + usage_counters)
  ▼
React stream ──▶ browser
```

**Key rule:** Server Components use `lib/supabase/server.ts`. Client Components use `lib/supabase/client.ts`. Never cross the boundary.

## Folder map

```
app/
├── page.tsx                 Landing
├── features/                Single page hosting Features + Pricing + Roadmap (tabs scroll to #features, #pricing, #roadmap). Tiers rendered from tier_limits.
├── pricing/                 Redirect stub -> /features#pricing (keeps Stripe cancelUrl compatibility)
├── roadmap/                 Redirect stub -> /features#roadmap
├── auth/
│   ├── login/               Password login
│   ├── signup/              Password signup
│   ├── forgot-password/
│   ├── reset-password/
│   ├── callback/            OAuth code exchange (route handler, not a page)
│   └── signout/             POST → sign out + redirect
├── account/                 Protected dashboard
├── docs/                    Product docs (MDX) - learning-oriented guides
│   ├── page.tsx             Landing: search, task pills, category grid, status, What's new, FAQ cross-link
│   ├── [category]/          Category index
│   ├── [category]/[slug]/   Article route
│   ├── status/              Marketplace status page
│   └── changelog/           Release notes
├── faq/                     Frequently asked questions - accordion Q&A
└── legal/                   ToS + Privacy

app/admin/                   Internal staff console. TOP-LEVEL (sibling of [locale], NOT localized);
                             owns its own <html>/theme/shell so it escapes the marketing chrome.
                             Gated to admin_users. First module: support. See docs/ADMIN.md.

components/                  Shared React components (Header, VerifyEmailBanner, …)
components/admin/            Admin console components (AdminSidebar, support/AdminTicketTable, …)
components/docs/             Docs-only components (Sidebar, CategoryCard, DocsSearch, MDX widgets)
components/features/         FeaturesSection / PricingSection / RoadmapSection (stacked on /features)

content/docs/                MDX article source, filed by <category>/<slug>.mdx
content/changelog/           MDX release notes, filed by <date>-<slug>.mdx

scripts/build-docs-index.mjs Builds public/docs/search-index.json (predev + prebuild)

lib/
├── supabase/
│   ├── client.ts            Browser client
│   ├── server.ts            Server Component client
│   └── tier-config.ts       Reads tier_limits rows
├── docs/                    Article manifest, helpers, marketplace status, changelog
├── stripe.ts                Stripe server SDK init
└── types/tiers.ts           TierConfig / GateResult (synced with extension)

supabase/
├── config.toml              CLI config
└── functions/               Edge Functions (Deno, not Node)

proxy.ts                     Next.js 16 middleware - refreshes auth cookies
middleware.ts                (Deprecated in Next 16 - don't recreate this file)
```

## Environment variables

### Website (`.env.local`)

All defined in `.env.example`. Public-only by design - the website has no server-side Stripe calls; all Stripe work lives in Edge Functions.

| Var                                  | Used by         | Notes                                                            |
| ------------------------------------ | --------------- | ---------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`           | client + server | Same as the extension's Supabase project                         |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`      | client + server | Anon key, not service role                                       |
| `NEXT_PUBLIC_STRIPE_PRICE_STARTER`   | client          | `price_...` for Starter monthly. Swap test↔live without redeploy |
| `NEXT_PUBLIC_STRIPE_PRICE_PRO`       | client          | `price_...` for Pro monthly                                      |
| `NEXT_PUBLIC_STRIPE_PRICE_BUSINESS`  | client          | `price_...` for Business monthly                                 |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | client          | Unused today, kept for future Stripe Elements                    |
| `NEXT_PUBLIC_EXTENSION_ID`           | client          | Chrome extension deep-link target (blank pre-launch)             |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID`      | client          | GA4 Measurement ID (`G-...`). Blank disables the cookie banner and GA entirely; when set, GA loads only after consent (`components/CookieConsent.tsx`) |

### Edge Functions (set via `supabase secrets set`, NOT in `.env.local`)

| Var                         | Source                                             |
| --------------------------- | -------------------------------------------------- |
| `STRIPE_SECRET_KEY`         | https://dashboard.stripe.com/test/apikeys          |
| `STRIPE_WEBHOOK_SECRET`     | `stripe listen` output or Stripe webhook dashboard |
| `SUPABASE_URL`              | Auto-injected                                      |
| `SUPABASE_ANON_KEY`         | Auto-injected                                      |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-injected                                      |

## Database schema ownership

**Supabase migrations live in this repo** (`supabase/migrations/`). The extension reads the same database but no longer owns schema. The folder is a consolidated baseline of 6 files; see `supabase/migrations/README.md` for what maps where and how to apply.

Relevant tables:

| Table            | Purpose                                                               |
| ---------------- | --------------------------------------------------------------------- |
| `auth.users`     | Supabase-managed; one row per user                                    |
| `tier_limits`    | Tier definitions, data-driven caps                                    |
| `usage_counters` | Per-user, per-feature, per-period counters (written via RPC only)     |
| `subscriptions`  | Stripe sub state per user - written by `stripe-webhook` Edge Function |
| `listings`       | Extension-owned, not relevant here                                    |

See `docs/ARCHITECTURE.md` for a full table-ownership map including extension-only tables.
See `docs/ENTITLEMENTS.md` for how `tier_limits` and `usage_counters` are used.

## Deployment

- **Website** - push to `main` → Vercel auto-deploys
- **Edge Functions** - `supabase functions deploy <name>` from this repo
- **Migrations** - run from this repo (`supabase/migrations/`) via Dashboard SQL editor or Supabase CLI

## Related docs

- `docs/AUTH.md` - signup / login / reset flows
- `docs/ENTITLEMENTS.md` - tier system
- `docs/STRIPE.md` - billing flow
- `docs/EDGE-FUNCTIONS.md` - Deno functions deployed to Supabase
