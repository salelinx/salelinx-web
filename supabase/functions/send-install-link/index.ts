// deno-lint-ignore-file
// send-install-link: emails the caller's own address the Chrome Web Store
// link, for people who sign up on a phone and cannot install the extension
// there (/get-started calls it). A service email the user asked for, so it is
// not gated on the marketing choice.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { EMAIL_ASSETS } from "../_shared/email-theme.ts";
import { corsHeaders as sharedCorsHeaders } from "../_shared/security.ts";
import { installLinkEmail, type Locale, SUPPORTED_LOCALES } from "./email.ts";

const DAILY_CAP = 3;

const corsHeaders = sharedCorsHeaders();

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sendEmail(to: string, locale: Locale): Promise<void> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("RESEND_FROM");
  if (!apiKey || !from) throw new Error("resend env not set");

  const { subject, html, text } = installLinkEmail(locale);
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, html, text, attachments: EMAIL_ASSETS }),
  });
  if (!res.ok) throw new Error(`resend ${res.status}: ${await res.text()}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "unauthorized" }, 401);

  const authClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) return json({ error: "unauthorized" }, 401);
  if (!user.email) return json({ error: "no_email" }, 400);

  const { data: count, error: rlErr } = await authClient.rpc("increment_usage_counter", {
    p_feature: "install_link_emails",
    p_period_key: new Date().toISOString().slice(0, 10),
  });
  if (rlErr) {
    console.error("[send-install-link] rate-limit counter failed:", rlErr.message);
    return json({ error: "rate_limit_check_failed" }, 500);
  }
  if (typeof count === "number" && count > DAILY_CAP) return json({ error: "rate_limited" }, 429);

  let locale: Locale = "en";
  try {
    const body = await req.json();
    if (SUPPORTED_LOCALES.includes(body?.locale)) locale = body.locale;
  } catch {
    // no body: English
  }

  try {
    await sendEmail(user.email, locale);
  } catch (err) {
    console.error(`[send-install-link] email failed for user=${user.id}:`, err);
    return json({ error: "email_failed" }, 502);
  }
  console.log(`[send-install-link] sent user=${user.id}`);
  return json({ ok: true });
});
