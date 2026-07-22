// deno-lint-ignore-file
// Supabase "Send Email Hook" target. Supabase POSTs here for every auth email
// (signup, recovery, invite, magiclink, email_change, reauthentication) instead
// of sending via SMTP. We verify the webhook signature, render an HTML template,
// and hand it to Resend.
//
// Dashboard config: Authentication -> Hooks -> "Send email hook" -> HTTPS URL
//   https://<project-ref>.supabase.co/functions/v1/send-auth-email
// The dashboard reveals the signing secret in the form `v1,whsec_<base64>`.

import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";
import {
  type EmailActionType,
  type Locale,
  renderEmail,
  type RenderInput,
} from "./templates.ts";

type SupabaseEmailHookPayload = {
  user: {
    id: string;
    email: string;
    user_metadata?: Record<string, unknown>;
    [key: string]: unknown;
  };
  email_data: {
    token: string;
    token_hash: string;
    token_new?: string;
    token_hash_new?: string;
    old_email?: string;
    redirect_to: string;
    email_action_type: EmailActionType;
    site_url: string;
    [key: string]: unknown;
  };
};

const SUPPORTED_LOCALES: ReadonlyArray<Locale> = ["en", "fr", "es", "de"];

function resolveLocale(payload: SupabaseEmailHookPayload): Locale {
  const raw = payload.user.user_metadata?.preferred_locale;
  if (typeof raw === "string" && SUPPORTED_LOCALES.includes(raw as Locale)) {
    return raw as Locale;
  }
  return "en";
}

const HOOK_SECRET_RAW = Deno.env.get("SEND_EMAIL_HOOK_SECRET") ?? "";
const HOOK_SECRET = HOOK_SECRET_RAW.replace(/^v1,whsec_/, "");
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const RESEND_FROM = Deno.env.get("RESEND_FROM") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
// Public site origin, e.g. https://www.salelinx.com. Auth email links point
// here, not at Supabase (see buildVerifyUrl). Falls back to the hook payload's
// site_url when unset so a missing secret degrades rather than breaks.
const SITE_URL = Deno.env.get("SITE_URL") ?? "";

// The link must NOT point at Supabase's /auth/v1/verify. That URL consumes the
// one-time token on any GET, and mail security scanners (Outlook Safe Links,
// Gmail, Proofpoint) plus link-tracking proxies fetch every URL in an inbound
// email on delivery. The scanner spends the token seconds after send, and the
// real click then fails with "One-time token not found", surfaced to the user
// as otp_expired. Observed in the auth logs: a successful 303 /verify 7 seconds
// after /recover, then 403 on the human's click 8 seconds later.
//
// So we point at our own /auth/confirm page, which holds the token_hash and
// only calls verifyOtp after an explicit button press. Scanners fetch, they do
// not click, so the token survives until the user acts on it.
function buildVerifyUrl(
  actionType: EmailActionType,
  emailData: SupabaseEmailHookPayload["email_data"],
): string {
  // email_change_new uses token_hash_new (sent to the new address).
  const tokenHash =
    actionType === "email_change_new" && emailData.token_hash_new
      ? emailData.token_hash_new
      : emailData.token_hash;

  // redirect_to is where the user should land AFTER verification succeeds. It
  // is already allowlisted in Supabase and is same-origin with SITE_URL, so we
  // pass it through as `next` for /auth/confirm to forward to.
  const params = new URLSearchParams({
    token_hash: tokenHash,
    type: actionType,
    next: emailData.redirect_to,
  });
  const origin = SITE_URL || emailData.site_url;
  return `${origin.replace(/\/$/, "")}/auth/confirm?${params.toString()}`;
}

async function sendViaResend(args: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: [args.to],
      subject: args.subject,
      html: args.html,
      text: args.text,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`resend ${res.status}: ${body}`);
  }
}

function hookError(httpCode: number, message: string): Response {
  return new Response(
    JSON.stringify({ error: { http_code: httpCode, message } }),
    { status: httpCode, headers: { "Content-Type": "application/json" } },
  );
}

Deno.serve(async (req) => {
  if (!HOOK_SECRET || !RESEND_API_KEY || !RESEND_FROM) {
    console.error("[send-auth-email] missing required env");
    return hookError(500, "email hook misconfigured");
  }

  const rawBody = await req.text();
  const headers = Object.fromEntries(req.headers);

  let payload: SupabaseEmailHookPayload;
  try {
    const wh = new Webhook(HOOK_SECRET);
    payload = wh.verify(rawBody, headers) as SupabaseEmailHookPayload;
  } catch (err) {
    console.error("[send-auth-email] signature verify failed:", err);
    return hookError(401, "invalid webhook signature");
  }

  const { user, email_data } = payload;
  const actionType = email_data.email_action_type;

  // For email_change_current, the message goes to the *old* address.
  const recipient =
    actionType === "email_change_current" && email_data.old_email
      ? email_data.old_email
      : user.email;

  const verifyUrl = buildVerifyUrl(actionType, email_data);
  const locale = resolveLocale(payload);

  const rendered = renderEmail({
    actionType,
    verifyUrl,
    token: email_data.token,
    recipientEmail: recipient,
    siteUrl: email_data.site_url,
    locale,
  } satisfies RenderInput);

  // Never log the recipient email: it is personal data and function logs are
  // retained outside our control. The user id is enough to correlate.
  console.log(
    `[send-auth-email] type=${actionType} locale=${locale} user=${user.id}`,
  );

  try {
    await sendViaResend({
      to: recipient,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
  } catch (err) {
    console.error(`[send-auth-email] resend failed for ${actionType}:`, err);
    return hookError(502, "email delivery failed");
  }

  return new Response(JSON.stringify({}), {
    headers: { "Content-Type": "application/json" },
  });
});
