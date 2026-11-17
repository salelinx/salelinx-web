// The Shopify app's page in a store's admin: Shopify frames it there (shopify/shopify.app.toml's
// application_url), with ?shop, host and an ID token. App Bridge gives the page a fresh ID token
// for each call, which shopify-public's /app checks and swaps for the store's tokens the first
// time the store opens the app (App Store rule 2.3.2: authenticate before anything else), then
// says whether a SaleLinx account holds the store and, if so, that account's eBay connection.
// Connect sends the whole tab to the website to pick the account (shopify-public /connect, then
// /shopify/connect), and Connect eBay opens the website's eBay page in a new tab: a page framed in
// Shopify's admin can't count on salelinx.com's cookies, so it never signs in here. For a store an
// account holds, it lists the store's products, each variant with where it is on eBay, and lists
// one on eBay from a short form (the ebay-web function's shopifyItem and shopifyListing, which act
// for the store's account with the page's ID token). Its plan section shows the account's plan
// and opens Shopify's plan page to pick or manage one; the plan's welcome link comes back here
// with ?plan_handle, and the page asks for the plan afresh until Shopify shows it (shopify-public,
// _shared/shopify-billing.ts). Built with Shopify's Polaris web components, so it looks like the
// rest of the admin.
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
// App Bridge's API key is the app's public client id.
import { SHOPIFY_CLIENT_ID as CLIENT_ID, SHOP_RE } from '@/lib/shopify-app';

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
  <s-section id="plan" hidden>
    <s-badge id="planBadge" slot="supplemental"></s-badge>
    <s-stack gap="base">
      <s-paragraph id="planBody"></s-paragraph>
      <s-banner id="planDouble" tone="warning" hidden><span id="planDoubleText"></span></s-banner>
      <s-paragraph id="planChecking" hidden><s-text id="planCheckingText" color="subdued"></s-text></s-paragraph>
      <s-stack direction="inline" gap="base">
        <s-button id="planChoose" variant="primary" hidden></s-button>
        <s-button id="planManage" hidden></s-button>
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
  <s-section id="lister" hidden>
    <s-stack gap="base">
      <s-stack direction="inline" gap="base" alignItems="center">
        <s-thumbnail id="lThumb" size="small"></s-thumbnail>
        <s-stack gap="none">
          <s-text id="lName" type="strong"></s-text>
          <s-text id="lVariant" color="subdued"></s-text>
        </s-stack>
      </s-stack>
      <s-banner id="lProblem" tone="critical" hidden>
        <s-stack id="lProblemText" gap="small-200"></s-stack>
      </s-banner>
      <s-stack id="lLoading" direction="inline" gap="base" alignItems="center">
        <s-spinner></s-spinner>
        <s-text id="lLoadingText"></s-text>
      </s-stack>
      <s-stack id="lForm" gap="base" hidden>
        <s-text-field id="lTitle" maxLength="80"></s-text-field>
        <s-stack direction="inline" gap="base" alignItems="end">
          <s-text-field id="lCatSearch"></s-text-field>
          <s-button id="lCatFind"></s-button>
        </s-stack>
        <s-select id="lCategory"></s-select>
        <s-paragraph id="lCatNone" hidden><s-text id="lCatNoneText" color="subdued"></s-text></s-paragraph>
        <s-select id="lCondition"></s-select>
        <s-stack id="lSpecifics" gap="base"></s-stack>
        <s-stack direction="inline" gap="base">
          <s-number-field id="lPrice" min="0.01" step="0.01"></s-number-field>
          <s-number-field id="lQuantity" min="1" step="1" inputMode="numeric"></s-number-field>
        </s-stack>
        <s-paragraph id="lPriceNote" hidden><s-text id="lPriceNoteText" color="subdued"></s-text></s-paragraph>
        <s-paragraph><s-text id="lSetupText" color="subdued"></s-text></s-paragraph>
        <s-stack id="lPostage" gap="base" hidden>
          <s-select id="lService"></s-select>
          <s-stack direction="inline" gap="base">
            <s-number-field id="lCost" min="0" step="0.01"></s-number-field>
            <s-text-field id="lPostcode" maxLength="20"></s-text-field>
          </s-stack>
          <s-select id="lReturns">
            <s-option id="lReturnsNone" value=""></s-option>
            <s-option id="lReturns14" value="14"></s-option>
            <s-option id="lReturns30" value="30"></s-option>
          </s-select>
        </s-stack>
        <s-stack id="lFees" gap="small-200" hidden></s-stack>
      </s-stack>
      <s-stack direction="inline" gap="base">
        <s-button id="lBack"></s-button>
        <s-button id="lCheck" hidden></s-button>
        <s-button id="lPost" variant="primary" hidden disabled></s-button>
      </s-stack>
    </s-stack>
  </s-section>
</s-page>
<script>
(() => {
  const S = ${inScript(STRINGS[locale])};
  const LANGUAGE = ${inScript(languageTag)};
  const API = ${inScript(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/shopify-public/app`)};
  // eBay for the store's account: the ebay function's code under its own name, which the
  // extension doesn't call.
  const EBAY_API = ${inScript(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/ebay-web`)};
  // The website's eBay page in the admin's language, on whichever site serves this page.
  const EBAY_PAGE = location.origin + ${inScript(`${localePathPrefix(locale)}/ebay/connect`)};
  const ADMIN_URL = ${inScript(shop ? `https://${shop}/admin/apps/${CLIENT_ID}` : '')};
  // Shopify's plan page sends the merchant back with the plan's handle (its welcome link). Choose a
  // plan also leaves a mark for ten minutes, in case the way back carries no plan_handle.
  const PICKING_KEY = 'salelinxPlanPicking';
  const pickedLately = () => {
    try {
      const at = Number(sessionStorage.getItem(PICKING_KEY));
      return at > 0 && Date.now() - at < 10 * 60 * 1000;
    } catch {
      return false;
    }
  };
  const PLAN_PICKED = new URLSearchParams(location.search).has('plan_handle') || pickedLately();
  // Plan names are names, as on the website's account page.
  const TIER_NAMES = { starter: 'Starter', pro: 'Pro', business: 'Business' };
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
  $('plan').setAttribute('heading', S.planTitle);
  say('planChoose', S.planChoose);
  say('planManage', S.planManage);
  say('planDoubleText', S.planDouble);
  say('planCheckingText', S.planChecking);
  say('productsRetry', S.retry);
  say('colProduct', S.colProduct);
  say('colStatus', S.colStatus);
  say('colPrice', S.colPrice);
  say('colStock', S.colStock);
  say('colEbay', S.colEbay);
  $('products').setAttribute('heading', S.productsTitle);
  $('productSearch').setAttribute('label', S.productsSearch);
  $('productSearch').setAttribute('placeholder', S.productsSearch);
  $('lister').setAttribute('heading', S.listOnEbay);
  say('lLoadingText', S.lLoading);
  $('lTitle').setAttribute('label', S.lTitleLabel);
  $('lCatSearch').setAttribute('label', S.lCatSearch);
  say('lCatFind', S.lCatFind);
  $('lCategory').setAttribute('label', S.lCategory);
  say('lCatNoneText', S.lCategoryNone);
  $('lCondition').setAttribute('label', S.lCondition);
  $('lCondition').setAttribute('placeholder', S.lChoose);
  $('lPrice').setAttribute('label', S.lPrice);
  $('lQuantity').setAttribute('label', S.lQuantity);
  $('lService').setAttribute('label', S.lService);
  $('lService').setAttribute('placeholder', S.lChoose);
  $('lCost').setAttribute('label', S.lCost);
  $('lPostcode').setAttribute('label', S.lPostcode);
  $('lReturns').setAttribute('label', S.lReturns);
  say('lReturnsNone', S.lReturnsNone);
  say('lReturns14', S.lReturns14);
  say('lReturns30', S.lReturns30);
  say('lBack', S.lBack);
  say('lCheck', S.lCheck);
  say('lPost', S.lPost);

  // A fresh ID token each call: one lives a minute. invalid_session means it went stale on the
  // way, so one more try with a new one. A refusal carries its code and the server's words.
  async function call(payload, retry = true, url = API) {
    const token = await shopify.idToken();
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && data.code === 'invalid_session' && retry) return call(payload, false, url);
    if (!res.ok) {
      const err = new Error(data.code || String(res.status));
      err.code = data.code || '';
      err.detail = typeof data.error === 'string' ? data.error : '';
      throw err;
    }
    return data;
  }
  const ebayCall = (payload) => call(payload, true, EBAY_API);

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

  // ── Plan ──────────────────────────────────────────────────────────────────

  // Shopify's plan page can send the merchant back before the Partner API shows the plan, so the
  // page asks again a few times, 6 seconds apart (the server reads afresh at most every 5).
  let planPicked = PLAN_PICKED;
  let planTries = 0;
  let checkingPlan = false;

  const tierName = (id) => TIER_NAMES[id] || (id ? id.charAt(0).toUpperCase() + id.slice(1) : '');

  function day(iso) {
    const t = Date.parse(iso || '');
    if (Number.isNaN(t)) return '';
    try {
      return new Intl.DateTimeFormat(LANGUAGE, { dateStyle: 'medium' }).format(t);
    } catch {
      return new Date(t).toDateString();
    }
  }

  // What the plan says, and its badge: the plan's own words when Shopify bills it, where it is
  // paid otherwise.
  function planWords(p) {
    if (!p) return [S.planNone, 'warning', S.planBadgeNone];
    const date = day(p.periodEnd);
    const values = { plan: tierName(p.tierId), date };
    const trial = p.status === 'trialing';
    const badge = trial ? ['info', S.planBadgeTrial] : ['success', S.planBadgeActive];
    if (p.cancelAtPeriodEnd && date) return [fill(S.planEnding, values), 'warning', S.planBadgeEnding];
    if (p.paidThrough === 'stripe') return [fill(S.planStripe, values), ...badge];
    if (p.paidThrough === 'comp') return [fill(S.planComp, values), ...badge];
    if (!date) return [fill(S.planShopifyNoDate, values), ...badge];
    return [fill(trial ? S.planTrial : S.planShopify, values), ...badge];
  }

  function showPlan(s) {
    const b = s.linked ? s.billing : null;
    show('plan', !!b);
    if (!b) return;
    const p = b.plan;
    const [words, tone, badgeText] = planWords(p);
    const badge = $('planBadge');
    badge.setAttribute('tone', tone);
    badge.textContent = badgeText;
    say('planBody', words);
    show('planDouble', !!b.doubleBilled);
    show('planChecking', checkingPlan);
    show('planChoose', !p && !checkingPlan && !!b.planPageUrl);
    flag($('planChoose'), 'loading', false);
    show('planManage', !!b.planPageUrl && (b.doubleBilled || (!!p && p.paidThrough === 'shopify')));
  }

  // After the welcome link: until the plan shows, or the tries run out.
  function planRecheck(s) {
    checkingPlan = !!(s.linked && s.billing && !s.billing.plan) && planTries < 4;
    showPlan(s);
    if (!checkingPlan) {
      planPicked = false;
      try {
        sessionStorage.removeItem(PICKING_KEY);
      } catch {}
      return;
    }
    planTries++;
    setTimeout(load, 6000);
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

  function ebayCell(p, v) {
    if (!v.ebay) {
      if (!last || !last.ebay || !last.ebay.linked) return el('s-text', { color: 'subdued' }, S.ebayNotListed);
      const button = el('s-button', { variant: 'secondary' }, S.listOnEbay);
      button.addEventListener('click', () => openLister(p, v));
      return button;
    }
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
            el('s-table-cell', {}, ebayCell(p, v)),
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

  // ── Listing on eBay ───────────────────────────────────────────────────────

  // The variant on the form, as the ebay function read it from the store.
  let listing = null;
  let services = null;

  // eBay's refusals worth naming in the seller's words; anything else eBay said is passed on as
  // it is (eBay's own wording), and the rest is a plain failure.
  const REFUSALS = {
    upgrade_required: 'lUpgrade',
    limit_reached: 'lLimit',
    already_on_ebay: 'lAlready',
    postage_needed: 'lPostageNeeded',
    not_linked: 'lReconnect',
    reauth: 'lReconnect',
    photos: 'lPhotos',
  };
  function refusalText(err) {
    if (err && REFUSALS[err.code]) return S[REFUSALS[err.code]];
    if (err && (err.code === 'ebay' || err.code === 'quota' || err.code === 'bad_request') && err.detail) {
      return err.detail;
    }
    return S.lFailed;
  }

  function listerProblem(lines) {
    $('lProblemText').replaceChildren(...lines.map((line) => el('s-text', {}, line)));
    show('lProblem', lines.length > 0);
  }

  // A check is for what was on the form then: a change asks for another.
  function changed() {
    flag($('lPost'), 'disabled', true);
    show('lFees', false);
  }
  const watch = (node) => {
    node.addEventListener('input', changed);
    node.addEventListener('change', changed);
  };
  for (const id of ['lTitle', 'lCategory', 'lCondition', 'lPrice', 'lQuantity', 'lService', 'lCost', 'lPostcode', 'lReturns']) {
    watch($(id));
  }

  // What the store's own product says for a detail eBay asks about: brand, size, colour, type.
  function guessFor(aspect, item) {
    const name = aspect.name.toLowerCase();
    const option = (...names) => {
      const hit = item.options.find((o) => names.includes(o.name.toLowerCase()));
      return hit ? hit.value : null;
    };
    let guess = null;
    if (name === 'brand') guess = item.vendor;
    else if (name.startsWith('size')) guess = option('size', 'taille', 'talla', 'größe', 'grösse');
    else if (name === 'colour' || name === 'color' || name === 'main colour' || name === 'main color') {
      guess = option('color', 'colour', 'couleur', 'farbe', 'color principal');
    } else if (name === 'type' || name === 'product type') guess = item.productType;
    else if (name === 'material') guess = option('material', 'matière', 'material principal');
    if (!guess) return '';
    if (aspect.freeText) return guess;
    const hit = aspect.values.find((v) => v.toLowerCase() === String(guess).toLowerCase());
    return hit || '';
  }

  async function loadCategory(categoryId) {
    changed();
    $('lCondition').replaceChildren();
    $('lSpecifics').replaceChildren();
    if (!categoryId) return;
    let conditions, aspects;
    try {
      [conditions, aspects] = await Promise.all([
        ebayCall({ action: 'conditions', categoryId }),
        ebayCall({ action: 'aspects', categoryId }),
      ]);
    } catch (err) {
      listerProblem([refusalText(err)]);
      return;
    }
    const list = conditions.conditions || [];
    for (const c of list) $('lCondition').append(el('s-option', { value: String(c.id) }, c.name));
    $('lCondition').value = list.length === 1 ? String(list[0].id) : '';
    for (const a of (aspects.aspects || []).filter((x) => x.required)) {
      const guess = guessFor(a, listing.item);
      let field;
      if (!a.freeText && a.values.length > 0 && a.values.length <= 500) {
        field = el('s-select', { label: a.name, placeholder: S.lChoose });
        for (const v of a.values) field.append(el('s-option', { value: v }, v));
      } else {
        field = el('s-text-field', { label: a.name, maxLength: '65' });
      }
      field.dataset.aspect = a.name;
      watch(field);
      $('lSpecifics').append(field);
      field.value = guess;
    }
  }

  async function findCategories(words) {
    changed();
    show('lCatNone', false);
    const select = $('lCategory');
    select.replaceChildren();
    let found;
    try {
      found = (await ebayCall({ action: 'categories', q: words })).categories || [];
    } catch (err) {
      listerProblem([refusalText(err)]);
      return;
    }
    for (const c of found) select.append(el('s-option', { value: c.id }, c.path));
    show('lCatNone', found.length === 0);
    select.value = found.length ? found[0].id : '';
    await loadCategory(found.length ? found[0].id : '');
  }

  async function showPostage(setup) {
    show('lPostage', setup.kind === 'none');
    if (setup.kind === 'saved') say('lSetupText', fill(S.lSetupSaved, { postcode: setup.postcode || '' }));
    else if (setup.kind === 'template') say('lSetupText', fill(S.lSetupTemplate, { title: setup.templateTitle || '' }));
    else say('lSetupText', S.lSetupNone);
    if (setup.kind !== 'none' || services) return;
    try {
      services = (await ebayCall({ action: 'shippingServices' })).services || [];
    } catch (err) {
      listerProblem([refusalText(err)]);
      return;
    }
    for (const s of services) $('lService').append(el('s-option', { value: s.id }, s.name));
  }

  function closeLister() {
    listing = null;
    show('lister', false);
    show('products', true);
  }

  async function openLister(p, v) {
    show('products', false);
    show('lister', true);
    listerProblem([]);
    show('lForm', false);
    show('lLoading', true);
    show('lCheck', false);
    show('lPost', false);
    flag($('lPost'), 'disabled', true);
    show('lFees', false);
    show('lPriceNote', false);
    say('lName', p.title);
    say('lVariant', v.title || '');
    if (p.image) $('lThumb').setAttribute('src', p.image);
    else $('lThumb').removeAttribute('src');
    $('lThumb').setAttribute('alt', p.title);
    let r;
    try {
      r = await ebayCall({ action: 'shopifyItem', productId: p.productId, variantId: v.variantId });
    } catch (err) {
      show('lLoading', false);
      listerProblem([refusalText(err)]);
      return;
    }
    show('lLoading', false);
    if (r.listed) {
      listerProblem([S.lAlready]);
      return;
    }
    listing = { item: r.item, currency: r.currency, setup: r.setup };
    const item = r.item;
    $('lTitle').value = item.title.slice(0, 80);
    $('lCatSearch').value = '';
    $('lPrice').setAttribute('suffix', r.currency);
    $('lPrice').value = item.price != null ? String(item.price) : '';
    $('lQuantity').value = String(item.quantity && item.quantity > 0 ? item.quantity : 1);
    if (item.currency && item.currency !== r.currency && item.price != null) {
      say('lPriceNoteText', fill(S.lPriceNote, { price: money(item.price, item.currency), currency: r.currency }));
      show('lPriceNote', true);
    }
    show('lForm', true);
    show('lCheck', true);
    show('lPost', true);
    await showPostage(r.setup);
    // The product type alone when the store gives one: eBay's suggester weighs the whole query,
    // and "snowboard The Complete Snowboard" still came back as a DVD box set where "snowboard"
    // finds Snowboards. The title only for a product with no type.
    await findCategories(String(item.productType || item.title).slice(0, 100));
  }

  // The form as the ebay function takes it, or null with what is missing said.
  function formValues() {
    const specifics = {};
    let unfilled = false;
    for (const field of $('lSpecifics').children) {
      const value = String(field.value || '').trim();
      if (value) specifics[field.dataset.aspect] = value;
      else unfilled = true;
    }
    const values = {
      productId: listing.item.productId,
      variantId: listing.item.variantId,
      title: String($('lTitle').value || '').trim(),
      categoryId: String($('lCategory').value || ''),
      conditionId: String($('lCondition').value || ''),
      specifics,
      price: Number($('lPrice').value),
      quantity: Number($('lQuantity').value),
    };
    if (listing.setup.kind === 'none') {
      values.postage = {
        service: String($('lService').value || ''),
        cost: Number($('lCost').value),
        returnsDays: Number($('lReturns').value) || null,
      };
      values.postcode = String($('lPostcode').value || '').trim();
    }
    const conditions = $('lCondition').children.length > 0;
    const postageMissing =
      listing.setup.kind === 'none' &&
      (!values.postage.service || !(values.postage.cost >= 0) || $('lCost').value === '' || !values.postcode);
    if (unfilled || !values.title || !values.categoryId || (conditions && !values.conditionId) || !(values.price > 0) || postageMissing) {
      listerProblem([S.lMissing]);
      return null;
    }
    return values;
  }

  $('lCatFind').addEventListener('click', () => {
    const words = String($('lCatSearch').value || '').trim();
    if (words.length >= 2) findCategories(words);
  });
  $('lCategory').addEventListener('change', (event) => loadCategory(event.currentTarget.value));
  $('lBack').addEventListener('click', closeLister);

  $('lCheck').addEventListener('click', async () => {
    if (!listing) return;
    const values = formValues();
    if (!values) return;
    listerProblem([]);
    flag($('lCheck'), 'loading', true);
    let verdict;
    try {
      verdict = await ebayCall({ action: 'shopifyListing', verifyOnly: true, ...values });
    } catch (err) {
      flag($('lCheck'), 'loading', false);
      listerProblem([refusalText(err)]);
      return;
    }
    flag($('lCheck'), 'loading', false);
    if (!verdict.ok) {
      listerProblem([S.lRefused, ...verdict.errors]);
      return;
    }
    const fees = (verdict.fees || []).map((f) => el('s-text', {}, f.name + ': ' + money(f.amount, verdict.currency)));
    $('lFees').replaceChildren(
      el('s-text', { type: 'strong' }, fees.length ? S.lFees : S.lNoFees),
      ...fees,
    );
    show('lFees', true);
    flag($('lPost'), 'disabled', false);
  });

  $('lPost').addEventListener('click', async () => {
    if (!listing) return;
    const values = formValues();
    if (!values) return;
    listerProblem([]);
    flag($('lPost'), 'loading', true);
    try {
      await ebayCall({ action: 'shopifyListing', ...values });
    } catch (err) {
      flag($('lPost'), 'loading', false);
      flag($('lPost'), 'disabled', true);
      listerProblem([refusalText(err)]);
      return;
    }
    flag($('lPost'), 'loading', false);
    shopify.toast.show(S.lListed);
    closeLister();
    loadProducts();
  });

  // ── Loading ───────────────────────────────────────────────────────────────

  async function load() {
    show('problem', false);
    if (!last) show('loading', true);
    flag($('ebayCheck'), 'loading', true);
    let s;
    try {
      s = await call({ action: 'session', fresh: planPicked });
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
    if (planPicked) planRecheck(s);
    else showPlan(s);
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
  // Shopify's plan page, in the whole tab: it is part of the admin, not of this page.
  $('planChoose').addEventListener('click', () => {
    if (!last || !last.billing || !last.billing.planPageUrl) return;
    flag($('planChoose'), 'loading', true);
    try {
      sessionStorage.setItem(PICKING_KEY, String(Date.now()));
    } catch {}
    open(last.billing.planPageUrl, '_top');
  });
  $('planManage').addEventListener('click', () => {
    if (!last || !last.billing || !last.billing.planPageUrl) return;
    open(last.billing.planPageUrl, '_top');
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
