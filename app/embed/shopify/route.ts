// The Shopify app's page in a store's admin: Shopify frames it there (shopify/shopify.app.toml's
// application_url), with ?shop, host and an ID token. App Bridge gives the page a fresh ID token
// for each call, which shopify-public's /app checks and swaps for the store's tokens the first
// time the store opens the app (App Store rule 2.3.2: authenticate before anything else), then
// says whether a SaleLinx account holds the store. Connect sends the whole tab to the website to
// pick the account (shopify-public /connect, then /shopify/connect): a page framed in Shopify's
// admin can't count on salelinx.com's cookies, so it never signs in here.
//
// Sets its own headers: next.config.ts leaves /embed/* out of the site-wide DENY, and Shopify
// wants frame-ancestors naming the store and admin.shopify.com, never a wildcard.

import ar from '@/messages/ar.json';
import de from '@/messages/de.json';
import en from '@/messages/en.json';
import es from '@/messages/es.json';
import fr from '@/messages/fr.json';
import zh from '@/messages/zh.json';
import { CHROME_WEB_STORE_URL, SITE_URL } from '@/lib/site';

// App Bridge's API key, the app's public client id (shopify/shopify.app.toml).
const CLIENT_ID = '1358d2c72523a2584682e156a097d3d1';

// Shopify's own rule for a store's permanent address.
const SHOP_RE = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;

const STRINGS = {
  en: en.ShopifyApp,
  fr: fr.ShopifyApp,
  es: es.ShopifyApp,
  de: de.ShopifyApp,
  ar: ar.ShopifyApp,
  zh: zh.ShopifyApp,
};

type Locale = keyof typeof STRINGS;

/** Shopify sends the admin's language ("fr", "en-GB", "zh-CN"). */
function localeOf(param: string | null): Locale {
  const l = (param ?? '').slice(0, 2).toLowerCase();
  return l in STRINGS ? (l as Locale) : 'en';
}

// Inside a <script>: nothing in it may close the tag.
const inScript = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c');

const page = (locale: Locale, embedded: boolean) => `<!doctype html>
<html lang="${locale}" dir="${locale === 'ar' ? 'rtl' : 'ltr'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<meta name="shopify-api-key" content="${CLIENT_ID}">
${embedded ? '<script src="https://cdn.shopify.com/shopifycloud/app-bridge.js"></script>' : ''}
<link rel="icon" href="/icon.png">
<title>SaleLinx</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; background: #f1f1f1; color: #303030; font: 14px/1.5 -apple-system, BlinkMacSystemFont, 'San Francisco', 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif; }
  main { max-width: 560px; margin: 24px auto; padding: 0 16px; }
  .card { background: #fff; border-radius: 12px; box-shadow: 0 1px 0 rgba(26,26,26,.07), 0 0 0 1px rgba(26,26,26,.08); padding: 24px; }
  .brand { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; font-weight: 650; font-size: 15px; }
  .brand img { width: 28px; height: 28px; border-radius: 6px; }
  h1 { font-size: 20px; line-height: 1.3; font-weight: 650; margin: 0 0 8px; }
  p { margin: 0 0 12px; }
  .hint { color: #616161; font-size: 13px; }
  .actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 20px; }
  .actions:empty { display: none; }
  button, .link { display: inline-flex; align-items: center; height: 32px; padding: 0 12px; border-radius: 8px; font: inherit; font-weight: 550; text-decoration: none; cursor: pointer; }
  button { border: 0; background: #303030; color: #fff; }
  button:disabled { opacity: .6; cursor: default; }
  .link { border: 1px solid #d4d4d4; background: #fff; color: #303030; }
  [hidden] { display: none !important; }
</style>
</head>
<body>
<main>
  <div class="card">
    <div class="brand"><img src="/icon.png" alt="">SaleLinx</div>
    <h1 id="title"></h1>
    <p id="body"></p>
    <p id="hint" class="hint"></p>
    <div class="actions">
      <button id="primary" type="button" hidden></button>
      <a id="extension" class="link" href="${CHROME_WEB_STORE_URL}" target="_blank" rel="noopener" hidden></a>
      <a id="account" class="link" href="${SITE_URL}/account" target="_blank" rel="noopener" hidden></a>
    </div>
  </div>
</main>
<script>
(() => {
  const S = ${inScript(STRINGS[locale])};
  const API = ${inScript(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/shopify-public/app`)};
  const $ = (id) => document.getElementById(id);
  const fill = (text, values) => text.replace(/\\{(\\w+)\\}/g, (m, k) => (k in values ? values[k] : m));
  $('extension').textContent = S.getExtension;
  $('account').textContent = S.account;

  function show({ title, body = '', hint = '', primary = null, links = false }) {
    $('title').textContent = title;
    $('body').textContent = body;
    $('body').hidden = !body;
    $('hint').textContent = hint;
    $('hint').hidden = !hint;
    const button = $('primary');
    button.hidden = !primary;
    button.disabled = false;
    if (primary) {
      button.textContent = primary.label;
      button.onclick = primary.run;
    }
    $('extension').hidden = !links;
    $('account').hidden = !links;
  }

  if (!window.shopify) {
    show({ title: S.outsideTitle, body: S.outsideBody });
    return;
  }

  // A fresh ID token each call: one lives a minute. invalid_session means it went stale on the
  // way, so one more try with a new one.
  async function session(retry) {
    const token = await shopify.idToken();
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ action: 'session' }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && data.code === 'invalid_session' && retry) return session(false);
    if (!res.ok) throw new Error(data.code || String(res.status));
    return data;
  }

  async function load() {
    show({ title: S.loading });
    let s;
    try {
      s = await session(true);
    } catch {
      show({ title: S.error, primary: { label: S.retry, run: load } });
      return;
    }
    const store = s.shopName || s.shopDomain;
    if (s.linked) {
      show({
        title: S.connectedTitle,
        body: s.account ? fill(S.connectedBody, { store, account: s.account }) : '',
        hint: S.connectedHint,
        links: true,
      });
      return;
    }
    show({
      title: fill(S.connectTitle, { store }),
      body: S.connectBody,
      hint: S.connectHint,
      primary: {
        label: S.connect,
        run: () => {
          $('primary').disabled = true;
          open(s.connectUrl, '_top');
        },
      },
    });
  }

  load();
})();
</script>
</body>
</html>`;

export function GET(request: Request): Response {
  const params = new URL(request.url).searchParams;
  const shop = params.get('shop') ?? '';
  const embedded = SHOP_RE.test(shop);
  const ancestors = embedded ? `https://${shop} https://admin.shopify.com` : "'none'";
  return new Response(page(localeOf(params.get('locale')), embedded), {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Security-Policy': [
        `frame-ancestors ${ancestors}`,
        "script-src 'unsafe-inline' https://cdn.shopify.com",
        "object-src 'none'",
        "base-uri 'none'",
      ].join('; '),
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    },
  });
}
