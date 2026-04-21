# resale-bot-web

Marketing site, pricing page, auth, and subscription management for the SaleLinx Chrome extension.

Companion to the extension repo at `../muiltiplatform-seller-bot`. Both share a single Supabase project so users are one pool.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript strict
- Tailwind CSS 4
- Supabase Auth (email + password) + Supabase Postgres
- Stripe Checkout + Customer Portal
- Vercel (hosting)
- Resend (transactional email - configure before launch)

## First-time setup

```bash
npm install
cp .env.example .env.local    # fill in the values
npm run dev
```

Open http://localhost:3000.

## Supabase config required

Configure these in the Supabase dashboard before signup/login will work end-to-end.

### URL configuration (Authentication → URL Configuration)

| Setting       | Value                                                                                                   |
| ------------- | ------------------------------------------------------------------------------------------------------- |
| Site URL      | `http://localhost:3000` (dev) or your production domain                                                 |
| Redirect URLs | `http://localhost:3000/auth/callback` + `http://localhost:3000/auth/callback?next=/auth/reset-password` |

### Email provider (Authentication → Providers → Email)

| Setting                | Recommended |
| ---------------------- | ----------- |
| Enable Email provider  | ON          |
| Confirm email          | ON          |
| Secure email change    | ON          |
| Secure password change | ON          |

### Password requirements (Authentication → Policies)

Raise minimum length to **8 characters** to match the client-side validation.

### Auth emails via Resend (Authentication → Hooks → Send email hook)

Auth emails (signup, recovery, magic link, email change) are sent through the `send-auth-email` Edge Function, which renders templates and hands them to Resend. This bypasses Supabase's built-in SMTP entirely (default SMTP is rate-limited to 2 emails/hour).

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
4. In the dashboard: Authentication → Hooks → **Send email hook** → HTTPS → point at `https://<project-ref>.supabase.co/functions/v1/send-auth-email`. Copy the revealed signing secret into `SEND_EMAIL_HOOK_SECRET` above.

Once the hook is enabled, the Supabase SMTP panel becomes irrelevant - the hook owns every auth email.

### Migrations

Run `011_billing.sql` from the **extension repo** (`../muiltiplatform-seller-bot/supabase/migrations/`). All DB schema lives there - this repo only reads.

## Directory layout

```
app/
├── page.tsx                 Landing
├── features/                Features overview
├── pricing/                 Tiers rendered from Supabase tier_limits
├── docs/                    Product docs (MDX) - learning-oriented guides
│   ├── [category]/[slug]/   Article route
│   ├── status/              Marketplace status page
│   └── changelog/           Release notes
├── faq/                     Frequently asked questions (accordion Q&A)
├── roadmap/                 Public roadmap (Exploring / Building / Shipped)
├── auth/
│   ├── login/               Password login
│   ├── signup/              Password signup
│   ├── forgot-password/     Email entry for reset
│   ├── reset-password/      New password entry
│   ├── callback/            OAuth code exchange
│   └── signout/             POST handler → sign out + redirect
├── account/                 Protected dashboard
└── legal/                   ToS + Privacy

components/
├── Header.tsx               Nav bar with auth state
├── VerifyEmailBanner.tsx    Shown to unverified users on /account
├── docs/                    Docs-only components (sidebar, search, cards, MDX widgets)
├── faq/                     FAQ accordion
└── roadmap/                 Roadmap columns and cards

content/
├── docs/<category>/*.mdx    Docs article source
└── changelog/*.mdx          Release notes

scripts/
└── build-docs-index.mjs     Generates public/docs/search-index.json (predev + prebuild)

mdx-components.tsx           @next/mdx component registry (must live at repo root)

lib/
├── supabase/{client,server,tier-config}.ts
├── stripe.ts                Stripe server SDK init
├── docs/                    Article manifest, helpers, status, changelog
├── faq/                     FAQ data
├── roadmap/                 Roadmap data
└── types/tiers.ts           Shared with extension - copy-paste sync

supabase/
├── config.toml              Supabase CLI config for deploying functions
└── functions/
    ├── stripe-webhook/
    ├── create-checkout-session/
    ├── create-portal-session/
    └── send-auth-email/     Supabase Auth "Send email hook" → Resend

proxy.ts                     Next.js 16 middleware - refreshes auth cookies
```

## Commands

| Command         | What it does                                                |
| --------------- | ----------------------------------------------------------- |
| `npm run dev`   | Local dev server (Turbopack)                                |
| `npm run build` | Production build - run before committing to catch TS errors |
| `npm run lint`  | ESLint                                                      |

## Supabase Edge Functions

Deployed via the Supabase CLI:

```bash
supabase link --project-ref <your-project-ref>
supabase functions deploy stripe-webhook
supabase functions deploy create-checkout-session
supabase functions deploy create-portal-session
supabase functions deploy send-auth-email
```

Set function secrets:

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
supabase secrets set RESEND_API_KEY=re_...
supabase secrets set RESEND_FROM='SaleLinx <no-reply@yourdomain.com>'
supabase secrets set SEND_EMAIL_HOOK_SECRET='v1,whsec_...'
```

See `docs/EDGE-FUNCTIONS.md` for more.

## Docs

| File                                               | Topic                                                   |
| -------------------------------------------------- | ------------------------------------------------------- |
| [`docs/OVERVIEW.md`](docs/OVERVIEW.md)             | Stack, request lifecycle, folder layout, env vars       |
| [`docs/AUTH.md`](docs/AUTH.md)                     | Signup / login / reset / verify flows                   |
| [`docs/ENTITLEMENTS.md`](docs/ENTITLEMENTS.md)     | `tier_limits` + `usage_counters` system                 |
| [`docs/STRIPE.md`](docs/STRIPE.md)                 | Checkout, webhooks, Customer Portal                     |
| [`docs/EDGE-FUNCTIONS.md`](docs/EDGE-FUNCTIONS.md) | Deno functions, deploy, secrets                         |
| [`CLAUDE.md`](CLAUDE.md)                           | AI assistant guide - architecture constraints + gotchas |
