# Overview

Marketing site, auth, and subscription management for the SaleLinx Chrome extension.

Companion to the extension repo at `../salelinx-app`. Both share a **single Supabase project** so users are one pool.

## Stack

| Layer     | Tech                                  | Why                                                                                                                          |
| --------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Framework | Next.js 16 App Router                 | Server components, middleware (`proxy.ts`), built-in routing                                                                 |
| UI        | React 19 + Tailwind 4                 | No component library - utility CSS is enough for a small site                                                                |
| Auth + DB | Supabase (`@supabase/ssr`)            | Same project as the extension; users are one pool                                                                            |
| Billing   | Stripe Checkout + Customer Portal     | Off-the-shelf subscription UX; webhooks sync to Supabase                                                                     |
| Hosting   | Vercel                                | One repo → one project, automatic preview deploys                                                                            |
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

| Var                                  | Used by         | Notes                                                                                                                                                                                          |
| ------------------------------------ | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`           | client + server | Same as the extension's Supabase project                                                                                                                                                       |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`      | client + server | Anon key, not service role                                                                                                                                                                     |
| `NEXT_PUBLIC_STRIPE_PRICE_STARTER`   | client          | `price_...` for Starter monthly. Swap test↔live without redeploy                                                                                                                               |
| `NEXT_PUBLIC_STRIPE_PRICE_PRO`       | client          | `price_...` for Pro monthly                                                                                                                                                                    |
| `NEXT_PUBLIC_STRIPE_PRICE_BUSINESS`  | client          | `price_...` for Business monthly                                                                                                                                                               |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | client          | Unused today, kept for future Stripe Elements                                                                                                                                                  |
| `NEXT_PUBLIC_EXTENSION_ID`           | client          | Chrome extension deep-link target (blank pre-launch)                                                                                                                                           |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID`      | client          | GA4 Measurement ID (`G-...`). Blank hides the analytics consent category and GA entirely; when set, GA loads only after consent (`components/CookieConsent.tsx`)                               |
| `NEXT_PUBLIC_GOOGLE_ADS_ID`          | client          | Google Ads tag ID (`AW-...`) for measuring our own ad campaigns. Blank hides the ad-measurement consent category; when set, the tag loads only after consent. We never show ads on the site    |
| `NEXT_PUBLIC_ADS_LABEL_SIGNUP`       | client          | Conversion label (from the Google Ads UI) for "verified signup". Blank skips the Ads conversion; the GA4 event still fires                                                                     |
| `NEXT_PUBLIC_ADS_LABEL_PURCHASE`     | client          | Conversion label for "subscription started" (fired on the Checkout success landing)                                                                                                            |
| `NEXT_PUBLIC_ADS_LABEL_INSTALL`      | client          | Conversion label for the outbound Chrome Web Store click (closest measurable proxy for an install)                                                                                             |
| `HEALTH_CHECK_TOKEN`                 | server          | Optional shared secret for `/api/health/supabase`. Unset leaves the endpoint open; when set, the monitor must send it as `x-health-token`. Not `NEXT_PUBLIC_` — it must never reach the client |
| `WATCHDOG_TRIGGER_SECRET`            | server          | Required by `/api/watchdog/trigger`. cron-job.org sends it as `Authorization: Bearer …`. Unset makes the route refuse: it fails closed, unlike the health endpoint          |
| `WATCHDOG_DISPATCH_TOKEN`            | server          | Fine-grained GitHub PAT, **Actions: write on `salelinx/salelinx-web` only**. Lets the trigger route call `workflow_dispatch`. Deliberately not the Supabase PAT, which has full org access      |

## Health endpoint (`/api/health/supabase`)

`GET /api/health/supabase` — for an external uptime monitor to poll. Returns **200** when Supabase is serving, **503** with the failing probe names when it is not, and **500** if the endpoint itself is misconfigured (a bad deploy must not page anyone as a Supabase incident).

It exists because of the 2026-09-06 outage: Supabase was unusable from 06:26 to 11:44 UTC — every user's extension dead — and nobody knew until someone happened to look. See `../../salelinx-app/docs/technical/GOTCHAS.md` for the cause.

**It lives on Vercel, not Supabase, and that is the point.** A monitor must not run on the thing it monitors, and every other notification path we own (Resend emails, the referral cron) is a Supabase Edge Function. The trade-off is that a Vercel outage makes this endpoint fail and look like a Supabase problem — acceptable, since both are worth waking up for, which is why the response names the failing probe rather than just saying "unhealthy".

**Do not "fix" the probes to expect 200.** Both deliberately cross into Postgres, because the obvious probe does not:

| Probe                | Request                                                                          | Healthy |
| -------------------- | -------------------------------------------------------------------------------- | ------- |
| `auth_token_refresh` | `POST /auth/v1/token?grant_type=refresh_token` with a deliberately invalid token | **400** |
| `rest_read`          | `GET /rest/v1/tier_limits?select=tier_id&limit=1`                                | 200     |

A **400** is the healthy answer for the first: it proves auth reached the database and looked the token up. During the outage that same call returned `500 error finding session from refresh token: context deadline exceeded`. `GET /auth/v1/health` is the tempting alternative and is useless here — it reports that the GoTrue process is alive, which it was, for all five hours.

Both use the anon key (public by design) and neither writes. There is no service-role key on Vercel and this endpoint must never need one.

`HEALTH_CHECK_TOKEN` is optional: unset, the endpoint is open so it works before anything is configured; set, callers must send `x-health-token`. Worth setting, since each call makes two outbound requests to the service it is protecting.

**Third consumer: the watchdog.** `.github/workflows/supabase-watchdog.yml` runs `scripts/supabase-watchdog.mjs` and restarts the project when it is genuinely down. It exists because 2026-09-06 needed a manual restart after 5h18m. The database recovering was never the hard part, noticing was.

A restart is itself an outage, so the bar is high. It has been wrong in both directions, and both failures are pinned by tests in `tests/supabase-watchdog.test.ts`.

**Too cautious (2026-09-17).** `GET /v1/projects/{ref}` returns a *lifecycle* state, not a serving one: `ACTIVE_HEALTHY` means provisioned and not paused, and it stayed green through all 5h18m of 2026-09-06. Letting it veto three served 503s meant the watchdog could never fire.

**Too eager (2026-09-22).** The fix for that went one step too far and counted *any* served 503 as proof. The health endpoint's probe timeout was 5s, below this project's worst-case PostgREST schema reload of 5.4s, so a healthy database timed out, came back in `failed`, and read as proof it was down. Seven restarts in 2h25m against a Postgres that logged no error all night.

The rule now asks a narrower question: did **Supabase itself answer with an error**?

| Probe result                                    | Reading                                                              |
| ------------------------------------------------ | -------------------------------------------------------------------- |
| 5xx generated by Supabase (GoTrue, PostgREST)   | **Proof.** Restart, whatever the platform says                        |
| Timeout, DNS failure, no response                | Ambiguous. We gave up; that says nothing about Supabase               |
| Cloudflare 52x                                   | Ambiguous. The edge could not reach the origin, which is also exactly what our own restart looks like |
| 4xx                                              | Not an outage. A 429 is rate limiting, a 401 is our own bug           |

Anything ambiguous lets `ACTIVE_HEALTHY` have the final say. It still declines when the platform is mid-transition (`RESTARTING`, `COMING_UP`, …) or when the project is paused, which a restart would silently un-pause.

**Cooldown and cap.** A restart takes about 6 minutes to recover and runs are 5 minutes apart, so without a cooldown the next run reads the restart's own downtime as a fresh outage. That cascade was three of the seven restarts on 2026-09-22. The script reads its own run history through the auto-injected `GITHUB_TOKEN` (hence `permissions: actions: read`) and will not restart within **30 minutes** of a previous one, nor more than **4 times in 24 hours**. The cooldown is checked *before* the evidence, because a restarting project reliably produces exactly the errors that look like proof.

A `failure` conclusion is what marks "we restarted", which is why standing down exits 0. If abstaining failed the run it would suppress the next real restart for half an hour. Telling a human is UptimeRobot's job, not this workflow's.

> **The probe timeouts are load-bearing.** The endpoint waits 10s per probe, the watchdog waits 20s for the endpoint. Both must stay above the slowest schema reload, which on Nano compute peaks above 5.4s for PostgREST introspection and `pg_timezone_names`. Upgrading compute would remove the underlying slowness; until then, do not lower these.

**What triggers it.** Two paths, deliberately:

| Trigger                                                     | Cadence                           | Survives                            |
| ------------------------------------------------------------ | --------------------------------- | ----------------------------------- |
| cron-job.org → `/api/watchdog/trigger` → `workflow_dispatch` | every 5 min, a real floor         | Supabase down                       |
| The workflow's own `schedule:`                              | 4/hr requested, 6-8/day delivered | cron-job.org or Vercel being down   |

GitHub's scheduled runs are best-effort and high-frequency crons are dropped first under load, so the workflow's `cron:` is a request, not a guarantee. On 2026-09-21 Supabase went down at ~17:15 UTC with the last delivered run at 13:54, a 3h24m gap, restart logic armed and correct the whole time, and nothing ran. cron-job.org gives the floor the schedule never had; the GitHub schedule stays as the backstop for when cron-job.org is what broke.

**Why cron-job.org and not somewhere we already pay for.** Both obvious candidates are blocked by a plan, not by design:

- **Vercel cron**: we are on Hobby, where `crons` are capped at one run per day whatever `vercel.json` says. A floor of 24 hours is not a floor.
- **UptimeRobot webhook**: the monitor already polls this endpoint on a real interval and is what noticed the 2026-09-21 outage, so firing the watchdog from its down-alert would have been the tidiest option. Webhooks are Team/Scale only; we are on Free.

cron-job.org's free tier does 1-minute intervals with custom request headers, and shares infrastructure with neither Vercel nor Supabase, which is the only property that actually matters. If either plan above ever changes, both are drop-in replacements pointed at the same route. **UptimeRobot still does the alerting**: it tells a human; cron-job.org tells the watchdog. They are not redundant.

`/api/watchdog/trigger` exists because a cron service cannot call GitHub directly: `workflow_dispatch` needs a POST with a bearer token, an `Accept` header and a JSON body, more than a URL field allows. It is the adapter, and it keeps the GitHub token server-side where a scheduler's stored job config cannot leak it.

It does not probe. The workflow already probes three times and stands down on its own, and a second copy of that rule could only disagree with the first. That is what makes it safe to call blind every 5 minutes with no idea whether anything is wrong. It **fails closed**: no `WATCHDOG_TRIGGER_SECRET`, no dispatch. Unlike the health endpoint it causes an action, and each call spends a CI run that probes the service the watchdog protects, so an open one is an amplifier.

The secret goes in an `Authorization: Bearer …` header, never the query string, which would put it in access logs.

It runs on GitHub Actions rather than Vercel deliberately: a watchdog must not share infrastructure with what it watches, and the Supabase PAT it needs has full management access to the organisation, so it is better kept out of the web app's runtime env.

**It ships disarmed.** Set the repository variable `WATCHDOG_ENABLED=true` to let it act; until then it probes, reports and fails the run without restarting anything. Required config: secrets `SUPABASE_ACCESS_TOKEN` (and `HEALTH_CHECK_TOKEN` if set), variables `SUPABASE_PROJECT_REF` and `HEALTH_URL`.

Point `HEALTH_URL` at the apex, `https://salelinx.com/api/health/supabase`. The `www` host 307-redirects to it, and while `fetch` follows that, it costs an extra hop on every probe and turns a redirect misconfiguration into a false outage.

**Seeing it without an outage.** `/dev/outage-preview` throws on purpose so the boundary renders; it `notFound()`s in production. Which copy you get depends on what the probe answers, so to see the *outage* branch rather than the bug branch, run the app pointed at an unreachable host:

```
NEXT_PUBLIC_SUPABASE_URL=https://offline.invalid NEXT_PUBLIC_SUPABASE_ANON_KEY=anything npm run build && npm start
```

**Second consumer: the error boundary.** `app/[locale]/error.tsx` catches anything the locale tree throws — most often a server component that could not reach Supabase — and calls this endpoint once to decide what to tell the user: "we're temporarily down" (probe failed) or "something went wrong" (probe fine, so it is our bug). Saying "maintenance" for a code bug trains people to ignore the message, hence the probe rather than a guess.

It only ever runs on a page that has already failed, so it costs nothing on the happy path, and the verdict is cached in `sessionStorage` for 30s so someone clicking around during an outage does not re-probe on every navigation — that would add load to a backend already in trouble. Only a **503** is read as an outage. A 500 (endpoint misconfigured) or a 401 (`HEALTH_CHECK_TOKEN` set — which this caller cannot send, since the secret must never reach the client) means the probe declined to answer, not that Supabase is down, and falls back to the generic error copy. Setting `HEALTH_CHECK_TOKEN` therefore does not break the page; it just costs the boundary its ability to distinguish an outage from a bug.

### Edge Functions (set via `supabase secrets set`, NOT in `.env.local`)

| Var                         | Source                                             |
| --------------------------- | -------------------------------------------------- |
| `STRIPE_SECRET_KEY`         | https://dashboard.stripe.com/test/apikeys          |
| `STRIPE_WEBHOOK_SECRET`     | `stripe listen` output or Stripe webhook dashboard |
| `SUPABASE_URL`              | Auto-injected                                      |
| `SUPABASE_ANON_KEY`         | Auto-injected                                      |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-injected                                      |

## Database schema ownership

**Supabase migrations live in this repo** (`supabase/migrations/`). The extension reads the same database but no longer owns schema. The folder is a consolidated baseline (`001`-`014`, squashed September 2026 and verified byte-identical to the incremental history); see `supabase/migrations/README.md` for what maps where and how to apply.

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
