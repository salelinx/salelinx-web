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
app/[locale]/account/page.tsx (Server Component)
  ▼
lib/supabase/server.ts (reads cookies, creates server client)
  ▼
Supabase (auth.users + subscriptions + usage_counters)
  ▼
React stream ──▶ browser
```

**Key rule:** Server Components use `lib/supabase/server.ts`. Client Components use `lib/supabase/client.ts`. Never cross the boundary.

## Locales

Six locales ship: `en`, `fr`, `es`, `de`, `ar`, `zh`.

`ar` and `zh` are only partly translated. Their UI strings (`messages/`) and FAQ (`lib/faq/data.*.tsx`) are done, but the long-form docs and changelog are not, so `ARTICLE_MODULES_BY_LOCALE` and `CHANGELOG_MODULES_BY_LOCALE` map them to the English articles and `build-docs-index.mjs` falls back to the English search records. To finish either language, add `content/docs/<locale>/` and `content/changelog/<locale>/` and point those two maps at the new imports; nothing else changes.

`ar` is right to left. `dirForLocale()` in `lib/i18n/locales.ts` drives the `dir` attribute on `<html>`. Use logical Tailwind utilities (`text-start`, `ms-auto`, `end-0`) in anything localized, not `text-left`/`ml-auto`/`right-0`, or it will not mirror. The hero demo panel is deliberately pinned `dir="ltr"`: it mockups the extension's own left-to-right UI.

## Locale detection

A visitor with no locale in the URL gets one predicted for them, in this order:

1. `NEXT_LOCALE` cookie - a previous explicit choice from the language switcher, so it always wins.
2. `Accept-Language` - the languages set in their browser. Handled by next-intl.
3. Country - only when steps 1 and 2 name nothing we publish. `proxy.ts` reads Vercel's `x-vercel-ip-country` and maps it through `lib/i18n/geo.ts`.

Step 3 is a fallback on purpose: browser language is what someone chose, country is only where they are, and the two disagree often (an English speaker living in Berlin). The country map skips places with no single dominant language among our four (Belgium, Switzerland, Canada). `x-vercel-ip-country` is absent in local dev, so step 3 only ever fires in production; send the header by hand with curl to test it.

## Folder map

```
app/[locale]/                Every user-facing route is localized (next-intl).
├── page.tsx                 Landing
├── features/                Single page hosting Features + Pricing + Roadmap (tabs scroll to #features, #pricing, #roadmap). Tiers rendered from tier_limits.
├── pricing/                 Redirect stub -> /features#pricing (keeps Stripe cancelUrl compatibility)
├── roadmap/                 Redirect stub -> /features#roadmap
├── auth/
│   ├── login/               Password login
│   ├── signup/              Password signup
│   ├── forgot-password/
│   ├── reset-password/
│   ├── confirm/             Signup / recovery verifyOtp landing
│   ├── mfa/                 TOTP challenge (admin AAL2)
│   └── link-error/          Expired or already-used auth link
├── account/                 Protected dashboard
│   ├── tickets/             Ticket history + reply
│   └── delete-confirm/      GDPR self-serve deletion confirm landing
├── docs/                    Product docs (MDX) - learning-oriented guides
│   ├── page.tsx             Landing: search, task pills, category grid, status, What's new, FAQ cross-link
│   ├── [category]/          Category index (+ [slug]/ article route)
│   ├── status/              Marketplace status page
│   └── changelog/           Release notes
├── help/                    Support hub
│   ├── page.tsx             Public /help landing
│   ├── faq/                 FAQ under the help hub
│   └── support/             Login-gated contact form (create a ticket)
├── faq/                     Frequently asked questions - accordion Q&A
├── invited/                 Referral invite landing (/r/CODE redirects here)
├── legal/                   ToS + Privacy
└── [...rest]/               Locale-scoped catch-all 404

Top-level (NOT localized - siblings of [locale]):

app/auth/callback/           OAuth code exchange (route handler, not a page)
app/auth/signout/            POST -> sign out + redirect
app/r/[code]/                Referral share links; must stay in proxy.ts's skipIntl allowlist
app/admin/                   Internal staff console. Owns its own <html>/theme/shell so it
                             escapes the marketing chrome. Gated to admin_users via is_admin()
                             (AAL2). See docs/ADMIN.md.

components/                  Shared React components (Header, VerifyEmailBanner, …)
components/admin/            Admin console components (AdminSidebar, support/AdminTicketTable, …)
components/docs/             Docs-only components (Sidebar, CategoryCard, DocsSearch, MDX widgets)
components/features/         FeaturesSection / PricingSection / RoadmapSection (stacked on /features)

content/docs/                MDX article source, filed by <category>/<slug>.mdx
content/changelog/           MDX release notes, filed by <date>-<slug>.mdx

assets/fonts/                Geist TTF instances for the generated Open Graph images
                             (next/og needs raw font data; see the README there)

scripts/build-docs-index.mjs Builds public/docs/search-index.json (predev + prebuild)

lib/
├── supabase/
│   ├── client.ts            Browser client
│   ├── server.ts            Server Component client
│   ├── admin.ts             Service-role client (admin console reads)
│   ├── subscription.ts      Current subscription / usage reads
│   ├── referrals.ts         Referral RPC wrappers
│   └── tier-config.ts       Reads tier_limits rows (cached + uncached variants)
├── docs/                    Article manifest, helpers, marketplace status, changelog
├── faq/                     FAQ entries, one data file per locale (data.en.tsx, .fr, .es, .de)
├── admin/                   Admin-console helpers (reauth, period, usage caps, formatting)
├── i18n/locales.ts          Supported locales
├── site.ts                  pageMetadata() - canonical/hreflang/OG builder for public pages; pass contentLocales for pages whose body is not translated into every locale (English-only legal pages, docs in ar/zh) so fallback locales canonicalize to the default-locale URL instead of claiming hreflang, and segmentOgImage on pages whose route segment ships an opengraph-image.tsx (docs articles) so the generated image is not shadowed by the generic /og.png
└── types/tiers.ts           TierConfig / GateResult (synced with extension)

There is no server-side Stripe client here: all Stripe code lives in supabase/functions/.

supabase/
├── config.toml              CLI config
├── migrations/              Schema (this repo owns it)
└── functions/               Edge Functions (Deno, not Node)

i18n/                        next-intl request config + routing
messages/                    UI translation catalogs, one JSON per locale

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

**Supabase migrations live in this repo** (`supabase/migrations/`). The extension reads the same database but no longer owns schema. The folder is a consolidated baseline (`001`-`006`) plus the incremental migrations added since; see `supabase/migrations/README.md` for what maps where and how to apply.

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
