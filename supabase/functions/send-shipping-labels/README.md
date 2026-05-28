# send-shipping-labels

Supabase Edge Function that attaches a merged shipping-label PDF and sends it via [Resend](https://resend.com). Called from the extension when the user clicks "Send Email" in the Shipping Labels tab.

## One-time setup

1. **Sign up at resend.com** and verify a sending domain (free for up to 100 emails/day, $20/mo for 50k).
2. **Create an API key** at https://resend.com/api-keys.
3. **Set the Supabase secrets** (from the repo root):
   ```sh
   supabase secrets set \
     RESEND_API_KEY=re_xxxxxxxxxxxxxxxx \
     RESEND_FROM='Resale Bot <labels@yourdomain.com>'
   ```
   `RESEND_FROM` must use a domain you verified in Resend. During development you can use Resend's `onboarding@resend.dev` sender (only lets you email the account owner).
4. **Deploy the function** (the `--no-verify-jwt` flag is required — the
   function does its own auth check, and skipping the runtime's check avoids
   an `UNSUPPORTED_TOKEN_ALGORITHM ES256` error on projects with asymmetric
   JWT signing enabled):
   ```sh
   supabase functions deploy send-shipping-labels --no-verify-jwt
   ```

That's it — the extension will detect the function and send emails directly. If the function isn't deployed or the secrets are missing, the extension falls back to opening the user's mail client with the PDF pre-downloaded.

## How auth works

Each call includes the signed-in user's Supabase JWT (the `Authorization: Bearer …` header that `supabase-js` adds automatically via `functions.invoke`). The function verifies the token with `auth.getUser()` before touching Resend, so only logged-in extension users can trigger sends.

## Request shape

```ts
{
  to: string;          // recipient email
  pdfBase64: string;   // base64 merged PDF
  filename: string;    // e.g. "labels-14-Apr-2026-3.pdf"
  count: number;       // label count (used in subject/body)
  subject?: string;    // optional override
  body?: string;       // optional override
}
```

Max attachment size: 25 MB (Resend itself supports 40 MB, but we cap below that to leave headroom for the JSON envelope).

## Response shape

```ts
// success
{ ok: true, messageId: "re_abc123…" }

// failure
{ ok: false, error: string, code?: "not_configured" }
```

`code: "not_configured"` (HTTP 503) signals the extension to fall back to the mailto flow instead of showing an error.
