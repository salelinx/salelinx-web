// deno-lint-ignore-file
// POST with x-trial-nudge-secret: daily Cron run. Any request carrying u & t:
// unsubscribe link (GET from the email, POST from one-click List-Unsubscribe).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { timingSafeEqual } from "../_shared/security.ts";
import {
  button,
  EMAIL_ASSETS,
  emailLayout,
  heading,
  paragraph,
} from "../_shared/email-theme.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);
const SECRET = Deno.env.get("TRIAL_NUDGE_SECRET") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const RESEND_FROM = Deno.env.get("RESEND_FROM") ?? "";
const SITE_URL = Deno.env.get("SITE_URL") || "https://www.salelinx.com";
const PRICING_URL = `${SITE_URL}/features#pricing`;
const FUNCTION_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1/trial-nudge`;

type Step = { subject: string; preheader: string; title: string; body: string[] };

const STEPS: Step[] = [
  {
    subject: "Your 14-day SaleLinx trial is waiting",
    preheader: "Run Depop and Vinted from one panel, free for 14 days.",
    title: "Your free trial is waiting",
    body: [
      "You made a SaleLinx account but haven't started your free trial yet.",
      "Crosslist between Depop and Vinted, bulk edit, refresh listings and print shipping labels, all from one panel.",
      "It's free for 14 days. Cancel before it ends and you won't be charged.",
    ],
  },
  {
    subject: "Crosslist your shop in minutes",
    preheader: "Copy your Depop listings to Vinted, or the other way round.",
    title: "List once, sell on both",
    body: [
      "Most sellers start by crosslisting: pick listings on Depop or Vinted and SaleLinx copies them to the other, photos, category, size and all.",
      "Your 14-day trial is still there if you want to try it.",
    ],
  },
];

async function unsubToken(userId: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(userId));
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function unsubscribe(userId: string, token: string): Promise<Response> {
  if (!(await timingSafeEqual(token, await unsubToken(userId)))) {
    return new Response("Invalid link", { status: 400 });
  }
  const { error } = await supabase
    .from("trial_nudges")
    .upsert({ user_id: userId, unsubscribed_at: new Date().toISOString() });
  if (error) return new Response("Something went wrong, try again", { status: 500 });
  return new Response("You're unsubscribed from SaleLinx trial reminders.");
}

async function send(userId: string, email: string, step: Step): Promise<void> {
  const unsubUrl = `${FUNCTION_URL}?u=${userId}&t=${await unsubToken(userId)}`;
  const html = emailLayout({
    preheader: step.preheader,
    eyebrow: "Free trial",
    bodyHtml:
      heading(step.title) +
      step.body.map((p) => paragraph(p)).join("") +
      button(PRICING_URL, "Start free trial"),
    footerNote: `You're getting this because you signed up for SaleLinx. <a href="${unsubUrl}" style="color:inherit;">Unsubscribe</a>`,
    siteUrl: SITE_URL,
  });
  const text = `${step.body.join("\n\n")}\n\nStart free trial: ${PRICING_URL}\n\nUnsubscribe: ${unsubUrl}`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: [email],
      subject: step.subject,
      html,
      text,
      headers: {
        "List-Unsubscribe": `<${unsubUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
      attachments: EMAIL_ASSETS,
    }),
  });
  if (!res.ok) throw new Error(`resend ${res.status}: ${await res.text()}`);
}

Deno.serve(async (req) => {
  if (!SECRET || !RESEND_API_KEY || !RESEND_FROM) {
    return new Response("Not configured", { status: 500 });
  }

  const params = new URL(req.url).searchParams;
  const u = params.get("u");
  const t = params.get("t");
  if (u && t) return unsubscribe(u, t);

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  const presented = req.headers.get("x-trial-nudge-secret") ?? "";
  if (!(await timingSafeEqual(presented, SECRET))) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { data: rows, error } = await supabase.rpc("trial_nudge_due");
  if (error) {
    console.error(`[trial-nudge] scan failed: ${error.message}`);
    return Response.json({ error: error.message }, { status: 500 });
  }

  const result = { sent: 0, errors: 0 };
  for (const row of (rows ?? []) as { user_id: string; email: string; step: number }[]) {
    try {
      await send(row.user_id, row.email, STEPS[row.step]);
      const { error: upErr } = await supabase.from("trial_nudges").upsert({
        user_id: row.user_id,
        step: row.step + 1,
        last_sent_at: new Date().toISOString(),
      });
      if (upErr) throw new Error(upErr.message);
      result.sent += 1;
    } catch (err) {
      result.errors += 1;
      console.error(`[trial-nudge] user ${row.user_id} failed:`, (err as Error).message);
    }
  }

  console.log(`[trial-nudge] sent=${result.sent} errors=${result.errors}`);
  return Response.json(result);
});
