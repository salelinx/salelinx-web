# Edge Functions

Six Supabase Edge Functions live in `supabase/functions/`. They run on Supabase's Deno runtime, **not** Next.js / Vercel / Node.

## Why Edge Functions, not Next.js route handlers?

- **`stripe-webhook`** - lives next to Supabase so it has direct service-role access to the DB without exposing it to Vercel env. Also simpler to lock down (`verify_jwt = false`).
- **`create-checkout-session` / `create-portal-session`** - could live in Next.js, but keeping all Stripe-adjacent code in one place is easier to reason about. Single deploy target, single set of secrets.
- **`send-auth-email`** - must be reachable from Supabase Auth's Send Email Hook; an Edge Function URL is the natural fit.
- **`send-support-email`** - target of two Supabase Database Webhooks (insert on `support_tickets`, insert on `support_ticket_replies`). Needs service-role read on `auth.users` and write back to `support_tickets.notification_message_id`, so Supabase is the natural home.
- **`send-shipping-labels`** - called by the Chrome extension to email a merged shipping-label PDF via Resend. Lives here (not in the extension) because Edge Function deploys are co-located with everything else Supabase-adjacent, and the extension only needs the function URL.

## The six functions

| Function                  | `verify_jwt` | Purpose                                                                                                  |
| ------------------------- | ------------ | -------------------------------------------------------------------------------------------------------- |
| `stripe-webhook`          | false        | Stripe POSTs here; we verify with `STRIPE_WEBHOOK_SECRET` instead                                        |
| `create-checkout-session` | false*       | Authed user requests a Stripe Checkout URL. Auth enforced by `getUser()`.                                |
| `create-portal-session`   | false*       | Authed user requests a Stripe Customer Portal URL. Same pattern.                                         |
| `send-auth-email`         | false        | Supabase Auth POSTs here for every auth email; signed, delivered via Resend                              |
| `send-support-email`      | false        | Database Webhooks POST here on new ticket / new reply; emails staff, the auto-ack, and admin-reply-to-user via Resend |
| `send-shipping-labels`    | false*       | Extension POSTs a base64 PDF + recipient; auth enforced by `getUser(jwt)`; delivered via Resend          |

\*`verify_jwt` is false because the Supabase gateway's built-in JWT check only supports HS256, and our project issues ES256 tokens. Each authed function calls `supabase.auth.getUser()` in the handler and returns 401 if null - Supabase's user endpoint validates ES256 correctly, so auth is still enforced.

`stripe-webhook`, `create-checkout-session`, and `create-portal-session` import Stripe + Supabase clients from `esm.sh`. `send-auth-email` imports `standardwebhooks` from `esm.sh` and uses plain `fetch` for the Resend API. `send-support-email` imports `@supabase/supabase-js` from `esm.sh` and uses plain `fetch` for Resend. `send-shipping-labels` imports `@supabase/supabase-js` from `jsr:` and uses plain `fetch` for Resend. Deno uses URL imports, not `node_modules`.

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
supabase secrets set SUPPORT_NOTIFY_HOOK_SECRET='<random-string>'
# send-shipping-labels reuses RESEND_API_KEY and RESEND_FROM - no extra secrets.
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are **auto-injected** by the runtime - don't set them manually.

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
2. AUTO-ACK -> Resend (To: author, Reply-To: SUPPORT_NOTIFY_TO)  [best-effort; a
   failure is logged but does not fail the webhook]
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
   POST to Resend (To: owner, From: SUPPORT_NOTIFY_FROM, Reply-To: SUPPORT_NOTIFY_TO)
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
  body: { to, pdfBase64, filename, count, subject?, body? }
  ▼
Function: validate JWT via supabase.auth.getUser(jwt) -> 401 if invalid
  ▼
POST to Resend with the base64 PDF as an attachment
  ▼
Recipient receives the labels in their inbox
```

The function lives in this repo (not the extension) because all Edge Functions deploy from a single workspace; the extension just calls the URL. It deploys with `--no-verify-jwt` for the same ES256 reason as the authed Stripe functions.

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
