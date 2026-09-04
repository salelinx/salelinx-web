# salelinx-web

Marketing site, product docs, auth, subscription billing, referral program, and admin console for the SaleLinx Chrome extension.

Companion to the extension repo at `../salelinx-app`. Both share a single Supabase project so users are one pool. This repo owns the database schema (`supabase/migrations/`) and the Edge Functions; the extension reads the same database.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript strict
- Tailwind CSS 4
- next-intl - every public page localized in en / fr / es / de (`app/[locale]/`, strings in `messages/`)
- Supabase Auth (email + password, and Google OAuth) + Supabase Postgres
- Stripe Checkout + Customer Portal
- MDX for docs articles and the changelog (`content/`)
- Resend (all transactional email: auth, support, shipping labels)
- Vercel (hosting)

## First-time setup

```bash
npm install
cp .env.example .env.local    # fill in the values
npm run dev
```

Open http://localhost:3000.

## Supabase config required

Configure these in the Supabase dashboard before signup/login will work end-to-end.

### URL configuration (Authentication -> URL Configuration)

| Setting       | Value                                                                                                   |
| ------------- | ------------------------------------------------------------------------------------------------------- |
| Site URL      | `http://localhost:3000` (dev) or your production domain                                                 |
| Redirect URLs | `http://localhost:3000/auth/callback` + `http://localhost:3000/auth/callback?next=/auth/reset-password` |

### Providers (Authentication -> Providers)

| Setting                | Recommended |
| ---------------------- | ----------- |
| Enable Email provider  | ON          |
| Confirm email          | ON          |
| Secure email change    | ON          |
| Secure password change | ON          |
| Google provider        | ON (client ID + secret from Google Cloud Console) |

### Password requirements (Authentication -> Policies)

Raise minimum length to **8 characters** to match the client-side validation.

### Auth emails via Resend (Authentication -> Hooks -> Send email hook)

Auth emails (signup, recovery, magic link, email change) are sent through the `send-auth-email` Edge Function, which renders templates and hands them to Resend. This bypasses Supabase's built-in SMTP entirely (default SMTP is rate-limited to 2 emails/hour). Verification links land on our own `/auth/confirm` page and verify on a button press, so inbox link-scanners cannot burn the token (see `docs/AUTH.md`).

One-time setup:

1. Verify a sending domain in Resend (adds SPF/DKIM DNS records).
2. Create a Resend API key with Sending access.
3. Deploy the function and set secrets (see `docs/EDGE-FUNCTIONS.md`):
   ```bash
   supabase functions deploy send-auth-email
   supabase secrets set RESEND_API_KEY=re_...
   supabase secrets set RESEND_FROM='SaleLinx <no-reply@yourdomain.com>'
   supabase secrets set SEND_EMAIL_HOOK_SECRET='v1,whsec_...'
   ```
4. In the dashboard: Authentication -> Hooks -> **Send email hook** -> HTTPS -> point at `https://<project-ref>.supabase.co/functions/v1/send-auth-email`. Copy the revealed signing secret into `SEND_EMAIL_HOOK_SECRET` above.

Once the hook is enabled, the Supabase SMTP panel becomes irrelevant - the hook owns every auth email.

### Migrations

All DB schema lives in this repo under `supabase/migrations/` - a consolidated baseline of 14 topical files (core schema, billing, support, storage quota, release notes, trial-abuse guards, referrals, device sessions, admin console, telemetry, status overrides, self-tests, uninstall feedback, crash health), squashed September 2026 and verified byte-identical to the incremental history. Apply the files in numeric order via the Supabase dashboard SQL editor; the folder's README tracks what is already applied to the live project. For billing specifically, `002_billing_tiers.sql` creates `subscriptions`, `tier_limits`, `usage_counters` and seeds the tiers.

## Directory layout

```
app/
├── [locale]/                All public pages, localized via next-intl
│   ├── page.tsx             Landing
│   ├── features/            Features + pricing + roadmap (one page with anchor sections)
│   ├── pricing/, roadmap/, faq/   One-line redirect() stubs to /features anchors and /help/faq
│   ├── docs/                Product docs (MDX): [category]/[slug] articles, status/, changelog/
│   ├── help/                Help hub: faq/ (accordion Q&A) + support/ (contact)
│   ├── invited/             Referral landing page for invited users
│   ├── account/             Protected dashboard: subscription, security (MFA), referrals,
│   │                        tickets/, delete-confirm/ (GDPR self-serve deletion)
│   ├── auth/                login, signup (password + Google), forgot-password, reset-password,
│   │                        confirm (button-press email verification), mfa, link-error
│   └── legal/               ToS + Privacy
├── auth/
│   ├── callback/            OAuth / code exchange route handler
│   └── signout/             POST handler -> sign out + redirect
├── admin/                   Admin console (MFA-gated): users, subscriptions, tiers, usage,
│                            storage, support, flags, audit
└── r/                       /r/CODE referral share links (sets the slx_ref cookie)

components/
├── Header.tsx, Footer.tsx, MobileMenu.tsx, LanguageSwitcher.tsx, ThemeToggle.tsx
├── CookieConsent.tsx        Consent banner - the ONLY place Google Analytics may load
├── auth/                    Login/signup forms, GoogleSignInButton
├── features/, home/         Landing + features/pricing/roadmap section components
├── docs/                    Docs-only components (sidebar, search, cards, MDX widgets)
├── faq/, roadmap/, support/, admin/, legal/
└── Account cards: ManageSubscriptionButton, AccountSecurityCard, ReferralsCard,
    DeleteAccountCard, VerifyEmailBanner, ...

content/
├── docs/<category>/*.mdx    Docs article source
└── changelog/*.mdx          Release notes (one file per version, all four locales)

messages/                    next-intl UI strings: en.json, fr.json, es.json, de.json
i18n/                        next-intl routing, navigation, request config

scripts/
└── build-docs-index.mjs     Generates public/docs/search-index.json (runs on predev + prebuild)

mdx-components.tsx           @next/mdx component registry (must live at repo root)

lib/
├── supabase/                client, server, admin, tier-config, subscription, referrals
├── stripe.ts                Stripe server SDK init
├── site.ts                  pageMetadata() helper - all public pages build metadata through it
├── docs/                    Article manifest, helpers, status, changelog
├── faq/, roadmap/, admin/, auth/, i18n/
├── referral-discount.ts
└── types/tiers.ts           Shared with extension - copy-paste sync

supabase/
├── config.toml              Supabase CLI config for deploying functions
├── migrations/              Schema for the shared project (this repo owns it)
└── functions/               Deno Edge Functions (see below)

proxy.ts                     Next.js 16 middleware - auth cookie refresh, intl routing,
                             referral claims, auth-error forwarding
```

## Commands

| Command                    | What it does                                                |
| -------------------------- | ----------------------------------------------------------- |
| `npm run dev`              | Local dev server (rebuilds the docs search index first)     |
| `npm run build`            | Production build - run before committing to catch TS errors |
| `npm run lint`             | ESLint                                                      |
| `npm run build:docs-index` | Rebuild `public/docs/search-index.json` by hand             |

## Supabase Edge Functions

All functions live in `supabase/functions/` (Deno, not Node) and are deployed via the Supabase CLI:

```bash
supabase link --project-ref <your-project-ref>
supabase functions deploy <name>
```

| Function                   | Purpose                                                             |
| -------------------------- | ------------------------------------------------------------------- |
| `stripe-webhook`           | Syncs Stripe subscription events into the `subscriptions` table     |
| `create-checkout-session`  | Starts Stripe Checkout for a tier                                   |
| `create-portal-session`    | Opens the Stripe Customer Portal                                    |
| `send-auth-email`          | Supabase Auth "Send email hook" -> Resend                           |
| `send-support-email`       | Support ticket notifications, auto-acks, and admin replies          |
| `send-shipping-labels`     | Emails a merged label PDF to the user (called by the extension)     |
| `get-referral-discount`    | Resolves a referral discount for pricing display                    |
| `process-referral-rewards` | Daily cron: grants referral rewards as Stripe balance credits       |
| `resolve-category`         | Depop/Vinted category lookups for the extension's crosslister       |
| `admin-change-plan`        | Admin console: swap a customer's paid Stripe plan                   |
| `admin-delete-user`        | Admin console: GDPR account deletion                                |
| `delete-account`           | Self-serve GDPR deletion from the /account Danger zone              |

Set function secrets (each function only reads the ones it needs):

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
supabase secrets set RESEND_API_KEY=re_...
supabase secrets set RESEND_FROM='SaleLinx <no-reply@yourdomain.com>'
supabase secrets set SEND_EMAIL_HOOK_SECRET='v1,whsec_...'
supabase secrets set SUPPORT_NOTIFY_TO=... SUPPORT_NOTIFY_FROM=... SUPPORT_NOTIFY_HOOK_SECRET=...
supabase secrets set REFERRAL_CRON_SECRET=... REFERRAL_COUPON_ID=...
supabase secrets set DELETE_ACCOUNT_TOKEN_SECRET=... SITE_URL=... ALLOWED_ORIGIN=...
```

See `docs/EDGE-FUNCTIONS.md` for the full deploy + secrets reference.

## Docs

| File                                               | Topic                                                        |
| -------------------------------------------------- | ------------------------------------------------------------ |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)     | Big picture: extension + web + shared Supabase, who owns what |
| [`docs/OVERVIEW.md`](docs/OVERVIEW.md)             | Stack, request lifecycle, folder layout, env vars            |
| [`docs/AUTH.md`](docs/AUTH.md)                     | Signup / login / reset / verify flows, session handling      |
| [`docs/ENTITLEMENTS.md`](docs/ENTITLEMENTS.md)     | `tier_limits` + `usage_counters` system                      |
| [`docs/STRIPE.md`](docs/STRIPE.md)                 | Checkout, webhooks, Customer Portal                          |
| [`docs/EDGE-FUNCTIONS.md`](docs/EDGE-FUNCTIONS.md) | Deno functions, deploy, secrets                              |
| [`docs/ADMIN.md`](docs/ADMIN.md)                   | Admin console, MFA gating, audit log                         |
| [`docs/SUPPORT.md`](docs/SUPPORT.md)               | Support ticket -> email flow, Database Webhooks, threading   |
| [`docs/REFERRALS.md`](docs/REFERRALS.md)           | Referral program: share links, claims, conversions, rewards  |
| [`docs/GDPR.md`](docs/GDPR.md)                     | Data inventory, retention, deletion/export runbooks          |
| [`CLAUDE.md`](CLAUDE.md)                           | AI assistant guide - architecture constraints + gotchas      |
