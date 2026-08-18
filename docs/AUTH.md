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
| `/auth/mfa`             | Client               | MFA challenge: 6-digit TOTP code upgrades the session AAL1 -> AAL2. Hard-navigates to `?next=...` (path-only, validated).   |

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

**If Supabase "Confirm email" is OFF** - signup returns a session immediately and the user lands on `/account` without the email step. The signup page handles both.

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

## MFA (TOTP)

Optional for regular users, required for admins (`is_admin()` in Postgres only returns true for AAL2 sessions - migration `009_admin_mfa.sql`, see `docs/ADMIN.md`).

- **Enroll:** Account > Security card > "Enable 2FA". `mfa.enroll({ factorType: 'totp' })` -> QR + manual key -> user enters the first code -> `challenge()` + `verify()` activates the factor. Abandoned (unverified) factors are cleaned up before re-enrolling.
- **Challenge:** a password login always starts at AAL1. `/auth/mfa` prompts for a code and upgrades the session to AAL2. The admin gates redirect there with `?next=<path>`.
- **Disable:** requires entering a current code (verifying also raises the session to AAL2, which `unenroll` demands).
- **Recovery:** Supabase TOTP has no backup codes. A lost factor is removed in the Supabase dashboard (Authentication > Users > the user > factors) - dashboard access does not depend on app MFA.

## Password reset flow

```
User enters email on /auth/forgot-password
  ▼
supabase.auth.resetPasswordForEmail(email, { redirectTo })
  ▼
Supabase Auth fires the send-email hook -> send-auth-email Edge Function
  ▼
Function emails a link to OUR page, never to /auth/v1/verify:
  {SITE_URL}/auth/confirm?token_hash=...&type=recovery&next=...
  ▼
User clicks. The page renders a button and does NOTHING on load.
  ▼
User presses "Continue to reset password"
  ▼
supabase.auth.verifyOtp({ type: 'recovery', token_hash }) -> recovery session
  ▼
Always routes to /auth/reset-password (never `next`, see below)
  ▼
Page checks a session exists, then supabase.auth.updateUser({ password })
  ▼
redirect to /account
```

Three things about this flow are deliberate and easy to undo by accident:

1. **The link points at our page, not `/auth/v1/verify`.** That endpoint spends the one-time token on any GET, and mail scanners fetch links on delivery. See "Why the link is not a verify URL" below.
2. **`/auth/confirm` must not verify on mount.** The button press is the whole defence. A `useEffect` that auto-verifies reintroduces the bug exactly.
3. **Recovery ignores `next` and always goes to `/auth/reset-password`.** Supabase silently rewrites `redirect_to` to the bare Site URL when the requested URL is not in the Redirect URLs allowlist. Honouring `next` therefore signed the user in and dropped them on the homepage, never asking for a password. A recovery link has exactly one valid destination, so it should not depend on dashboard config.

Because `verifyOtp` takes a `token_hash` rather than exchanging a PKCE code, the link also works in a **different browser** from the one that requested it. The old code-exchange flow did not.

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

`getUser()` is right here because a protected page wants the canonical, server-validated user record. When code only needs "is someone signed in" (the Header, `proxy.ts`), use `supabase.auth.getClaims()` instead: it verifies the JWT locally and skips the network round-trip.

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
2. Calls `supabase.auth.getClaims()` (verifies the JWT locally against the project's ES256 signing keys; the client still refreshes the token when it's close to expiry)
3. Sets updated cookies on the response

Without this, access tokens silently expire and users get unexpectedly logged out.

`getClaims()` is deliberate: `getUser()` makes a network round-trip to the Supabase Auth server, and the proxy runs on every request, so swapping it back adds that latency to every page view. The claims are only used for routing decisions; RLS remains the real data boundary.

## Email verification banner

`components/VerifyEmailBanner.tsx` - appears on `/account` when `user.email_confirmed_at` is null. Has a "Resend link" button that calls `supabase.auth.resend({ type: 'signup' })`.

## Header state

`components/Header.tsx` is a **Server Component** - it checks for a signed-in session on every request (via `getClaims()`, locally verified, no network call). Means:

- Signed-in and signed-out states render correctly without client-side JS
- No flash of wrong UI on page load
- Pages become dynamic (server-rendered on demand) instead of static, which is fine

## Email delivery (Send Email Hook → Resend)

Auth emails do **not** go through Supabase's SMTP. Supabase Auth is configured to POST every email to the `send-auth-email` Edge Function (Authentication → Hooks → Send email hook), which verifies the Standard Webhooks signature, renders an HTML template, and calls Resend.

- Templates live in `supabase/functions/send-auth-email/templates.ts` - one per `email_action_type` (signup, recovery, magiclink, invite, email_change, reauthentication).
- The link in every email points at `${SITE_URL}/auth/confirm?token_hash=<token_hash>&type=<action>&next=<redirect_to>`, **not** at Supabase's `/auth/v1/verify`. See "Why the link is not a verify URL" below. `/auth/confirm` calls `verifyOtp` on a button press and then forwards to `next`.
- For `email_change` with "Secure email change" ON, Supabase fires the hook twice: once to the old address (`email_change_current`, using `old_email` as the recipient) and once to the new address (`email_change_new`, using `token_hash_new` to build the link).
- A non-200 response from the hook causes the underlying auth action to fail with a user-visible error, so the function is a critical path - keep `RESEND_API_KEY`, `RESEND_FROM`, and `SEND_EMAIL_HOOK_SECRET` current.

Full deploy / secret instructions are in `docs/EDGE-FUNCTIONS.md`.

### Why the link is not a verify URL

Supabase's `/auth/v1/verify` consumes the one-time token on **any** GET. Mail security scanners (Outlook Safe Links, Gmail, Proofpoint) and link-tracking proxies fetch every URL in an inbound email on delivery, which spends the token before the recipient ever clicks. The user then sees `otp_expired` on a link that is seconds old.

This was observed in the Auth logs: a successful `303 GET /verify` ("login: request completed") 7 seconds after `POST /recover`, then `403 GET /verify` ("One-time token not found") on the human's click 8 seconds later.

The fix is that the email link lands on our own `/auth/confirm` page, which holds `token_hash` and calls `supabase.auth.verifyOtp({ token_hash, type })` **only from the button's onClick**. Scanners fetch pages; they do not click buttons.

- **Never auto-verify in a `useEffect` on `/auth/confirm`.** That reintroduces the bug exactly, because the scanner's GET would run the effect during SSR/hydration and burn the token.
- The `SITE_URL` secret must be set on the Edge Function (e.g. `https://www.salelinx.com`). It falls back to the hook payload's `site_url` if unset.
- This affects every auth email, not just recovery: signup, magiclink, invite, and email change all route through the same `buildVerifyUrl`.

### When a link genuinely fails

`proxy.ts` watches for `?error_code=` on any request (Supabase redirects to the Site URL with the error attached when verification fails) and forwards to `/auth/link-error`, which explains what happened and offers a new link. Supabase repeats the error in the URL hash, which never reaches the server, so that page also reads the hash client-side.

`/auth/callback` returns to `/auth/link-error` when `exchangeCodeForSession` fails, rather than redirecting onward to a page that needs a session it does not have. `/auth/reset-password` checks for a session before rendering its form for the same reason.

## Supabase config needed

See `README.md` and the **"Supabase config needed"** checklist - Site URL, Redirect URLs, Confirm email, password min length, and the Send Email Hook registration.

## Gotchas

- **`proxy.ts` must export `proxy`, not `middleware`** - Next 16 renamed the convention.
- **`setAll` cookie callbacks need an explicit `CookieEntry[]` type** - otherwise TS strict mode flags implicit `any`.
- **Server Components can't set cookies directly** - the `try/catch` in `lib/supabase/server.ts` swallows that error because `proxy.ts` handles refresh instead.
- **`router.refresh()` after password login** - without it, the Header still shows the signed-out state until the user navigates.
- **`email_confirmed_at` only updates after the user clicks the link** - checking it right after `signUp()` will always be null.
- **Auth emails go through the Send Email Hook (`send-auth-email` Edge Function), not Supabase SMTP** - Supabase's SMTP panel is irrelevant once the hook is enabled.
- **A broken `send-auth-email` function breaks signup and password reset** - if Resend is down or the hook returns non-200, the user sees a generic "failed to send" error. Watch function logs when changing templates.
- **Signing up with an already-registered email returns a FAKE success** (Supabase anti-enumeration): 200, `confirmation_sent_at` set, but `data.user.identities` is an EMPTY array and no email is sent. Both the signup page and the extension's `cloudSignup` handler check `identities.length === 0` and show "account already exists, sign in instead". Without the check the user waits forever on "check your inbox".
