# Auth

Email + password auth via Supabase. No magic links, no social providers (for now).

## Pages

| Route                   | Server/Client        | What it does                                                                                                                |
| ----------------------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `/auth/signup`          | Client               | Email + password + confirm. Validates ≥ 8 chars + match. Calls `signUp()`. Shows "check your email" on success.             |
| `/auth/login`           | Client               | Email + password. Calls `signInWithPassword()`. Redirects to `/account`.                                                    |
| `/auth/forgot-password` | Client               | Email only. Calls `resetPasswordForEmail()`. Shows "check your email".                                                      |
| `/auth/reset-password`  | Client               | New password + confirm. Calls `updateUser({ password })`. User must have a session from clicking the reset link.            |
| `/auth/callback`        | Route handler        | Exchanges `?code=...` for a session cookie. Used by signup verification, password recovery. Redirects to `?next=...` param. |
| `/auth/signout`         | Route handler (POST) | Calls `signOut()` and redirects to `/`. Plain HTML form submit.                                                             |

## Signup flow

```
User submits email + password
  ▼
supabase.auth.signUp({ email, password, emailRedirectTo: /auth/callback?next=/account })
  ▼
Supabase sends verification email
  ▼
User clicks link → /auth/callback?code=...&next=/account
  ▼
exchangeCodeForSession → session cookie set
  ▼
redirect to /account
  ▼
user.email_confirmed_at now set → banner hidden
```

**If Supabase "Confirm email" is OFF** — signup returns a session immediately and the user lands on `/account` without the email step. The signup page handles both.

## Login flow

```
User submits email + password
  ▼
supabase.auth.signInWithPassword()
  ▼
Session cookie set
  ▼
router.push('/account') + router.refresh() (triggers server component re-render so Header updates)
```

## Password reset flow

```
User enters email on /auth/forgot-password
  ▼
supabase.auth.resetPasswordForEmail(email, { redirectTo: /auth/callback?next=/auth/reset-password })
  ▼
Supabase sends recovery email
  ▼
User clicks link → /auth/callback?code=...&next=/auth/reset-password
  ▼
Code exchanged → temporary session
  ▼
User lands on /auth/reset-password, enters new password
  ▼
supabase.auth.updateUser({ password })
  ▼
redirect to /account
```

## Protecting routes

Two patterns:

### Server Component (preferred)

```ts
const supabase = await createServerClient();
const {
  data: { user },
} = await supabase.auth.getUser();
if (!user) redirect("/auth/login");
```

See `app/account/page.tsx`.

### Edge Function

```ts
const supabase = createClient(url, anonKey, {
  global: { headers: { Authorization: req.headers.get("Authorization")! } },
});
const {
  data: { user },
} = await supabase.auth.getUser();
if (!user) return new Response("Unauthorized", { status: 401 });
```

See `supabase/functions/create-checkout-session/index.ts`.

## Auth cookies + `proxy.ts`

Next.js 16 renamed `middleware.ts` → `proxy.ts`. The file MUST export a function called `proxy` (not `middleware`). It runs on every request and:

1. Reads Supabase auth cookies from the incoming request
2. Calls `supabase.auth.getUser()` (Supabase refreshes the token if it's close to expiry)
3. Sets updated cookies on the response

Without this, access tokens silently expire and users get unexpectedly logged out.

## Email verification banner

`components/VerifyEmailBanner.tsx` — appears on `/account` when `user.email_confirmed_at` is null. Has a "Resend link" button that calls `supabase.auth.resend({ type: 'signup' })`.

## Header state

`components/Header.tsx` is a **Server Component** — it reads the user on every request. Means:

- Signed-in and signed-out states render correctly without client-side JS
- No flash of wrong UI on page load
- Pages become dynamic (server-rendered on demand) instead of static, which is fine

## Supabase config needed

See `README.md` and the **"Supabase config needed"** checklist — Site URL, Redirect URLs, Confirm email, password min length, SMTP.

## Gotchas

- **`proxy.ts` must export `proxy`, not `middleware`** — Next 16 renamed the convention.
- **`setAll` cookie callbacks need an explicit `CookieEntry[]` type** — otherwise TS strict mode flags implicit `any`.
- **Server Components can't set cookies directly** — the `try/catch` in `lib/supabase/server.ts` swallows that error because `proxy.ts` handles refresh instead.
- **`router.refresh()` after password login** — without it, the Header still shows the signed-out state until the user navigates.
- **`email_confirmed_at` only updates after the user clicks the link** — checking it right after `signUp()` will always be null.
- **Supabase default SMTP has a 2 emails/hour rate limit** — configure Resend before any real testing.
