// Supabase Edge Function: ebay-account-deletion
// ------------------------------------------------------------------------
// eBay's Marketplace Account Deletion endpoint, required before a production
// keyset can make calls. GET answers eBay's endpoint challenge; POST is a
// signed notice that an eBay user closed their account, and we delete every
// trace of that eBay account: tokens, the link, and its synced listings.
//
// Secrets: EBAY_DELETION_VERIFICATION_TOKEN (32-80 chars, also entered in the
// eBay developer portal), EBAY_DELETION_ENDPOINT (this function's public URL,
// exactly as registered), EBAY_CLIENT_ID, EBAY_CLIENT_SECRET, EBAY_ENV.

// @ts-nocheck - this file runs under Deno, not the website's TS config.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { createHash, createPublicKey, createVerify, type KeyObject } from 'node:crypto';
import { Buffer } from 'node:buffer';

const SANDBOX = Deno.env.get('EBAY_ENV') === 'sandbox';
const API_HOST = SANDBOX ? 'https://api.sandbox.ebay.com' : 'https://api.ebay.com';

const keyCache = new Map<string, { key: KeyObject; at: number }>();

async function appToken(): Promise<string> {
  const basic = btoa(`${Deno.env.get('EBAY_CLIENT_ID')}:${Deno.env.get('EBAY_CLIENT_SECRET')}`);
  const res = await fetch(`${API_HOST}/identity/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      scope: 'https://api.ebay.com/oauth/api_scope',
    }),
  });
  if (!res.ok) throw new Error(`app token ${res.status}`);
  return (await res.json()).access_token;
}

/** eBay returns the PEM with its armour and body run together, which the PEM parser refuses, so load the DER bytes. */
export function ebayPublicKey(key: string): KeyObject {
  const body = key.replace(/-----(BEGIN|END) PUBLIC KEY-----/g, '').replace(/\s+/g, '');
  return createPublicKey({ key: Buffer.from(body, 'base64'), format: 'der', type: 'spki' });
}

async function publicKey(kid: string): Promise<KeyObject> {
  const hit = keyCache.get(kid);
  if (hit && Date.now() - hit.at < 3_600_000) return hit.key;
  const res = await fetch(`${API_HOST}/commerce/notification/v1/public_key/${encodeURIComponent(kid)}`, {
    headers: { Authorization: `Bearer ${await appToken()}` },
  });
  if (!res.ok) throw new Error(`public key ${res.status}`);
  const key = ebayPublicKey((await res.json()).key);
  keyCache.set(kid, { key, at: Date.now() });
  return key;
}

async function verified(signatureHeader: string | null, raw: string): Promise<boolean> {
  if (!signatureHeader) return false;
  try {
    const sig = JSON.parse(atob(signatureHeader));
    const verifier = createVerify('sha1');
    // eBay signs the compact serialisation, as its own SDKs verify it.
    verifier.update(JSON.stringify(JSON.parse(raw)));
    return verifier.verify(await publicKey(sig.kid), sig.signature, 'base64');
  } catch (err) {
    console.error('[ebay-account-deletion] verify failed:', err instanceof Error ? err.message : err);
    return false;
  }
}

export async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);

  if (req.method === 'GET') {
    const challenge = url.searchParams.get('challenge_code');
    const token = Deno.env.get('EBAY_DELETION_VERIFICATION_TOKEN');
    const endpoint = Deno.env.get('EBAY_DELETION_ENDPOINT');
    if (!challenge || !token || !endpoint) return new Response('Bad request', { status: 400 });
    const challengeResponse = createHash('sha256').update(challenge + token + endpoint).digest('hex');
    return new Response(JSON.stringify({ challengeResponse }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const raw = await req.text();
  if (!(await verified(req.headers.get('x-ebay-signature'), raw))) {
    return new Response('Invalid signature', { status: 412 });
  }

  const ebayUserId = JSON.parse(raw)?.notification?.data?.userId;
  if (typeof ebayUserId !== 'string' || !ebayUserId) return new Response(null, { status: 204 });

  const admin = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
  const results = await Promise.all([
    admin.from('ebay_tokens').delete().eq('ebay_user_id', ebayUserId),
    admin.from('linked_accounts').delete().eq('platform', 'ebay').eq('platform_user_id', ebayUserId),
    admin.from('listings').delete().eq('platform', 'ebay').eq('platform_user_id', ebayUserId),
  ]);
  const failed = results.find((r) => r.error);
  if (failed) {
    // Non-2xx makes eBay retry, which is what we want until the delete lands.
    console.error('[ebay-account-deletion] delete failed:', failed.error.message);
    return new Response('Retry', { status: 500 });
  }
  return new Response(null, { status: 204 });
}

if (import.meta.main) Deno.serve(handler);
