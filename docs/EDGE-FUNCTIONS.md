# Edge Functions

Twelve Supabase Edge Functions live in `supabase/functions/`. They run on Supabase's Deno runtime, **not** Next.js / Vercel / Node.

## Why Edge Functions, not Next.js route handlers?

- **`stripe-webhook`** - lives next to Supabase so it has direct service-role access to the DB without exposing it to Vercel env. Also simpler to lock down (`verify_jwt = false`).
- **`create-checkout-session` / `create-portal-session`** - could live in Next.js, but keeping all Stripe-adjacent code in one place is easier to reason about. Single deploy target, single set of secrets.
- **`send-auth-email`** - must be reachable from Supabase Auth's Send Email Hook; an Edge Function URL is the natural fit.
- **`send-support-email`** - target of two Supabase Database Webhooks (insert on `support_tickets`, insert on `support_ticket_replies`). Needs service-role read on `auth.users` and write back to `support_tickets.notification_message_id`, so Supabase is the natural home.
- **`send-shipping-labels`** - called by the Chrome extension to email a merged shipping-label PDF via Resend. Lives here (not in the extension) because Edge Function deploys are co-located with everything else Supabase-adjacent, and the extension only needs the function URL.
- **`admin-change-plan`** - the admin console's real Stripe plan change (swap the price on a customer's live subscription). Needs `STRIPE_SECRET_KEY` and the service role (admin gate + audit write), so it lives with the other Stripe-adjacent functions.
- **`admin-delete-user`** - the admin console's account deletion (the GDPR erasure runbook: storage, Stripe customer, auth user). Needs the service role and `STRIPE_SECRET_KEY`; same home as the script it mirrors (`scripts/delete-user-account.mjs`).
- **`delete-account`** - self-serve account deletion from `/account` (Danger zone). Two stages: `request` emails the account address a confirmation link (Resend, HMAC-signed token, 60-minute expiry, signed with `DELETE_ACCOUNT_TOKEN_SECRET`); `confirm` (from `/account/delete-confirm`) verifies the token was minted for the caller and then runs the same erasure steps as `admin-delete-user`. Refuses admins (their audit-log FKs would break) and writes no audit entry (the actor would not survive their own deletion).
- **`resolve-category`** - resolves Depop <-> Vinted categories for the extension's crosslister. **Deployed but not yet wired up: no extension build calls it.** The intent is to move the mapping tables (~116KB) out of the extension bundle, where anyone who installed it can unzip the .crx and lift them, and to make this the one crosslist entitlement check the user cannot patch around (a crosslist cannot produce a category without it). Neither benefit is realized yet: the extension still ships and reads its own copies in `src/data/category-maps-*.ts`, and this function is dead weight until that changes. See "Wiring up resolve-category" below.
- **`process-referral-rewards`** - grants referral rewards (Stripe balance credits) on a daily schedule. Needs `STRIPE_SECRET_KEY` and the service role; invoked by a dashboard Cron job, never by browsers. See `docs/REFERRALS.md`.

## The fourteen functions

| Function                  | `verify_jwt` | Purpose                                                                                                  |
| ------------------------- | ------------ | -------------------------------------------------------------------------------------------------------- |
| `stripe-webhook`          | false        | Stripe POSTs here; we verify with `STRIPE_WEBHOOK_SECRET` instead                                        |
| `create-checkout-session` | false*       | Authed user requests a Stripe Checkout URL. Auth enforced by `getUser()`.                                |
| `create-portal-session`   | false*       | Authed user requests a Stripe Customer Portal URL. Same pattern.                                         |
| `send-auth-email`         | false        | Supabase Auth POSTs here for every auth email; signed, delivered via Resend                              |
| `send-support-email`      | false        | Database Webhooks POST here on new ticket / new reply; emails staff, the auto-ack, and admin-reply-to-user via Resend |
| `send-shipping-labels`    | false*       | Extension POSTs a base64 PDF + recipient; auth by `getUser(jwt)` + tier gate + daily cap; via Resend     |
| `admin-change-plan`       | false*       | Admin console swaps a customer's paid plan in Stripe; auth by `getUser()` + `admin_users` membership     |
| `admin-delete-user`       | false*       | Admin console runs the GDPR account deletion; auth by `getUser()` + `admin_users` membership             |
| `delete-account`          | false*       | User deletes their own account: emails a signed confirm link and erases on confirm; auth by `getUser()`  |
| `resolve-category`        | false*       | Intended: extension POSTs category lookups; auth by `getUser(jwt)` + crosslist tier gate + monthly cap. **No caller yet** |
| `get-referral-discount`   | false        | Public on purpose: returns the referee coupon's terms (percent/amount, duration), never the coupon id     |
| `process-referral-rewards` | false       | Daily Cron job POSTs here; gated by the `x-referral-cron-secret` shared-secret header                   |
| `report-telemetry`        | false*       | Extension POSTs anonymous endpoint-health counters once a day; `getUser(jwt)` is a spam gate only, the identity is discarded |
| `report-selftest`         | false*       | Extension POSTs one admin endpoint self-test run; `getUser(jwt)` identifies the caller, then `admin_users` is re-checked with the service role |

\*`verify_jwt` is false because the Supabase gateway's built-in JWT check only supports HS256, and our project issues ES256 tokens. Each authed function calls `supabase.auth.getUser()` in the handler and returns 401 if null - Supabase's user endpoint validates ES256 correctly, so auth is still enforced. The two `admin-*` functions additionally require the (already-validated) JWT's `aal` claim to be `aal2` (MFA verified this session, mirroring `is_admin()` in migration 009) and `admin_users` membership via the service role.

`stripe-webhook`, `create-checkout-session`, and `create-portal-session` import Stripe + Supabase clients from `esm.sh`. `send-auth-email` imports `standardwebhooks` from `esm.sh` and uses plain `fetch` for the Resend API. `send-support-email` imports `@supabase/supabase-js` from `esm.sh` and uses plain `fetch` for Resend. `send-shipping-labels` and `resolve-category` import `@supabase/supabase-js` from `jsr:`. Deno needs explicit `.ts` extensions on relative imports, which is why `resolve-category/_generated/` is written with them. Deno uses URL imports, not `node_modules`.

## Deno specifics (don't copy Node patterns)

| Node                  | Deno                                    |
| --------------------- | --------------------------------------- |
| `process.env.X`       | `Deno.env.get("X")`                     |
| `import x from 'pkg'` | `import x from "https://esm.sh/pkg@17"` |
| `require()`           | Not supported                           |
| `module.exports`      | `export` only                           |
| `http.createServer`   | `Deno.serve((req) => ...)`              |

Deno has `fetch`, `crypto`, `URL`, `Response`, `Request` built-in. Imports that don't start with `https://` or `jsr:` will fail.

## Local development

```bash
supabase start              # spin up local Supabase stack (Postgres + GoTrue + Storage + Functions)
supabase functions serve    # watch + reload on file change
```

Hit the local function: `http://localhost:54321/functions/v1/<name>`.

Pair with Stripe CLI for local webhook testing:

```bash
stripe listen --forward-to http://localhost:54321/functions/v1/stripe-webhook
```

## Deploy

```bash
supabase link --project-ref <your-project-ref>   # one-time per clone
supabase functions deploy stripe-webhook
supabase functions deploy create-checkout-session
supabase functions deploy create-portal-session
supabase functions deploy send-auth-email
supabase functions deploy send-support-email
supabase functions deploy send-shipping-labels --no-verify-jwt
supabase functions deploy admin-change-plan --no-verify-jwt
supabase functions deploy admin-delete-user --no-verify-jwt
supabase functions deploy delete-account --no-verify-jwt
supabase functions deploy resolve-category --no-verify-jwt
supabase functions deploy process-referral-rewards --no-verify-jwt
```

## Secrets

Edge Functions don't read `.env.local`. Set secrets explicitly:

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
supabase secrets set RESEND_API_KEY=re_...
supabase secrets set RESEND_FROM='SaleLinx <no-reply@yourdomain.com>'
supabase secrets set SEND_EMAIL_HOOK_SECRET='v1,whsec_...'
# Public site origin. Auth email links point here (/auth/confirm), not at
# Supabase's /auth/v1/verify - see docs/AUTH.md. Falls back to the hook
# payload's site_url if unset.
supabase secrets set SITE_URL='https://www.salelinx.com'
supabase secrets set SUPPORT_NOTIFY_FROM='SaleLinx Support <support@salelinx.com>'
supabase secrets set SUPPORT_NOTIFY_TO='support@salelinx.com'
# Reply-To on USER-facing support mail. Emailed replies are not ingested
# anywhere, so they point at an unmonitored address rather than the staffed
# inbox; the templates tell users to answer on their ticket. Falls back to
# SUPPORT_NOTIFY_FROM if unset.
supabase secrets set SUPPORT_NOTIFY_NOREPLY='SaleLinx (no reply) <no-reply@salelinx.com>'
supabase secrets set SUPPORT_NOTIFY_HOOK_SECRET='<random-string>'
# send-shipping-labels reuses RESEND_API_KEY and RESEND_FROM - no extra secrets.
# resolve-category needs no secrets: it reads SUPABASE_URL / SUPABASE_ANON_KEY,
# which the runtime injects.
# Optional CORS pinning for all browser-called functions: unset = wildcard
# (unchanged behavior); set to the site origin to stop other sites' frontends
# reading responses. The extension is unaffected (host permissions bypass CORS).
supabase secrets set ALLOWED_ORIGIN='https://www.salelinx.com'
# Referrals (docs/REFERRALS.md): the referee first-month-discount coupon ID
# (created by hand in the Stripe dashboard, test + live) and the shared secret
# the daily Cron job sends in x-referral-cron-secret.
supabase secrets set REFERRAL_COUPON_ID='<coupon id>'
supabase secrets set REFERRAL_CRON_SECRET='<random-string, 32+ bytes>'
# delete-account: HMAC key for the emailed deletion-confirmation tokens.
# Internal only (never leaves the function); rotating it just invalidates
# any confirmation links already in flight.
supabase secrets set DELETE_ACCOUNT_TOKEN_SECRET='<random-string, 32+ bytes>'
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are **auto-injected** by the runtime - don't set them manually.

`SITE_URL` is where `create-checkout-session` and `create-portal-session` send the
customer afterwards (`/account?checkout=success`, `/pricing`, `/account`). These
used to come from the request body, which let a caller redirect a paying customer
to any site. It defaults to `https://salelinx.com` if unset, so set it on any
non-production project or checkout will bounce users to the live site.

## Auth inside a function

The `authed` functions use the caller's JWT:

```ts
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_ANON_KEY")!,
  { global: { headers: { Authorization: req.headers.get("Authorization")! } } },
);
const {
  data: { user },
} = await supabase.auth.getUser();
```

RLS policies apply as if the user was hitting Postgres directly - no need to re-check permissions in app code.

## Webhook signature verification

### Stripe

Stripe webhooks use HMAC signatures. Deno requires the async variant:

```ts
const cryptoProvider = Stripe.createSubtleCryptoProvider();
const event = await stripe.webhooks.constructEventAsync(
  body,
  signature,
  secret,
  undefined,
  cryptoProvider,
);
```

Using the sync `constructEvent` will throw in Deno - always use `constructEventAsync`.

### Supabase Auth Send Email Hook (Standard Webhooks)

The hook is signed with the [Standard Webhooks](https://www.standardwebhooks.com/) scheme (svix-compatible). Headers: `webhook-id`, `webhook-timestamp`, `webhook-signature`. Read the raw body first, then verify:

```ts
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

const secret = Deno.env.get("SEND_EMAIL_HOOK_SECRET")!.replace(/^v1,whsec_/, "");
const wh = new Webhook(secret);
const rawBody = await req.text();
const payload = wh.verify(rawBody, Object.fromEntries(req.headers));
```

The signing secret is shown in the Supabase dashboard (Auth → Hooks → Send email hook) as `v1,whsec_<base64>`. Strip the `v1,whsec_` prefix before passing to `new Webhook()`.

## Send email hook + Resend

`send-auth-email` is how Supabase Auth delivers signup confirmation, password reset, magic link, invite, and email-change messages. Flow:

```
User action (signup / forgot password / change email)
  ▼
Supabase Auth prepares the email
  ▼
POST https://<project-ref>.supabase.co/functions/v1/send-auth-email
  signed with webhook-id / webhook-timestamp / webhook-signature
  body: { user, email_data: { token, token_hash, redirect_to, email_action_type, ... } }
  ▼
Edge Function: verify signature -> render HTML template -> POST to Resend API
  ▼
User receives branded email; link goes to {SUPABASE_URL}/auth/v1/verify?...
  ▼
Supabase verifies the token and redirects to redirect_to (our /auth/callback)
```

The function handles all `email_action_type` values: `signup`, `recovery`, `magiclink`, `invite`, `email_change`, `email_change_current`, `email_change_new`, `reauthentication`. Templates live in `supabase/functions/send-auth-email/templates.ts`.

### Localized emails

Templates are translated to `en` / `fr` / `es` / `de`. The function resolves the recipient's locale from `user.user_metadata.preferred_locale` and falls back to `en` when absent or unknown.

The web app writes `preferred_locale` into metadata at:

- signup (`app/[locale]/auth/signup/page.tsx` - `signUp({ options.data.preferred_locale })`)
- password-reset click in `AccountSecurityCard` (via `updateUser` before `resetPasswordForEmail`)
- email-change in `AccountSecurityCard` (passed alongside the new email on `updateUser`)
- confirmation resend in `VerifyEmailBanner` (`updateUser` before `resend`)

Unauthenticated flows (forgot-password on `/<locale>/auth/forgot-password`) cannot update the user's metadata before calling `resetPasswordForEmail`, so the email locale reflects whatever was last stored on the user; fallback is `en`.

Once the hook is registered in the Supabase dashboard, Supabase stops sending via SMTP entirely - the hook owns 100% of auth emails. A non-200 response causes the underlying auth action (signup, reset, etc.) to fail visibly to the user, so the function must stay healthy.

## Send support email

`send-support-email` is the target of two Supabase **Database Webhooks** (set up in the dashboard under Database -> Webhooks):

| Webhook                       | Table                     | Event  |
| ----------------------------- | ------------------------- | ------ |
| `support-ticket-created`      | `support_tickets`         | INSERT |
| `support-ticket-reply-created`| `support_ticket_replies`  | INSERT |

Both webhooks send a custom header `x-support-webhook-secret: <SUPPORT_NOTIFY_HOOK_SECRET>` that the function verifies before doing anything else. `verify_jwt = false` for the same ES256 reason as the other functions.

Payload shape (standard Supabase Database Webhook):

```json
{
  "type": "INSERT",
  "table": "support_tickets",
  "schema": "public",
  "record": { "id": "...", "user_id": "...", "type": "bug", "message": "...", "platform": "depop", ... },
  "old_record": null
}
```

Flow per webhook:

```
support_tickets INSERT
  ▼
Database Webhook POSTs to send-support-email with x-support-webhook-secret
  ▼
Function: verify header -> auth.admin.getUserById(record.user_id) -> render templates
  ▼
1. STAFF notif -> Resend (From: SUPPORT_NOTIFY_FROM, To: SUPPORT_NOTIFY_TO, Reply-To: author)
  ▼
   Synthesize Message-ID <{id}@{from-domain}> and
   UPDATE support_tickets SET notification_message_id = <message-id>
  ▼
2. AUTO-ACK -> Resend (To: author, Reply-To: SUPPORT_NOTIFY_NOREPLY)  [best-effort;
   a failure is logged but does not fail the webhook]
```

```
support_ticket_replies INSERT
  ▼
Database Webhook POSTs to send-support-email
  ▼
Function: verify header
  ▼
SELECT id, type, message, user_id, notification_message_id FROM support_tickets WHERE id = ticket_id
  ▼
if record.is_admin = true  (admin reply):
   look up the OWNER's email (ticket.user_id, NOT record.user_id)
   POST to Resend (To: owner, From: SUPPORT_NOTIFY_FROM, Reply-To: SUPPORT_NOTIFY_NOREPLY)
   presented as "SaleLinx Support"; NOT threaded (owner never saw the staff thread)
else  (user reply):
   POST staff notif (To: SUPPORT_NOTIFY_TO, Reply-To: user)
   In-Reply-To + References = parent notification_message_id -> Gmail threads it
```

The admin-reply recipient is the **ticket owner**, never the admin who authored it. Staff-side threading is best-effort: if the ticket's notification predates this function, `notification_message_id` is null and the user-reply notification arrives as a fresh thread.

See `docs/SUPPORT.md` for the end-to-end ticket flow.

## Send shipping labels

`send-shipping-labels` is called by the Chrome extension when the user emails a merged shipping-label PDF to themselves or a co-worker. Flow:

```
User clicks "Email labels" in the extension
  ▼
Extension POSTs to https://<project-ref>.supabase.co/functions/v1/send-shipping-labels
  Authorization: Bearer <user JWT>
  body: { to, pdfBase64, filename, count }
  ▼
Function: validate JWT via supabase.auth.getUser(jwt) -> 401 if invalid
  ▼
Entitlement gate: caller's active/trialing subscription tier must have
features.shipping_label_email = true (read via user-scoped client, RLS
"own read") -> 403 upgrade_required otherwise
  ▼
Rate limit: increment_usage_counter('shipping_label_emails', YYYY-MM-DD)
-> 429 rate_limited past 50 sends/day
  ▼
Validate payload: filename shape, count 1..500, attachment starts with
%PDF magic bytes, <= 25MB
  ▼
POST to Resend with the base64 PDF as an attachment
  ▼
Recipient receives the labels in their inbox
```

The function lives in this repo (not the extension) because all Edge Functions deploy from a single workspace; the extension just calls the URL. It deploys with `--no-verify-jwt` for the same ES256 reason as the authed Stripe functions.

Abuse posture: this function sends from our verified Resend domain to a recipient the caller chooses (users legitimately email labels to print shops or co-workers), so everything else is locked down. Subject and body are fixed server-side (no caller overrides), the attachment must actually be a PDF, the feature is gated to tiers with `shipping_label_email`, and sends are capped per user per day. Do not reintroduce subject/body overrides or drop the tier gate.

## Report telemetry (endpoint health)

`report-telemetry` receives batched, anonymous endpoint-health counters from the
extension. Roughly one request per install per day, each carrying a few dozen
counter rows, so this is a low-volume endpoint.

Request body:

```json
{
  "entries": [
    {
      "endpoint_key": "vinted:POST /api/v2/item_upload/drafts",
      "platform": "vinted",
      "outcome": "client_error",
      "status_code": 422,
      "count": 11,
      "extension_version": "1.1.0",
      "bucket_hour": "2026-08-18T14:00:00.000Z"
    }
  ]
}
```

The handler validates the caller's JWT with `getUser(jwt)` and then **discards
the identity** - it exists to stop anonymous spam, not to attribute data. It
forwards the batch to the `record_endpoint_health(jsonb)` RPC using the service
role. That RPC re-validates every field and silently drops malformed entries
rather than failing the batch, so one bad row from an old build cannot cost us
the good rows reported alongside it.

Caps: 500 entries per batch, 256KB body, 100,000 per individual counter. The
per-counter cap matters - without it a single client could claim millions of
calls and dominate the cross-user aggregate on its own.

There are no new secrets: it uses `SUPABASE_URL`, `SUPABASE_ANON_KEY` and
`SUPABASE_SERVICE_ROLE_KEY`, which are already set.

```bash
supabase functions deploy report-telemetry --no-verify-jwt
supabase functions deploy report-selftest --no-verify-jwt
```

Read side: `/admin/health` (see `docs/ADMIN.md`). Privacy rationale and the
"never add a user_id" rule: `docs/GDPR.md`.

## Wiring up resolve-category

The function is deployed and its `_generated/` tables are in place, but **nothing calls
it**. `grep -rn "resolve-category"` across the extension repo returns nothing. Until the
work below is done, the crosslister resolves categories from its own bundled copies in
`src/data/category-maps-depop.ts` / `category-maps-vinted.ts`, so neither goal of the
migration (tables out of the .crx, unpatchable crosslist gate) actually holds.

Outstanding:

1. **Write the sync script.** Both this repo's `CLAUDE.md` and the headers inside
   `_generated/` refer to a script that does not exist in either repo, under two
   different names (`npm run sync:category-maps` and `scripts/sync-category-maps.mjs`).
   Nothing has ever generated these files automatically; the first copy was made by hand.
2. **Reconcile the drift first.** `_generated/` has already been refactored server-side
   in ways the extension source has not: shared types were hoisted into
   `crosslist-category.ts` and the package-size defaults were split into
   `package-size.ts`, neither of which exists in the extension. A naive copy would
   regress those. Decide which side owns the shape before automating the copy.
3. **Add the extension-side call** (`functions.invoke('resolve-category', ...)`, the same
   pattern as `send-shipping-labels` in `src/background/handlers/shipping-handlers.ts`),
   with a fallback path for offline / function-down.
4. **Only then delete the bundled tables** from the extension, and update that repo's
   `docs/technical/CROSSLISTING.md` and `DATA-MAPPINGS.md`, which currently describe
   local resolution only.

Until step 3 lands, treat any doc claiming the tables "live only here" as aspirational.

## Excluded from TypeScript checks

`supabase/functions` is in `tsconfig.json`'s `exclude` array. Next.js's type checker can't resolve `https://esm.sh/...` imports, so we just tell it to ignore that folder. **This means TS errors in Edge Functions won't surface until you deploy** - be careful.

If you want type safety locally, open individual function files in VSCode with the Deno extension installed.

## Gotchas

- **Don't JSON-parse the request body before signature verification** - use `req.text()` first, then pass that string to `constructEventAsync` (Stripe) or `wh.verify` (Standard Webhooks). Parsing mutates whitespace and breaks the signature.
- **Deno imports are cached in the deploy** - if you bump a version in the URL and redeploy, it fetches fresh. Small latency on first request after deploy.
- **`Deno.env.get(X)!` is a footgun** - if the secret isn't set, you get a runtime `null` crash. Set all secrets before first deploy.
- **Cold starts are ~300ms** - not blazing fast. Keep logic minimal; push heavy work async.
- **Stripe SDK version must match between web + functions** - both should be on the same major. Currently `17.x`.
- **CORS** - Edge Functions auto-add permissive CORS headers; don't re-add them or you get duplicates.
- **`SEND_EMAIL_HOOK_SECRET` needs the `v1,whsec_` prefix stripped** before passing to `new Webhook(...)` - store the full value including the prefix in the secret, strip at read-time.
- **`email_change_current` goes to the OLD email address** (from `email_data.old_email`), `email_change_new` goes to the new one - use the right field for the recipient.
- **`email_change_new` uses `token_hash_new`**, not `token_hash`, when building the verify URL.
- **A failing hook breaks auth UX** - if `send-auth-email` returns non-200, the user sees "failed to send" on signup / reset. Monitor function logs after every deploy.
- **Never `console.log` personal data** - no email addresses, message bodies, or buyer data in function logs; user UUIDs are the ceiling. Function logs are retained by Supabase outside our control. See `docs/GDPR.md`.
- **Per-user rate limits** (all via `increment_usage_counter`, keyed on the caller's auth.uid): `send-shipping-labels` 15/day, `delete-account` request stage 5/day, `create-checkout-session` 20/day, `create-portal-session` 20/day, account email-change 5/day. Support ticket and reply creation are capped by DB triggers instead (migration 014 tickets, `018_rate_limit_gaps` replies); `listings` and `linked_accounts` by row-count triggers (017).
- **Auth emails depend on GoTrue's dashboard limits, not this repo.** Password reset, email verification resend, magic link, and email change all send via the `send-auth-email` hook and are rate limited by Supabase GoTrue (dashboard > Authentication > Rate Limits), which is NOT visible in-repo. The email-change path additionally has an app-level 5/day counter because it emails a user-chosen (attacker-controllable) address, but a stolen token calling GoTrue directly is bounded only by the dashboard limits. Review those limits; the defaults are permissive.


## report-selftest

Stores one admin endpoint self-test run (migration `034_endpoint_selftest.sql`).

The contrast with `report-telemetry` is the point. That function validates the
JWT purely as a spam gate and then discards the identity, because
`endpoint_health` is deliberately anonymous. This one keeps the identity: a run
history with no runner attached is not an audit trail.

That makes its admin check a real security boundary, not a UI nicety. The
extension's `isCurrentUserAdmin()` is a bare `admin_users` lookup on the client
- fine for deciding whether to show a panel section, worthless as authorisation.
So membership is re-checked in the handler with the service role, against the id
from the **verified JWT** (never from the request body), and again inside
`record_selftest_run`.

**Why not `is_admin()`:** it requires AAL2 (migration `009_admin_mfa.sql`),
which means a TOTP challenge. The extension has no MFA flow and cannot mint an
aal2 session, so gating on it would make the function permanently uncallable.
The compensating control is that this function is write-only - it exposes no
read path and no destructive action, so a non-MFA admin session cannot use it to
reach admin data. The read side (`admin_selftest_runs()`,
`admin_selftest_results()`) still requires AAL2.

Payload:

```json
{
  "platform": "vinted",
  "extension_version": "1.4.2",
  "included_throwaway": false,
  "started_at": "2026-08-19T10:00:00Z",
  "finished_at": "2026-08-19T10:04:12Z",
  "results": [
    { "endpoint_key": "vinted:GET /api/v2/users/current",
      "outcome": "ok", "status_code": 200, "duration_ms": 142 }
  ]
}
```

Run counts (`total` / `passed` / `failed` / `skipped`) are derived server-side
from the rows actually stored, never taken from the client - a client-supplied
summary that disagreed with its own results would make the dashboard lie.

Deploy: `supabase functions deploy report-selftest --no-verify-jwt`
