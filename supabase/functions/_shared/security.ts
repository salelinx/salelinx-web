// Shared security helpers for Edge Functions (Deno).

// Constant-time string comparison for shared secrets and signatures.
// A plain !== short-circuits on the first differing byte, which leaks
// position information over enough timed attempts. Both inputs are hashed
// first so length differences leak nothing either.
export async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b)),
  ]);
  const va = new Uint8Array(ha);
  const vb = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < va.length; i++) diff |= va[i] ^ vb[i];
  return diff === 0;
}

// CORS headers with opt-in origin pinning. Set the project secret
// ALLOWED_ORIGIN to the site origin (e.g. https://www.salelinx.com) to stop
// other websites' frontends from reading responses; unset keeps the current
// wildcard so nothing breaks before the secret exists. A single static origin
// is sufficient here: the extension's background fetches bypass CORS via
// host permissions, so the website is the only browser origin in play. All
// callers authenticate via Bearer tokens or shared secrets (never cookies),
// so this is defense in depth, not the auth boundary.
export function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type',
  };
}
