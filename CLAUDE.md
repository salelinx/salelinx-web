# salelinx-web

Marketing + billing website for the SaleLinx Chrome extension (sibling repo `../salelinx-app`). Both share a single Supabase project.

## Before making changes

Before any significant work or at the start of a new conversation, you MUST:

1. Read all files in `docs/` - understand architecture, auth flow, tier entitlement system, Stripe integration, Edge Functions
2. Review the `app/`, `lib/`, `components/`, and `supabase/functions/` folders before modifying them

Do not guess at how things work - read the code first.

### Docs

Read `docs/ARCHITECTURE.md` first - it's the whole-system context (both repos, shared Supabase, data ownership, user journey). Then the narrower docs as needed:

```
docs/
├── ARCHITECTURE.md     Big-picture: extension + web + Supabase, who owns what
├── OVERVIEW.md         Web-repo stack, request lifecycle, folder layout, env vars
├── AUTH.md             Signup / login / reset / verify flows, session handling
├── ENTITLEMENTS.md     tier_limits + usage_counters, config-driven gating
├── STRIPE.md           Checkout, webhook, Customer Portal, pricing change workflow
├── EDGE-FUNCTIONS.md   Deno functions (incl. send-shipping-labels), deploy, secrets
├── SUPPORT.md          Support ticket -> email flow, Database Webhooks, threading
├── REFERRALS.md        Referral program: share links, claims, conversions, reward grants
└── GDPR.md             Data inventory (ROPA), retention, deletion/export runbooks, breach process
```

## After making changes

1. Do any `docs/`, `README.md`, or `CLAUDE.md` files need updating?
2. If the change touches auth, tiers, billing, or an Edge Function - update the relevant doc
3. If shared types (`lib/types/tiers.ts`) changed, also update the extension's `src/entitlements/types.ts` to match

## Stack

- Next.js 16 App Router, React 19, TypeScript strict
- Tailwind CSS 4
- Supabase (@supabase/ssr for Next.js integration)
- Stripe SDK (server) + @stripe/stripe-js (client)

## Architecture constraints

- **Same Supabase project as the extension.** Never create a second project. Users must be one pool.
- Server Components use `lib/supabase/server.ts`; Client Components use `lib/supabase/client.ts`. Never cross the boundary.
- `proxy.ts` (Next.js 16's renamed middleware) refreshes auth cookies on every request - don't remove it. Must export `proxy`, not `middleware`.
- Shared types (`lib/types/tiers.ts`) must stay in sync with the extension's `src/entitlements/types.ts`. Copy-paste for now.
- Supabase migrations live in this repo under `supabase/migrations/`. The extension reads the same database but no longer owns schema.

## Edge Functions (Deno)

Live in `supabase/functions/`. They run on Supabase, not Vercel. Deno, not Node - use `Deno.env.get(...)`, `esm.sh` imports, `Deno.serve`. Excluded from this repo's TS check via `tsconfig.json`.

- `stripe-webhook` - `verify_jwt = false` (Stripe signs with its own secret)
- `create-checkout-session` - `verify_jwt = false` (handler calls `getUser()` because Supabase gateway can't verify ES256)
- `create-portal-session` - `verify_jwt = false` (same ES256 reason)
- `send-auth-email` - `verify_jwt = false` (Supabase Auth signs via Standard Webhooks; delivers auth emails via Resend)
- `send-support-email` - `verify_jwt = false` (Database Webhooks send a shared secret via `x-support-webhook-secret`; emails staff notifications to `support@salelinx.com`, an auto-ack to the ticket author, and admin replies back to the ticket owner)
- `send-shipping-labels` - `verify_jwt = false` (called by the extension with the user's JWT in `Authorization`; handler validates via `getUser(jwt)` and emails a merged label PDF via Resend)
- `admin-change-plan` - `verify_jwt = false` (admin console changes a customer's paid Stripe plan; handler validates via `getUser()` plus `admin_users` membership through the service role, swaps the subscription price, and lets `stripe-webhook` sync the row)
- `admin-delete-user` - `verify_jwt = false` (admin console runs the GDPR account deletion: storage objects, Stripe customer, then the auth user; same `getUser()` plus `admin_users` gate; see `docs/GDPR.md`)
- `delete-account` - `verify_jwt = false` (self-serve GDPR deletion from the `/account` Danger zone; handler validates via `getUser()`; stage `request` emails a signed confirmation link, stage `confirm` verifies the token and deletes the caller's own account with the same steps as `admin-delete-user`; refuses admins; see `docs/GDPR.md`)
- `process-referral-rewards` - `verify_jwt = false` (daily dashboard Cron job POSTs with the `x-referral-cron-secret` shared secret; grants referral rewards as Stripe balance credits; see `docs/REFERRALS.md`)
- `resolve-category` - `verify_jwt = false` (handler validates via `getUser(jwt)`, checks the caller's tier allows crosslisting and has monthly allowance left, then resolves against the tables in `_generated/`. **Deployed but not yet called by any extension build** - the crosslister still uses its own bundled tables. See `docs/EDGE-FUNCTIONS.md` "Wiring up resolve-category" for what is left to do)
- `get-referral-discount` - `verify_jwt = false` (public on purpose: returns only the referee coupon's terms (percent/amount, duration), never the coupon id)
- `report-telemetry` - `verify_jwt = false` (extension POSTs anonymous endpoint-health counters once a day; handler validates via `getUser(jwt)` as a spam gate only and discards the identity, then forwards to `record_endpoint_health`; read side is `/admin/health`)

See `docs/EDGE-FUNCTIONS.md` for deploy + secrets, `docs/SUPPORT.md` for the ticket flow.

## Git & Commits

- **NEVER commit directly to `main`** without explicit permission from the user
- Before committing, check the current branch. If on `main`, create a sensible feature/fix branch (under 50 chars) automatically before committing
- All changes must go through a PR. Do not merge to `main` without user approval
- Never add co-author lines or mention AI/Claude in commits
- Commit messages: short title + concise bullet points in the body
- No verbose descriptions - keep it scannable
- When asked for a PR title and description: output `Title:` as a plain text label followed by the title in a markdown code block, then a blank line, then `Description:` as a plain text label followed by the description body in a markdown code block - both blocks are copy-pastable into GitHub's web UI

## Commands

- `npm run dev` - local dev
- `npm run build` - production build (run this to verify TS errors before committing)
- `npm run lint` - ESLint

## Code style

- 2-space indent, single quotes, trailing commas (Prettier defaults)
- No default exports - named exports only. **Exception:** MDX files under `content/` default-export their page component by design; this is the single allowed exception.
- Tailwind utility classes; no CSS modules unless truly needed
- No emojis in code or user-visible strings (ASCII check-marks like `✓` are fine in limited UI spots)

## Writing style

- **Never use em-dashes (`—`) or en-dashes (`–`)** in any text: UI copy, marketing copy, docs, commit messages, comments, PR descriptions. They are a strong AI-writing tell. Use a comma, a period, parentheses, or a plain hyphen (`-`) instead. This rule covers everything that renders as text - .tsx strings, .md files, code comments, README, CLAUDE.md itself.

## Gotchas

- **`proxy.ts` must export `proxy()`, not `middleware()`** - Next 16 renamed the convention. Build fails with an unhelpful error otherwise.
- **`setAll` cookie callbacks need an explicit `CookieEntry[]` type** - TS strict mode flags implicit `any`.
- **Admin access requires MFA (AAL2).** `is_admin()` only returns true for sessions that verified a TOTP code (migration `009_admin_mfa.sql`). Deploy order matters: enroll every admin (Account > Security) BEFORE applying 009 or the console locks them out. Recovery: remove the factor in the Supabase dashboard. Never gate admin surfaces on a bare `admin_users` EXISTS - go through `is_admin()` so the AAL2 check is inherited.
- **`requireReauth()` must never use `signInWithPassword` for an MFA-enrolled admin** - it mints a fresh AAL1 session and locks them out of admin data mid-action. The TOTP branch runs first for that reason; keep it that way.
- **`router.refresh()` after password login** - without it, the Header still shows signed-out state until navigation.
- **`proxy.ts` and `Header.tsx` use `getClaims()`, not `getUser()`** - getClaims verifies the JWT locally against the ES256 signing keys; getUser is a network round-trip to Supabase Auth and both run on every page view. Keep `getUser()` only where the canonical user record matters (protected pages like `/account`, Edge Functions).
- **Public pages read tiers via `getCachedTierConfigs()`** (60s `unstable_cache`, cookie-less client); admin pages use the uncached `getTierConfigs()` so edits show immediately. Don't point admin at the cached one.
- **`supabase/functions/` is excluded from `tsc`** - TS errors there won't surface until deploy. Use the Deno VSCode extension for inline checking.
- **`supabase/functions/resolve-category/_generated/` is a copy of the extension's category mapping tables**, whose canonical source and tests live in the extension repo (`src/data/category-maps-*.ts`). Treat it as generated: prefer changing the tables there. **The sync script that is supposed to copy them does not exist yet** (docs previously named it both `npm run sync:category-maps` and `scripts/sync-category-maps.mjs`; neither is in either repo), so the two copies have already drifted apart structurally. Reconcile them before automating the copy. Redeploy with `supabase functions deploy resolve-category --no-verify-jwt`.
- **Stripe API version pinned at `2025-02-24.acacia`** in 8 Edge Functions (`stripe-webhook` pins it twice, so 9 occurrences): `stripe-webhook`, `create-checkout-session`, `create-portal-session`, `admin-change-plan`, `admin-delete-user`, `delete-account`, `process-referral-rewards`, `get-referral-discount`. There is no server-side Stripe client in the Next.js app. Bump all or none.
- **`constructEventAsync` in Deno**, never `constructEvent` - sync variant crashes.
- **Webhook must read `req.text()` first, then verify** - JSON.parse breaks signature.
- **Auth emails go through the `send-auth-email` Edge Function + Resend, not Supabase SMTP** - templates in `supabase/functions/send-auth-email/templates.ts`. A failing hook breaks signup/reset UX.
- **Standard Webhooks signing secret needs the `v1,whsec_` prefix stripped** before passing to `new Webhook(...)` - store the full value including prefix in `SEND_EMAIL_HOOK_SECRET`.
- **Edge Function secrets are separate from `.env.local`** - set via `supabase secrets set`.
- **Usage counter names are NOT tier_limits keys.** The extension sends the short `counter` name (`crosslist`, `follow`) to `increment_usage_counter`, while the cap lives under a different key in `tier_limits.limits` (`crosslists_per_month`, `follows_per_day`). Both sets are in the extension's `src/entitlements/gate.ts` METERED table; don't assume one name works in both places.
- **`CREATE OR REPLACE FUNCTION` resets the function's grants** to the Postgres default, which is EXECUTE to PUBLIC. A later `REVOKE ... FROM anon` does NOT remove access held via PUBLIC. When replacing a function that `024_function_grant_hygiene.sql` hardened, revoke `PUBLIC, anon` and re-`GRANT` to `authenticated` explicitly, or you silently reopen the anon surface.
- **`endpoint_health` must never gain a `user_id`** (or install id, or any other identifier). Anonymous counters are what keep it non-personal: no ROPA entry, no deletion-runbook step, no consent gate. Adding an identifier reverses all three, and a consent gate would put holes in the one dataset that has to be complete to detect a marketplace outage. See `docs/GDPR.md`.
- **Endpoint health keys must stay stable across extension versions.** Detection works by comparing an endpoint against its own recent baseline, so a renamed key looks exactly like a brand-new endpoint sitting at 100% failure. Changing the rules in the extension's `normalizeEndpointKey` re-buckets all history; the tests in `tests/utils/endpoint-key.test.ts` pin the current behaviour.
- **Changing a tier cap is a `UPDATE tier_limits SET limits = jsonb_set(...)` - never overwrite the whole jsonb column** or you wipe other keys.
- **MDX article metadata is a named `export const metadata = {...}`**, not YAML frontmatter. Adding a new article requires three things: create the `.mdx` file under `content/docs/<category>/`, import it in `lib/docs/manifest.ts`, and run `npm run build:docs-index` (or any `npm run dev`/`build`) to rebuild the search index.
- **`public/docs/search-index.json` is generated, not committed.** It's rebuilt by `scripts/build-docs-index.mjs` via `predev`/`prebuild`. Don't edit it by hand.
- **`mdx-components.tsx` must live at the repo root**, not under `app/`. `@next/mdx` only looks there.
- **Marketplace status** is a hardcoded constant in `lib/docs/status.ts`. Migration path to Supabase is noted in the file; consumers call `getMarketplaceStatus()` so the swap is local.
- **Docs vs FAQ split.** `/docs` is for step-by-step guides and walkthroughs (learning-oriented prose). `/faq` is for quick Q&A (troubleshooting, billing, one-offs) in `lib/faq/data.<locale>.tsx` (one file per locale: en/fr/es/de). Don't add troubleshooting or billing articles to `/docs`; add FAQ entries instead.
- **`robots.txt` and `sitemap.xml` must stay excluded in `proxy.ts`'s `matcher`** - otherwise intlMiddleware locale-rewrites them into `[locale]/[...rest]` and both serve the HTML 404 page instead of their content.
- **Public pages must build metadata through `pageMetadata()` in `lib/site.ts`** - Next.js merges metadata shallowly, so a layout-level `alternates`/`openGraph` is inherited verbatim by every page beneath it (each page would claim the homepage as its canonical). The root layout deliberately sets neither. Also never put a plain-string `title` on a nested layout: it breaks the `%s | SaleLinx` title template chain for everything under it.
- **`/r/CODE` referral links must stay in `proxy.ts`'s `skipIntl` allowlist** - without that line next-intl locale-rewrites the route and the handler never runs. The attribution cookie is `slx_ref` (HttpOnly, 30 days); the claim fires in `proxy.ts` on the first signed-in request carrying the cookie. Do NOT move it to `/auth/callback` - signup verification goes through `/auth/confirm` + `verifyOtp` and never hits the callback. See `docs/REFERRALS.md`.
- **Referees must never get a SELECT policy on `referrals`** - it would expose the referrer's UUID. Referee-side reads go through the `has_pending_referral()` RPC.
- **Google Analytics must only ever load through `components/CookieConsent.tsx`** - PECR requires prior consent, so never add a gtag/GTM `<script>` to a layout. The whole feature is gated on `NEXT_PUBLIC_GA_MEASUREMENT_ID`: blank means no banner and no GA. The consent choice lives in the `slx_consent` cookie (6 months); the footer Cookie settings button reopens the banner via the `slx:cookie-settings` window event.
- **Features / Pricing / Roadmap are one page.** Canonical URL is `/features`, with in-page anchors `#features`, `#pricing`, `#roadmap` set on each section component. Cross-section navigation comes from the global sticky `Header` links. `/pricing` and `/roadmap` are one-line `redirect()` stubs pointing at the anchors - keep them in place (Stripe's `cancelUrl` still points at `/pricing`). Section components live under `components/features/`.

## Do NOT

- Commit `.env.local`
- Hardcode tier caps in pricing page or UI - read from `tier_limits` Supabase table
- Add extension-specific code here - that belongs in the other repo
- Create a second Supabase project "for the website"
- Introduce `middleware.ts` (deprecated in Next 16)
- Log personal data (email addresses, message bodies, buyer data) in Edge Functions - user UUIDs are the ceiling; see `docs/GDPR.md`
- Add a user-owned table without `REFERENCES auth.users(id) ON DELETE CASCADE` - it breaks the account deletion runbook in `docs/GDPR.md`
- Use `node_modules`-style imports inside `supabase/functions/` - Deno only understands `https://` / `jsr:`
