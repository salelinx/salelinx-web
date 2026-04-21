# resale-bot-web

Marketing + billing website for the SaleLinx Chrome extension (sibling repo `../muiltiplatform-seller-bot`). Both share a single Supabase project.

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
└── EDGE-FUNCTIONS.md   Deno functions, deploy, secrets, Stripe signature verification
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
- Supabase migrations live in the **extension repo**, not here. This repo only reads.

## Edge Functions (Deno)

Live in `supabase/functions/`. They run on Supabase, not Vercel. Deno, not Node - use `Deno.env.get(...)`, `esm.sh` imports, `Deno.serve`. Excluded from this repo's TS check via `tsconfig.json`.

- `stripe-webhook` - `verify_jwt = false` (Stripe signs with its own secret)
- `create-checkout-session` - `verify_jwt = true`
- `create-portal-session` - `verify_jwt = true`
- `send-auth-email` - `verify_jwt = false` (Supabase Auth signs via Standard Webhooks; delivers auth emails via Resend)

See `docs/EDGE-FUNCTIONS.md` for deploy + secrets.

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
- No default exports - named exports only
- Tailwind utility classes; no CSS modules unless truly needed
- No emojis in code or user-visible strings (ASCII check-marks like `✓` are fine in limited UI spots)

## Writing style

- **Never use em-dashes (`—`) or en-dashes (`–`)** in any text: UI copy, marketing copy, docs, commit messages, comments, PR descriptions. They are a strong AI-writing tell. Use a comma, a period, parentheses, or a plain hyphen (`-`) instead. This rule covers everything that renders as text - .tsx strings, .md files, code comments, README, CLAUDE.md itself.

## Gotchas

- **`proxy.ts` must export `proxy()`, not `middleware()`** - Next 16 renamed the convention. Build fails with an unhelpful error otherwise.
- **`setAll` cookie callbacks need an explicit `CookieEntry[]` type** - TS strict mode flags implicit `any`.
- **`router.refresh()` after password login** - without it, the Header still shows signed-out state until navigation.
- **`supabase/functions/` is excluded from `tsc`** - TS errors there won't surface until deploy. Use the Deno VSCode extension for inline checking.
- **Stripe API version pinned at `2025-02-24.acacia`** in 4 places (`lib/stripe.ts` + 3 Edge Functions). Bump all or none.
- **`constructEventAsync` in Deno**, never `constructEvent` - sync variant crashes.
- **Webhook must read `req.text()` first, then verify** - JSON.parse breaks signature.
- **Auth emails go through the `send-auth-email` Edge Function + Resend, not Supabase SMTP** - templates in `supabase/functions/send-auth-email/templates.ts`. A failing hook breaks signup/reset UX.
- **Standard Webhooks signing secret needs the `v1,whsec_` prefix stripped** before passing to `new Webhook(...)` - store the full value including prefix in `SEND_EMAIL_HOOK_SECRET`.
- **Edge Function secrets are separate from `.env.local`** - set via `supabase secrets set`.
- **Changing a tier cap is a `UPDATE tier_limits SET limits = jsonb_set(...)` - never overwrite the whole jsonb column** or you wipe other keys.

## Do NOT

- Commit `.env.local`
- Hardcode tier caps in pricing page or UI - read from `tier_limits` Supabase table
- Add extension-specific code here - that belongs in the other repo
- Create a second Supabase project "for the website"
- Introduce `middleware.ts` (deprecated in Next 16)
- Use `node_modules`-style imports inside `supabase/functions/` - Deno only understands `https://` / `jsr:`
