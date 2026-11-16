// The Shopify app's page in a store's admin: Shopify frames it there (shopify/shopify.app.toml's
// application_url), with ?shop, host and an ID token. App Bridge gives the page a fresh ID token
// for each call, which shopify-public's /app checks and swaps for the store's tokens the first
// time the store opens the app (App Store rule 2.3.2: authenticate before anything else), then
// says whether a SaleLinx account holds the store and, if so, that account's eBay connection.
// Connect sends the whole tab to the website to pick the account (shopify-public /connect, then
// /shopify/connect), and Connect eBay opens the website's eBay page in a new tab: a page framed in
// Shopify's admin can't count on salelinx.com's cookies, so it never signs in here. Built with
// Shopify's Polaris web components, so it looks like the rest of the admin.
//
// Sets its own headers: next.config.ts leaves /embed/* out of the site-wide DENY, and Shopify
// wants frame-ancestors naming the store and admin.shopify.com, never a wildcard.

import ar from '@/messages/ar.json';
import de from '@/messages/de.json';
import en from '@/messages/en.json';
import es from '@/messages/es.json';
import fr from '@/messages/fr.json';
import zh from '@/messages/zh.json';
import { CHROME_WEB_STORE_URL, SITE_URL, localePathPrefix } from '@/lib/site';

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

const page = (locale: Locale, shop: string | null) => `<!doctype html>
<html lang="${locale}" dir="${locale === 'ar' ? 'rtl' : 'ltr'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<meta name="shopify-api-key" content="${CLIENT_ID}">
${
  shop
    ? '<script src="https://cdn.shopify.com/shopifycloud/app-bridge.js"></script>\n' +
      '<script src="https://cdn.shopify.com/shopifycloud/polaris-2.js"></script>'
    : ''
}
<link rel="icon" href="/icon.png">
<title>SaleLinx</title>
<style>
  [hidden] { display: none !important; }
  #outside { max-width: 560px; margin: 24px auto; padding: 0 16px; color: #303030; font: 14px/1.5 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
  #outside h1 { font-size: 20px; margin: 0 0 8px; }
</style>
</head>
<body>
<div id="outside" hidden>
  <h1 id="outsideTitle"></h1>
  <p id="outsideBody"></p>
</div>
<s-page id="page" heading="SaleLinx" hidden>
  <s-banner id="problem" tone="critical" hidden>
    <span id="problemText"></span>
    <s-button id="retry" slot="secondary-actions"></s-button>
  </s-banner>
  <s-section id="loading">
    <s-stack direction="inline" gap="base" alignItems="center">
      <s-spinner></s-spinner>
      <s-text id="loadingText"></s-text>
    </s-stack>
  </s-section>
  <s-section id="store" hidden>
    <s-stack gap="base">
      <s-paragraph id="storeBody"></s-paragraph>
      <s-paragraph><s-text id="storeHint" color="subdued"></s-text></s-paragraph>
      <s-stack direction="inline" gap="base">
        <s-button id="connect" variant="primary" hidden></s-button>
        <s-button id="account" href="${SITE_URL}/account" target="_blank" hidden></s-button>
        <s-button id="extension" href="${CHROME_WEB_STORE_URL}" target="_blank" hidden></s-button>
      </s-stack>
    </s-stack>
  </s-section>
  <s-section id="ebay" heading="eBay" hidden>
    <s-badge id="ebayBadge" slot="supplemental"></s-badge>
    <s-stack gap="base">
      <s-paragraph id="ebayBody"></s-paragraph>
      <s-paragraph id="ebayWaiting" hidden><s-text id="ebayWaitingText" color="subdued"></s-text></s-paragraph>
      <s-stack direction="inline" gap="base">
        <s-button id="ebayConnect" variant="primary" hidden></s-button>
        <s-button id="ebayCheck" hidden></s-button>
      </s-stack>
    </s-stack>
  </s-section>
</s-page>
<script>
(() => {
  const S = ${inScript(STRINGS[locale])};
  const API = ${inScript(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/shopify-public/app`)};
  // The website's eBay page in the admin's language, on whichever site serves this page.
  const EBAY_PAGE = location.origin + ${inScript(`${localePathPrefix(locale)}/ebay/connect`)};
  const ADMIN_URL = ${inScript(shop ? `https://${shop}/admin/apps/${CLIENT_ID}` : '')};
  const $ = (id) => document.getElementById(id);
  const fill = (text, values) => text.replace(/\\{(\\w+)\\}/g, (m, k) => (k in values ? values[k] : m));
  const show = (id, on) => { $(id).hidden = !on; };
  const say = (id, text) => { $(id).textContent = text; };

  if (!window.shopify) {
    say('outsideTitle', S.outsideTitle);
    say('outsideBody', S.outsideBody);
    show('outside', true);
    return;
  }
  show('page', true);
  say('loadingText', S.loading);
  say('retry', S.retry);
  say('account', S.account);
  say('extension', S.getExtension);
  say('ebayCheck', S.ebayCheck);
  say('ebayWaitingText', S.ebayWaiting);

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

  let last = null;
  // Set while the eBay tab is open, so coming back to this one checks again.
  let waitingForEbay = false;

  function showStore(s) {
    const store = s.shopName || s.shopDomain;
    show('store', true);
    if (s.linked) {
      $('store').setAttribute('heading', S.connectedTitle);
      say('storeBody', s.account ? fill(S.connectedBody, { store, account: s.account }) : '');
      say('storeHint', S.connectedHint);
    } else {
      $('store').setAttribute('heading', fill(S.connectTitle, { store }));
      say('storeBody', S.connectBody);
      say('storeHint', S.connectHint);
      say('connect', S.connect);
      $('connect').loading = false;
    }
    show('connect', !s.linked);
    show('account', s.linked);
    show('extension', s.linked);
  }

  function showEbay(s) {
    const e = s.linked ? s.ebay : null;
    show('ebay', !!e);
    if (!e) return;
    if (e.linked) waitingForEbay = false;
    const badge = $('ebayBadge');
    if (e.linked) {
      badge.setAttribute('tone', 'success');
      badge.textContent = S.ebayConnectedBadge;
      say('ebayBody', e.username ? fill(S.ebayConnected, { username: e.username }) : S.ebayConnectedNoName);
    } else if (e.reconnect) {
      badge.setAttribute('tone', 'warning');
      badge.textContent = S.ebayReconnectBadge;
      say('ebayBody', S.ebayReconnectBody);
    } else {
      badge.setAttribute('tone', 'neutral');
      badge.textContent = S.ebayNotConnectedBadge;
      say('ebayBody', S.ebayIntro);
    }
    say('ebayConnect', e.reconnect ? S.ebayReconnect : S.ebayConnect);
    show('ebayConnect', !e.linked);
    show('ebayWaiting', waitingForEbay);
    show('ebayCheck', waitingForEbay);
    $('ebayCheck').loading = false;
  }

  async function load() {
    show('problem', false);
    if (!last) show('loading', true);
    $('ebayCheck').loading = true;
    let s;
    try {
      s = await session(true);
    } catch {
      show('loading', false);
      $('ebayCheck').loading = false;
      say('problemText', S.error);
      show('problem', true);
      return;
    }
    last = s;
    show('loading', false);
    showStore(s);
    showEbay(s);
  }

  $('retry').addEventListener('click', load);
  $('ebayCheck').addEventListener('click', load);
  $('connect').addEventListener('click', () => {
    if (!last || !last.connectUrl) return;
    $('connect').loading = true;
    open(last.connectUrl, '_top');
  });
  $('ebayConnect').addEventListener('click', () => {
    const url = new URL(EBAY_PAGE);
    url.searchParams.set('return', ADMIN_URL);
    if (last && last.account) url.searchParams.set('account', last.account);
    open(url.toString(), '_blank');
    waitingForEbay = true;
    if (last) showEbay(last);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && waitingForEbay) load();
  });

  load();
})();
</script>
</body>
</html>`;

export function GET(request: Request): Response {
  const params = new URL(request.url).searchParams;
  const param = params.get('shop') ?? '';
  const shop = SHOP_RE.test(param) ? param : null;
  const ancestors = shop ? `https://${shop} https://admin.shopify.com` : "'none'";
  return new Response(page(localeOf(params.get('locale')), shop), {
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
