// Supabase Edge Function: shopify-public
// ------------------------------------------------------------------------
// The Shopify app's two public addresses, with no SaleLinx session:
//
//   GET  The App URL. Shopify sends a store here on install, signed (shop,
//        host, timestamp, hmac), and again whenever someone opens the app
//        from the Shopify admin. While a seller connects, the extension
//        catches this address in its popup and carries on itself
//        (shopify function, authorizeUrl). Anyone else is sent to the
//        website: Supabase serves a function's HTML as plain text on its
//        own domain, so there is no page here.
//   POST Webhooks, verified against X-Shopify-Hmac-Sha256. app/uninstalled is
//        subscribed per store when it links (shopify function); the
//        compliance topics are in shopify/shopify.app.toml.
//        app/uninstalled          deletes that store's tokens; the link stays,
//                                 so the extension asks the seller to reconnect
//        shop/redact              (48 hours after an uninstall) deletes the
//                                 store's tokens, link and listings
//        customers/data_request,  nothing to do: SaleLinx keeps no data about
//        customers/redact         a store's customers
//
// Secrets: SHOPIFY_CLIENT_SECRET, SITE_URL.

// @ts-nocheck - this file runs under Deno, not the website's TS config.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { verifyWebhook } from '../_shared/shopify.ts';

const SITE_URL = Deno.env.get('SITE_URL') ?? 'https://www.salelinx.com';

const text = (status: number, body: string) => new Response(body, { status });

Deno.serve(async (req: Request) => {
  if (req.method === 'GET') {
    return new Response(null, { status: 302, headers: { Location: SITE_URL } });
  }
  if (req.method !== 'POST') return text(405, 'Method not allowed');

  const secret = Deno.env.get('SHOPIFY_CLIENT_SECRET');
  if (!secret) return text(500, 'Not configured');

  // The raw body, before any parsing: the signature covers its exact bytes.
  const raw = await req.text();
  if (!(await verifyWebhook(raw, req.headers.get('X-Shopify-Hmac-Sha256'), secret))) {
    return text(401, 'Bad signature');
  }

  const topic = req.headers.get('X-Shopify-Topic');
  const shopDomain = req.headers.get('X-Shopify-Shop-Domain') ?? '';
  const admin = createClient(
    Deno.env.get('SUPABASE_URL'),
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
  );

  if (topic === 'app/uninstalled') {
    const { error } = await admin.from('shopify_tokens').delete().eq('shop_domain', shopDomain);
    if (error) {
      console.error(`[shopify-public] topic=${topic} delete failed`);
      return text(500, 'Retry');
    }
  } else if (topic === 'shop/redact') {
    let shopId = '';
    try {
      shopId = String(JSON.parse(raw).shop_id ?? '');
    } catch {
      return text(400, 'Bad body');
    }
    if (!shopId) return text(400, 'Bad body');
    const results = await Promise.all([
      admin.from('shopify_tokens').delete().eq('shop_id', shopId),
      admin
        .from('linked_accounts')
        .delete()
        .eq('platform', 'shopify')
        .eq('platform_user_id', shopId),
      admin.from('listings').delete().eq('platform', 'shopify').eq('platform_user_id', shopId),
    ]);
    if (results.some((r) => r.error)) {
      console.error(`[shopify-public] topic=${topic} delete failed`);
      return text(500, 'Retry');
    }
  }

  // Shopify retries anything but a 2xx, so every verified topic answers ok.
  return text(200, 'ok');
});
