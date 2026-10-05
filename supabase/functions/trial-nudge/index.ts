// deno-lint-ignore-file
// POST with x-trial-nudge-secret: daily Cron run. Any request carrying u & t:
// unsubscribe link (GET from the email, POST from one-click List-Unsubscribe).

import Stripe from "https://esm.sh/stripe@17.0.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { timingSafeEqual } from "../_shared/security.ts";
import {
  button,
  codeBlock,
  EMAIL_ASSETS,
  emailLayout,
  heading,
  paragraph,
} from "../_shared/email-theme.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2025-02-24.acacia",
  httpClient: Stripe.createFetchHttpClient(),
});
const WINBACK_COUPON = "winback-50-first-month";
const CODE_DAYS = 30;

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

type Step = {
  subject: string;
  preheader: string;
  title: string;
  body: string[];
  eyebrow?: string;
  cta?: string;
};

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

const WINBACK_PAID: Step = {
  subject: "We miss you at SaleLinx",
  preheader: "Your listings, settings and cloud data are still here.",
  title: "We miss you",
  eyebrow: "Welcome back",
  cta: "See plans",
  body: [
    "Your SaleLinx plan has ended, but your listings, settings and cloud data are all still here.",
    "Pick a plan and you're straight back to crosslisting, bulk editing and relisting across Depop and Vinted.",
  ],
};

const WINBACK_TRIAL: Step = {
  ...WINBACK_PAID,
  subject: "Pick up where your SaleLinx trial left off",
  preheader: "Your listings and settings are still saved.",
  body: [
    "Your free trial has ended, but your listings and settings are still saved.",
    "Pick a plan to get crosslisting, bulk editing and relisting back across Depop and Vinted.",
  ],
};

// One code per person, redeemable once and only by their Stripe customer, so a
// code posted publicly is worthless to anyone else.
async function winbackCode(customer: string): Promise<string> {
  try {
    await stripe.coupons.retrieve(WINBACK_COUPON);
  } catch {
    await stripe.coupons.create({
      id: WINBACK_COUPON,
      percent_off: 50,
      duration: "once",
      name: "Welcome back: 50% off your first month",
    });
  }
  const suffix = Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) =>
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[b % 32]).join("");
  const promo = await stripe.promotionCodes.create({
    coupon: WINBACK_COUPON,
    code: `BACK50-${suffix}`,
    customer,
    max_redemptions: 1,
    expires_at: Math.floor(Date.now() / 1000) + CODE_DAYS * 24 * 60 * 60,
  });
  return promo.code;
}

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
  const now = new Date().toISOString();
  // Also recorded in the user's own metadata, where the website reads the
  // answer: without it /account would go on showing these emails as on.
  // updateUserById merges user_metadata, so other keys are untouched.
  const { error: metaErr } = await supabase.auth.admin.updateUserById(userId, {
    user_metadata: { marketing_opt_out: true, marketing_choice_at: now },
  });
  const { error } = await supabase
    .from("trial_nudges")
    .upsert({ user_id: userId, unsubscribed_at: now });
  if (metaErr || error) return new Response("Something went wrong, try again", { status: 500 });
  return new Response("You're unsubscribed from SaleLinx reminder emails.");
}

async function send(userId: string, email: string, step: Step, code?: string): Promise<void> {
  const unsubUrl = `${FUNCTION_URL}?u=${userId}&t=${await unsubToken(userId)}`;
  const html = emailLayout({
    preheader: step.preheader,
    eyebrow: step.eyebrow ?? "Free trial",
    bodyHtml:
      heading(step.title) +
      step.body.map((p) => paragraph(p)).join("") +
      (code
        ? paragraph("Here's 50% off your first month back, on any plan. Enter this code at checkout:", 12) +
          codeBlock(code) +
          paragraph(`One use, just for you. Expires in ${CODE_DAYS} days.`, 24)
        : "") +
      button(PRICING_URL, step.cta ?? "Start free trial"),
    footerNote: `You're getting this because you signed up for SaleLinx. <a href="${unsubUrl}" style="color:inherit;">Unsubscribe</a>`,
    siteUrl: SITE_URL,
  });
  const offer = code
    ? `\n\n50% off your first month back, on any plan. Code: ${code} (one use, expires in ${CODE_DAYS} days)`
    : "";
  const text = `${step.body.join("\n\n")}${offer}\n\n${step.cta ?? "Start free trial"}: ${PRICING_URL}\n\nUnsubscribe: ${unsubUrl}`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: [email],
      subject: code ? "50% off your first month back at SaleLinx" : step.subject,
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

  const [trial, winback] = await Promise.all([
    supabase.rpc("trial_nudge_due"),
    supabase.rpc("winback_due"),
  ]);
  const scanErr = trial.error ?? winback.error;
  if (scanErr) {
    console.error(`[trial-nudge] scan failed: ${scanErr.message}`);
    return Response.json({ error: scanErr.message }, { status: 500 });
  }

  const now = () => new Date().toISOString();
  const jobs = [
    ...((trial.data ?? []) as { user_id: string; email: string; step: number }[]).map((r) => ({
      ...r,
      step: STEPS[r.step],
      record: { step: r.step + 1, last_sent_at: now() },
    })),
    ...((winback.data ?? []) as {
      user_id: string;
      email: string;
      paid: boolean;
      stripe_customer_id: string | null;
    }[]).map((r) => ({
      ...r,
      step: r.paid ? WINBACK_PAID : WINBACK_TRIAL,
      customer: r.stripe_customer_id,
      record: { winback_sent_at: now() },
    })),
  ];

  const result = { sent: 0, errors: 0 };
  for (const job of jobs) {
    try {
      const code = "customer" in job && job.customer ? await winbackCode(job.customer) : undefined;
      await send(job.user_id, job.email, job.step, code);
      const { error: upErr } = await supabase
        .from("trial_nudges")
        .upsert({ user_id: job.user_id, ...job.record });
      if (upErr) throw new Error(upErr.message);
      result.sent += 1;
    } catch (err) {
      result.errors += 1;
      console.error(`[trial-nudge] user ${job.user_id} failed:`, (err as Error).message);
    }
  }

  console.log(`[trial-nudge] sent=${result.sent} errors=${result.errors}`);
  return Response.json(result);
});
