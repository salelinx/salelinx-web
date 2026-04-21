# Edge Functions

Four Supabase Edge Functions live in `supabase/functions/`. They run on Supabase's Deno runtime, **not** Next.js / Vercel / Node.

## Why Edge Functions, not Next.js route handlers?

- **`stripe-webhook`** - lives next to Supabase so it has direct service-role access to the DB without exposing it to Vercel env. Also simpler to lock down (`verify_jwt = false`).
- **`create-checkout-session` / `create-portal-session`** - could live in Next.js, but keeping all Stripe-adjacent code in one place is easier to reason about. Single deploy target, single set of secrets.
- **`send-auth-email`** - must be reachable from Supabase Auth's Send Email Hook; an Edge Function URL is the natural fit.

## The four functions

| Function                  | `verify_jwt` | Purpose                                                                    |
| ------------------------- | ------------ | -------------------------------------------------------------------------- |
| `stripe-webhook`          | false        | Stripe POSTs here; we verify with `STRIPE_WEBHOOK_SECRET` instead          |
| `create-checkout-session` | false*       | Authed user requests a Stripe Checkout URL. Auth enforced by `getUser()`.  |
| `create-portal-session`   | false*       | Authed user requests a Stripe Customer Portal URL. Same pattern.           |
| `send-auth-email`         | false        | Supabase Auth POSTs here for every auth email; signed, delivered via Resend|

\*`verify_jwt` is false because the Supabase gateway's built-in JWT check only supports HS256, and our project issues ES256 tokens. Each authed function calls `supabase.auth.getUser()` in the handler and returns 401 if null - Supabase's user endpoint validates ES256 correctly, so auth is still enforced.

`stripe-webhook`, `create-checkout-session`, and `create-portal-session` import Stripe + Supabase clients from `esm.sh`. `send-auth-email` imports `standardwebhooks` from `esm.sh` and uses plain `fetch` for the Resend API. Deno uses URL imports, not `node_modules`.

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
```

## Secrets

Edge Functions don't read `.env.local`. Set secrets explicitly:

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
supabase secrets set RESEND_API_KEY=re_...
supabase secrets set RESEND_FROM='SaleLinx <no-reply@yourdomain.com>'
supabase secrets set SEND_EMAIL_HOOK_SECRET='v1,whsec_...'
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

Once the hook is registered in the Supabase dashboard, Supabase stops sending via SMTP entirely - the hook owns 100% of auth emails. A non-200 response causes the underlying auth action (signup, reset, etc.) to fail visibly to the user, so the function must stay healthy.

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
