// The Shopify app's page in a store's admin: Shopify frames it there (shopify/shopify.app.toml's
// application_url), with ?shop, host and an ID token. App Bridge gives the page a fresh ID token
// for each call, which shopify-public's /app checks and swaps for the store's tokens the first
// time the store opens the app (App Store rule 2.3.2: authenticate before anything else), then
// says whether a SaleLinx account holds the store and, if so, that account's eBay connection.
// Connect sends the whole tab to the website to pick the account (shopify-public /connect, then
// /shopify/connect), and Connect eBay opens the website's eBay page in a new tab: a page framed in
// Shopify's admin can't count on salelinx.com's cookies, so it never signs in here. For a store an
// account holds, it lists the store's products, each variant with where it is on eBay. Built with
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

// A language tag as Shopify sends it ("en-GB"), for formatting prices.
const LANGUAGE_TAG_RE = /^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8}){0,2}$/;

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

const page = (locale: Locale, languageTag: string, shop: string | null) => `<!doctype html>
<html lang="${locale}" dir="${locale === 'ar' ? 'rtl' : 'ltr'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<meta name="shopify-api-key" content="${CLIENT_ID}">
${shop ? '<script src="https://cdn.shopify.com/shopifycloud/app-bridge.js"></script>\n<script src="https://cdn.shopify.com/shopifycloud/polaris-2.js"></script>' : ''}
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
  <s-section id="products" padding="none" hidden>
    <s-stack id="productsNotes" padding="base" gap="base" hidden>
      <s-banner id="productsProblem" tone="critical" hidden>
        <span id="productsProblemText"></span>
        <s-button id="productsRetry" slot="secondary-actions"></s-button>
      </s-banner>
      <s-paragraph id="productsEmpty" hidden><s-text id="productsEmptyText" color="subdued"></s-text></s-paragraph>
    </s-stack>
    <s-table id="productsTable" paginate>
      <s-search-field id="productSearch" slot="filters" labelAccessibilityVisibility="exclusive"></s-search-field>
      <s-table-header-row>
        <s-table-header id="colProduct" listSlot="primary"></s-table-header>
        <s-table-header id="colStatus" listSlot="inline"></s-table-header>
        <s-table-header id="colPrice" listSlot="labeled" format="currency"></s-table-header>
        <s-table-header id="colStock" listSlot="labeled" format="numeric"></s-table-header>
        <s-table-header id="colEbay" listSlot="labeled"></s-table-header>
      </s-table-header-row>
      <s-table-body id="productRows"></s-table-body>
    </s-table>
  </s-section>
</s-page>
<script>
(() => {
  const S = ${inScript(STRINGS[locale])};
  const LANGUAGE = ${inScript(languageTag)};
  const API = ${inScript(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/shopify-public/app`)};
  // The website's eBay page in the admin's language, on whichever site serves this page.
  const EBAY_PAGE = location.origin + ${inScript(`${localePathPrefix(locale)}/ebay/connect`)};
  const ADMIN_URL = ${inScript(shop ? `https://${shop}/admin/apps/${CLIENT_ID}` : '')};
  const $ = (id) => document.getElementById(id);
  const fill = (text, values) => text.replace(/\\{(\\w+)\\}/g, (m, k) => (k in values ? values[k] : m));
  const show = (id, on) => { $(id).hidden = !on; };
  const say = (id, text) => { $(id).textContent = text; };
  // On/off settings go in as attributes, which hold whether or not Polaris has loaded the
  // component yet (a property set before then is lost).
  const flag = (node, name, on) => { if (on) node.setAttribute(name, ''); else node.removeAttribute(name); };
  // An element with attributes and children; text goes in as text, never as markup.
  const el = (tag, attrs, ...children) => {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) if (v != null && v !== false) node.setAttribute(k, v === true ? '' : v);
    for (const c of children) if (c != null && c !== '') node.append(c);
    return node;
  };

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
  say('productsRetry', S.retry);
  say('colProduct', S.colProduct);
  say('colStatus', S.colStatus);
  say('colPrice', S.colPrice);
  say('colStock', S.colStock);
  say('colEbay', S.colEbay);
  $('products').setAttribute('heading', S.productsTitle);
  $('productSearch').setAttribute('label', S.productsSearch);
  $('productSearch').setAttribute('placeholder', S.productsSearch);

  // A fresh ID token each call: one lives a minute. invalid_session means it went stale on the
  // way, so one more try with a new one.
  async function call(payload, retry = true) {
    const token = await shopify.idToken();
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && data.code === 'invalid_session' && retry) return call(payload, false);
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
      flag($('connect'), 'loading', false);
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
    flag($('ebayCheck'), 'loading', false);
  }

  // ── Products ──────────────────────────────────────────────────────────────

  // The cursor each page shown so far started from: the last is the page on screen.
  let cursors = [null];
  let nextCursor = null;
  let search = '';
  let productsSeq = 0;
  let productsLoaded = false;

  function money(amount, currency) {
    if (amount == null) return '';
    try {
      return new Intl.NumberFormat(LANGUAGE, { style: 'currency', currency }).format(amount);
    } catch {
      return amount.toFixed(2);
    }
  }

  const STATUS = {
    ACTIVE: ['success', 'statusActive'],
    DRAFT: ['info', 'statusDraft'],
    ARCHIVED: ['neutral', 'statusArchived'],
  };
  const EBAY = {
    active: ['success', 'ebayListed'],
    sold: ['info', 'ebaySold'],
    draft: ['neutral', 'ebayDraft'],
    ended: ['neutral', 'ebayEnded'],
  };

  function productCell(p, v, first) {
    const lines = el('s-stack', { gap: 'none' }, el('s-text', { type: 'strong' }, p.title));
    if (v.title) lines.append(el('s-text', { color: 'subdued' }, v.title));
    if (first && p.moreVariants > 0) {
      lines.append(el('s-text', { color: 'subdued' }, fill(S.moreVariants, { count: p.moreVariants })));
    }
    return el(
      's-stack',
      { direction: 'inline', gap: 'small-200', alignItems: 'center' },
      el('s-thumbnail', { src: p.image, alt: p.title, size: 'small-200' }),
      lines,
    );
  }

  function ebayCell(v) {
    if (!v.ebay) return el('s-text', { color: 'subdued' }, S.ebayNotListed);
    const [tone, key] = EBAY[v.ebay.state] || EBAY.ended;
    const cell = el('s-stack', { direction: 'inline', gap: 'small-200', alignItems: 'center' }, el('s-badge', { tone }, S[key]));
    if (v.ebay.url) cell.append(el('s-link', { href: v.ebay.url, target: '_blank' }, S.ebayView));
    return cell;
  }

  function showProducts(data) {
    const rows = [];
    for (const p of data.products || []) {
      const [tone, key] = STATUS[p.status] || ['neutral', null];
      p.variants.forEach((v, i) => {
        rows.push(
          el(
            's-table-row',
            {},
            el('s-table-cell', {}, productCell(p, v, i === 0)),
            el('s-table-cell', {}, el('s-badge', { tone }, key ? S[key] : p.status)),
            el('s-table-cell', {}, money(v.price, data.currency)),
            el('s-table-cell', {}, v.quantity == null ? S.stockUntracked : String(v.quantity)),
            el('s-table-cell', {}, ebayCell(v)),
          ),
        );
      });
    }
    $('productRows').replaceChildren(...rows);
    nextCursor = data.cursor || null;
    const table = $('productsTable');
    flag(table, 'hasNextPage', !!nextCursor);
    flag(table, 'hasPreviousPage', cursors.length > 1);
    say('productsEmptyText', search ? S.productsNoMatch : S.productsEmpty);
    show('productsEmpty', rows.length === 0);
    show('productsNotes', rows.length === 0);
  }

  async function loadProducts() {
    const seq = ++productsSeq;
    const table = $('productsTable');
    flag(table, 'loading', true);
    show('productsProblem', false);
    let data;
    try {
      data = await call({ action: 'products', cursor: cursors[cursors.length - 1], query: search });
    } catch {
      if (seq !== productsSeq) return;
      flag(table, 'loading', false);
      say('productsProblemText', S.productsError);
      show('productsProblem', true);
      show('productsEmpty', false);
      show('productsNotes', true);
      return;
    }
    if (seq !== productsSeq) return;
    flag(table, 'loading', false);
    productsLoaded = true;
    showProducts(data);
  }

  $('productsTable').addEventListener('nextpage', () => {
    if (!nextCursor) return;
    cursors.push(nextCursor);
    loadProducts();
  });
  $('productsTable').addEventListener('previouspage', () => {
    if (cursors.length < 2) return;
    cursors.pop();
    loadProducts();
  });
  let typing = null;
  $('productSearch').addEventListener('input', (event) => {
    clearTimeout(typing);
    typing = setTimeout(() => {
      search = String(event.target.value || '').trim();
      cursors = [null];
      loadProducts();
    }, 400);
  });
  $('productsRetry').addEventListener('click', loadProducts);

  // ── Loading ───────────────────────────────────────────────────────────────

  async function load() {
    show('problem', false);
    if (!last) show('loading', true);
    flag($('ebayCheck'), 'loading', true);
    let s;
    try {
      s = await call({ action: 'session' });
    } catch {
      show('loading', false);
      flag($('ebayCheck'), 'loading', false);
      say('problemText', S.error);
      show('problem', true);
      return;
    }
    last = s;
    show('loading', false);
    showStore(s);
    showEbay(s);
    show('products', !!s.linked);
    if (s.linked && !productsLoaded) loadProducts();
  }

  $('retry').addEventListener('click', load);
  $('ebayCheck').addEventListener('click', load);
  $('connect').addEventListener('click', () => {
    if (!last || !last.connectUrl) return;
    flag($('connect'), 'loading', true);
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
  const tag = params.get('locale') ?? '';
  const languageTag = LANGUAGE_TAG_RE.test(tag) ? tag : 'en';
  const ancestors = shop ? `https://${shop} https://admin.shopify.com` : "'none'";
  return new Response(page(localeOf(tag), languageTag, shop), {
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
