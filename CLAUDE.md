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
- **`router.refresh()` after password login** - without it, the Header still shows signed-out state until navigation.
- **`supabase/functions/` is excluded from `tsc`** - TS errors there won't surface until deploy. Use the Deno VSCode extension for inline checking.
- **Stripe API version pinned at `2025-02-24.acacia`** in 6 places (`lib/stripe.ts` + 5 Edge Functions). Bump all or none.
- **`constructEventAsync` in Deno**, never `constructEvent` - sync variant crashes.
- **Webhook must read `req.text()` first, then verify** - JSON.parse breaks signature.
- **Auth emails go through the `send-auth-email` Edge Function + Resend, not Supabase SMTP** - templates in `supabase/functions/send-auth-email/templates.ts`. A failing hook breaks signup/reset UX.
- **Standard Webhooks signing secret needs the `v1,whsec_` prefix stripped** before passing to `new Webhook(...)` - store the full value including prefix in `SEND_EMAIL_HOOK_SECRET`.
- **Edge Function secrets are separate from `.env.local`** - set via `supabase secrets set`.
- **Changing a tier cap is a `UPDATE tier_limits SET limits = jsonb_set(...)` - never overwrite the whole jsonb column** or you wipe other keys.
- **MDX article metadata is a named `export const metadata = {...}`**, not YAML frontmatter. Adding a new article requires three things: create the `.mdx` file under `content/docs/<category>/`, import it in `lib/docs/manifest.ts`, and run `npm run build:docs-index` (or any `npm run dev`/`build`) to rebuild the search index.
- **`public/docs/search-index.json` is generated, not committed.** It's rebuilt by `scripts/build-docs-index.mjs` via `predev`/`prebuild`. Don't edit it by hand.
- **`mdx-components.tsx` must live at the repo root**, not under `app/`. `@next/mdx` only looks there.
- **Marketplace status** is a hardcoded constant in `lib/docs/status.ts`. Migration path to Supabase is noted in the file; consumers call `getMarketplaceStatus()` so the swap is local.
- **Docs vs FAQ split.** `/docs` is for step-by-step guides and walkthroughs (learning-oriented prose). `/faq` is for quick Q&A (troubleshooting, billing, one-offs) in `lib/faq/data.tsx`. Don't add troubleshooting or billing articles to `/docs`; add FAQ entries instead.
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
