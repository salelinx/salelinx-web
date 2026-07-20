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
//     to: string;          // recipient email
//     pdfBase64: string;   // base64-encoded merged PDF
//     filename: string;    // "labels-14-Apr-2026-3.pdf"
//     count: number;       // label count, used in subject/body copy
//     subject?: string;    // optional override
//     body?: string;       // optional override
//   }

// @ts-nocheck — this file runs under Deno, not the extension's TS config.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendRequest {
  to: string;
  pdfBase64: string;
  filename: string;
  count: number;
  subject?: string;
  body?: string;
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
  if (!body.filename) return json(400, { ok: false, error: 'Missing filename' });

  // Rough size cap — Resend allows 40MB of attachments; we cap at 25MB to stay safe.
  const approxBytes = (body.pdfBase64.length * 3) / 4;
  if (approxBytes > 25 * 1024 * 1024) {
    return json(413, { ok: false, error: 'Attachment too large (>25MB)' });
  }

  // ── Send via Resend ──────────────────────────────────────────────────────
  const resendKey = Deno.env.get('RESEND_API_KEY');
  const resendFrom = Deno.env.get('RESEND_FROM');
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

  const subject = body.subject ?? `Shipping labels — ${body.count} ${labelWord} (${dateStr})`;

  const text =
    body.body ??
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
      'Reply to this email if anything looks off.',
      '',
      'Thanks.',
    ].join('\n');

  // HTML version — most modern mail clients render this; plain-text fallback
  // above covers the rest.
  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#18181b;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.04);">
            <tr>
              <td style="padding:28px 32px 8px;">
                <p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#27272a;">Hi,</p>
                <p style="margin:0 0 20px;font-size:15px;line-height:1.55;color:#27272a;">
                  Your shipping ${labelWord} ${body.count === 1 ? 'is' : 'are'} attached and ready to print.
                </p>
                <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 24px;font-size:14px;color:#3f3f46;">
                  <tr>
                    <td style="padding:6px 20px 6px 0;color:#71717a;">Count</td>
                    <td style="padding:6px 0;font-weight:600;color:#18181b;">${body.count} ${labelWord}</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 20px 6px 0;color:#71717a;">File</td>
                    <td style="padding:6px 0;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#18181b;">${body.filename}</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 20px 6px 0;color:#71717a;">Date</td>
                    <td style="padding:6px 0;color:#18181b;">${dateStr}</td>
                  </tr>
                </table>
                <p style="margin:0 0 16px;font-size:13px;line-height:1.55;color:#52525b;">
                  For best results, print at 4 × 6 inches on thermal labels, or use scale-to-fit on A4. QR-only carriers (e.g. DPD, Vinted Go) are rendered as full-page packing slips alongside the recipient details.
                </p>
                <p style="margin:0 0 24px;font-size:13px;line-height:1.55;color:#52525b;">
                  Reply to this email if anything looks off.
                </p>
                <p style="margin:0;font-size:15px;color:#27272a;">Thanks.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 24px;border-top:1px solid #f4f4f5;font-size:11px;color:#a1a1aa;">
                Generated automatically by your shipping workflow.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: resendFrom,
      to: body.to,
      subject,
      text,
      html,
      attachments: [{ filename: body.filename, content: body.pdfBase64 }],
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    return json(502, { ok: false, error: `Resend ${resp.status}: ${errText.slice(0, 200)}` });
  }

  const result = (await resp.json().catch(() => ({}))) as { id?: string };
  return json(200, { ok: true, messageId: result.id });
}
