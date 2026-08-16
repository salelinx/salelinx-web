// Supabase Edge Function: send-shipping-labels
// ------------------------------------------------------------------------
// Accepts a merged shipping-label PDF (base64) + recipient email from the
// Resale Bot extension, attaches it to an email, and sends via Resend.
//
// Auth: requires a valid Supabase access_token (the extension passes the
// signed-in user's JWT in the Authorization header). Unauthenticated
// requests are rejected.
//
// Required secrets:
//   RESEND_API_KEY   — from https://resend.com/api-keys
//   RESEND_FROM      — verified sender address, e.g. "Resale Bot <labels@yourdomain.com>"
//                      (Resend requires domain verification before production use)
//
// Deploy:
//   supabase secrets set RESEND_API_KEY=re_... RESEND_FROM='Resale Bot <labels@example.com>'
//   supabase functions deploy send-shipping-labels --no-verify-jwt
//
// The --no-verify-jwt flag is required: the edge runtime's built-in JWT
// middleware doesn't support ES256 tokens on every project tier, so we
// validate the JWT ourselves via auth.getUser() below.
//
// Request body:
//   {
//     to: string;          // recipient email (user-chosen, e.g. a print shop)
//     pdfBase64: string;   // base64-encoded merged PDF
//     filename: string;    // "labels-14-Apr-2026-3.pdf"
//     count: number;       // label count, used in subject/body copy
//   }
//
// Abuse controls (this function sends from our verified domain to an address
// the caller chooses, so it must not be usable as a relay):
//   - the caller's tier must have the shipping_label_email feature enabled
//   - subject and body are fixed server-side; callers cannot override them
//   - the attachment must actually be a PDF (magic-byte check)
//   - filename and count are strictly validated
//   - sends are capped per user per day via usage_counters

// @ts-nocheck — this file runs under Deno, not the extension's TS config.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  EMAIL_ASSETS,
  emailLayout,
  escapeHtml,
  heading,
  metaRow,
  metaTable,
  MONO_STACK,
  paragraph,
  theme,
} from '../_shared/email-theme.ts';
import { corsHeaders as sharedCorsHeaders } from '../_shared/security.ts';

const CORS_HEADERS = sharedCorsHeaders();

interface SendRequest {
  to: string;
  pdfBase64: string;
  filename: string;
  count: number;
}

// Daily per-user cap on label emails. Recipient is caller-chosen (users
// legitimately email labels to a print shop or a VA), so the cap is the main
// brake on using a paid account as an attacker-addressed email pump. 15/day
// still covers a heavy real batching day (one email per merged batch) while
// shrinking the blast radius per account. Trial farming, the way to get many
// capped accounts cheaply, is closed separately (migration 017).
const DAILY_SEND_CAP = 15;

// "labels-14-Apr-2026-3.pdf" style names only: short, safe charset, .pdf.
const FILENAME_RE = /^[\w][\w .()-]{0,79}\.pdf$/i;

function isPdfBase64(b64: string): boolean {
  // First 8 base64 chars decode to the first 6 bytes; a real PDF starts
  // with "%PDF-". Reject anything else so we never mail arbitrary files.
  try {
    return atob(b64.slice(0, 8)).startsWith('%PDF');
  } catch {
    return false;
  }
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

Deno.serve(async (req: Request) => {
  try {
    return await handleRequest(req);
  } catch (err) {
    // Always return JSON so the client can surface the reason instead of an
    // NGINX 502 HTML page.
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    const stack = err instanceof Error ? err.stack?.split('\n').slice(0, 5).join(' | ') : '';
    console.error('send-shipping-labels uncaught:', msg, stack);
    return json(500, { ok: false, error: `Function crashed: ${msg}` });
  }
});

async function handleRequest(req: Request): Promise<Response> {
  console.log(`[send-shipping-labels] ${req.method} invoked`);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });

  // ── Verify the caller's Supabase session ─────────────────────────────────
  // NOTE: This function must be deployed with `--no-verify-jwt` so the edge
  // runtime's own JWT middleware is skipped — that middleware doesn't yet
  // support ES256 tokens on all projects. We validate the token ourselves
  // by calling /auth/v1/user explicitly below, which supports any algorithm.
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return json(401, { ok: false, error: 'Missing auth' });
  }
  const jwt = authHeader.slice('Bearer '.length).trim();
  if (!jwt) return json(401, { ok: false, error: 'Empty token' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !supabaseAnonKey) {
    return json(500, { ok: false, error: 'Supabase env missing' });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  // Pass the JWT explicitly so supabase-js does the HTTP round-trip to
  // /auth/v1/user — no local algorithm validation that could fail on ES256.
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser(jwt);
  if (userErr || !user) {
    console.log('[send-shipping-labels] auth rejected:', userErr?.message);
    return json(401, { ok: false, error: userErr?.message ?? 'Invalid session' });
  }
  console.log(`[send-shipping-labels] auth ok, user=${user.id}`);

  // ── Validate body ────────────────────────────────────────────────────────
  let body: SendRequest;
  try {
    body = (await req.json()) as SendRequest;
  } catch {
    return json(400, { ok: false, error: 'Invalid JSON' });
  }

  if (!body.to || !isEmail(body.to)) return json(400, { ok: false, error: 'Invalid recipient' });
  if (!body.pdfBase64) return json(400, { ok: false, error: 'Missing pdfBase64' });
  if (typeof body.filename !== 'string' || !FILENAME_RE.test(body.filename)) {
    return json(400, { ok: false, error: 'Invalid filename' });
  }
  if (!Number.isInteger(body.count) || body.count < 1 || body.count > 500) {
    return json(400, { ok: false, error: 'Invalid count' });
  }

  const pdfBase64 = String(body.pdfBase64).replace(/\s+/g, '');
  if (!isPdfBase64(pdfBase64)) {
    return json(400, { ok: false, error: 'Attachment is not a PDF' });
  }

  // Rough size cap — Resend allows 40MB of attachments; we cap at 25MB to stay safe.
  const approxBytes = (pdfBase64.length * 3) / 4;
  if (approxBytes > 25 * 1024 * 1024) {
    return json(413, { ok: false, error: 'Attachment too large (>25MB)' });
  }

  // ── Entitlement gate: shipping_label_email is a paid (Business) feature ──
  // The extension gates client-side too, but the server check is the real
  // boundary. Read via a user-scoped client so RLS "own read" applies.
  const userScoped = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });

  const { data: sub, error: subErr } = await userScoped
    .from('subscriptions')
    .select('tier_id, tier_version')
    .in('status', ['active', 'trialing'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (subErr) {
    console.error('[send-shipping-labels] subscription lookup failed:', subErr.message);
    return json(500, { ok: false, error: 'Entitlement check failed' });
  }

  let featureEnabled = false;
  if (sub) {
    const { data: tier, error: tierErr } = await userScoped
      .from('tier_limits')
      .select('features')
      .eq('tier_id', sub.tier_id)
      .eq('version', sub.tier_version)
      .maybeSingle();
    if (tierErr) {
      console.error('[send-shipping-labels] tier lookup failed:', tierErr.message);
      return json(500, { ok: false, error: 'Entitlement check failed' });
    }
    featureEnabled = tier?.features?.shipping_label_email === true;
  }
  if (!featureEnabled) {
    console.log(`[send-shipping-labels] blocked: feature not on tier, user=${user.id}`);
    return json(403, { ok: false, error: 'Your plan does not include emailed labels', code: 'upgrade_required' });
  }

  // ── Daily rate limit ─────────────────────────────────────────────────────
  // increment_usage_counter is SECURITY DEFINER and scoped to auth.uid(), so
  // calling it through the user-scoped client counts against this user only.
  const dayKey = new Date().toISOString().slice(0, 10);
  const { data: sendCount, error: rlErr } = await userScoped.rpc('increment_usage_counter', {
    p_feature: 'shipping_label_emails',
    p_period_key: dayKey,
  });
  if (rlErr) {
    console.error('[send-shipping-labels] rate-limit counter failed:', rlErr.message);
    return json(500, { ok: false, error: 'Rate-limit check failed' });
  }
  if (typeof sendCount === 'number' && sendCount > DAILY_SEND_CAP) {
    console.log(`[send-shipping-labels] blocked: daily cap reached, user=${user.id}`);
    return json(429, { ok: false, error: 'Daily label email limit reached, try again tomorrow', code: 'rate_limited' });
  }

  // ── Send via Resend ──────────────────────────────────────────────────────
  const resendKey = Deno.env.get('RESEND_API_KEY');
  const resendFrom = Deno.env.get('RESEND_FROM');
  // RESEND_FROM is no-reply@, so a bare "reply to this email" would dead-end.
  // Point replies at the support inbox instead. Secrets are project-wide, so
  // this is the same address send-support-email uses.
  const supportTo = Deno.env.get('SUPPORT_NOTIFY_TO');
  console.log(
    `[send-shipping-labels] secrets: RESEND_API_KEY=${resendKey ? 'set' : 'MISSING'}, RESEND_FROM=${resendFrom ? 'set' : 'MISSING'}`,
  );
  if (!resendKey || !resendFrom) {
    return json(503, { ok: false, error: 'Email service not configured', code: 'not_configured' });
  }
  // Never log body.to: recipient email addresses are personal data and
  // function logs are retained outside our control.
  console.log(`[send-shipping-labels] sending, count=${body.count}`);

  const labelWord = body.count === 1 ? 'label' : 'labels';
  const dateStr = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // Subject and body are fixed server-side. Do not add caller overrides:
  // this function sends from our verified domain and caller-controlled copy
  // would turn it into a phishing relay.
  const subject = `Shipping labels - ${body.count} ${labelWord} (${dateStr})`;

  const text =
    [
      'Hi,',
      '',
      `Your shipping ${labelWord} ${body.count === 1 ? 'is' : 'are'} attached and ready to print.`,
      '',
      `  Count:  ${body.count} ${labelWord}`,
      `  File:   ${body.filename}`,
      `  Date:   ${dateStr}`,
      '',
      'For best results, print at 4 × 6 inches on thermal labels, or use scale-to-fit on A4. QR-only carriers (e.g. DPD, Vinted Go) are rendered as full-page packing slips alongside the recipient details.',
      '',
      supportTo
        ? 'Reply to this email if anything looks off.'
        : 'If anything looks off, contact us at salelinx.com/account/support.',
      '',
      'Thanks.',
    ].join('\n');

  // HTML version — most modern mail clients render this; plain-text fallback
  // above covers the rest.
  const html = emailLayout({
    preheader: `${body.count} ${labelWord} attached, ready to print.`,
    eyebrow: 'Shipping labels',
    bodyHtml: `
      ${heading(`Your ${labelWord} ${body.count === 1 ? 'is' : 'are'} ready`)}
      ${paragraph(
        `${body.count === 1 ? 'It is' : 'They are'} attached to this email and ready to print.`,
        22,
      )}
      ${metaTable(
        [
          metaRow('Count', `${body.count} ${labelWord}`),
          metaRow(
            'File',
            `<span style="font-family:${MONO_STACK};">${escapeHtml(body.filename)}</span>`,
          ),
          metaRow('Date', escapeHtml(dateStr)),
        ].join(''),
      )}
      ${paragraph(
        'For best results, print at 4 x 6 inches on thermal labels, or use scale-to-fit on A4. QR-only carriers (e.g. DPD, Vinted Go) are rendered as full-page packing slips alongside the recipient details.',
        14,
      )}
      ${paragraph(
        supportTo
          ? 'Reply to this email if anything looks off.'
          : 'If anything looks off, contact us at <a href="https://salelinx.com/account/support" style="color:' + theme.ink + ';">salelinx.com/account/support</a>.',
        0,
      )}
    `,
    footerNote: 'Generated automatically by your shipping workflow.',
  });

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: resendFrom,
      to: body.to,
      ...(supportTo ? { reply_to: supportTo } : {}),
      subject,
      text,
      html,
      // The label PDF the user asked for, plus the inline masthead logo.
      attachments: [
        { filename: body.filename, content: pdfBase64 },
        ...EMAIL_ASSETS,
      ],
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    return json(502, { ok: false, error: `Resend ${resp.status}: ${errText.slice(0, 200)}` });
  }

  const result = (await resp.json().catch(() => ({}))) as { id?: string };
  return json(200, { ok: true, messageId: result.id });
}
