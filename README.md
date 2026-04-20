# resale-bot-web

Marketing site, pricing page, auth, and subscription management for the Resale Bot Chrome extension.

Companion to the extension repo at `../muiltiplatform-seller-bot`. Both share a single Supabase project so users are one pool.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript strict
- Tailwind CSS 4
- Supabase Auth (email + password) + Supabase Postgres
- Stripe Checkout + Customer Portal
- Vercel (hosting)
- Resend (transactional email — configure before launch)

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

### SMTP (Authentication → Emails → SMTP)

Before launch: connect Resend (or Postmark / SendGrid). The default Supabase SMTP is rate-limited to 2 emails/hour.

### Migrations

Run `011_billing.sql` from the **extension repo** (`../muiltiplatform-seller-bot/supabase/migrations/`). All DB schema lives there — this repo only reads.

## Directory layout

```
app/
├── page.tsx                 Landing
├── pricing/                 Tiers rendered from Supabase tier_limits
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
└── VerifyEmailBanner.tsx    Shown to unverified users on /account

lib/
├── supabase/{client,server,tier-config}.ts
├── stripe.ts                Stripe server SDK init
└── types/tiers.ts           Shared with extension — copy-paste sync

supabase/
├── config.toml              Supabase CLI config for deploying functions
└── functions/
    ├── stripe-webhook/
    ├── create-checkout-session/
    └── create-portal-session/

proxy.ts                     Next.js 16 middleware — refreshes auth cookies
```

## Commands

| Command         | What it does                                                |
| --------------- | ----------------------------------------------------------- |
| `npm run dev`   | Local dev server (Turbopack)                                |
| `npm run build` | Production build — run before committing to catch TS errors |
| `npm run lint`  | ESLint                                                      |

## Supabase Edge Functions

Deployed via the Supabase CLI:

```bash
supabase link --project-ref <your-project-ref>
supabase functions deploy stripe-webhook
supabase functions deploy create-checkout-session
supabase functions deploy create-portal-session
```

Set function secrets:

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
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
| [`CLAUDE.md`](CLAUDE.md)                           | AI assistant guide — architecture constraints + gotchas |
