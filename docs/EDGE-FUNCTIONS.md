# Edge Functions

Three Supabase Edge Functions live in `supabase/functions/`. They run on Supabase's Deno runtime, **not** Next.js / Vercel / Node.

## Why Edge Functions, not Next.js route handlers?

- **`stripe-webhook`** — lives next to Supabase so it has direct service-role access to the DB without exposing it to Vercel env. Also simpler to lock down (`verify_jwt = false`).
- **`create-checkout-session` / `create-portal-session`** — could live in Next.js, but keeping all Stripe-adjacent code in one place is easier to reason about. Single deploy target, single set of secrets.

## The three functions

| Function                  | `verify_jwt` | Purpose                                                                    |
| ------------------------- | ------------ | -------------------------------------------------------------------------- |
| `stripe-webhook`          | false        | Stripe POSTs here; we verify with `STRIPE_WEBHOOK_SECRET` instead          |
| `create-checkout-session` | false*       | Authed user requests a Stripe Checkout URL. Auth enforced by `getUser()`.  |
| `create-portal-session`   | false*       | Authed user requests a Stripe Customer Portal URL. Same pattern.           |

\*`verify_jwt` is false because the Supabase gateway's built-in JWT check only supports HS256, and our project issues ES256 tokens. Each authed function calls `supabase.auth.getUser()` in the handler and returns 401 if null — Supabase's user endpoint validates ES256 correctly, so auth is still enforced.

All three import Stripe + Supabase clients from `esm.sh`. Deno uses URL imports, not `node_modules`.

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
```

## Secrets

Edge Functions don't read `.env.local`. Set secrets explicitly:

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are **auto-injected** by the runtime — don't set them manually.

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

RLS policies apply as if the user was hitting Postgres directly — no need to re-check permissions in app code.

## Webhook signature verification

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

Using the sync `constructEvent` will throw in Deno — always use `constructEventAsync`.

## Excluded from TypeScript checks

`supabase/functions` is in `tsconfig.json`'s `exclude` array. Next.js's type checker can't resolve `https://esm.sh/...` imports, so we just tell it to ignore that folder. **This means TS errors in Edge Functions won't surface until you deploy** — be careful.

If you want type safety locally, open individual function files in VSCode with the Deno extension installed.

## Gotchas

- **Don't JSON-parse the request body before signature verification** — use `req.text()` first, then pass that string to `constructEventAsync`. Parsing mutates whitespace and breaks the signature.
- **Deno imports are cached in the deploy** — if you bump a version in the URL and redeploy, it fetches fresh. Small latency on first request after deploy.
- **`Deno.env.get(X)!` is a footgun** — if the secret isn't set, you get a runtime `null` crash. Set all secrets before first deploy.
- **Cold starts are ~300ms** — not blazing fast. Keep logic minimal; push heavy work async.
- **Stripe SDK version must match between web + functions** — both should be on the same major. Currently `17.x`.
- **CORS** — Edge Functions auto-add permissive CORS headers; don't re-add them or you get duplicates.
