import type { Locale } from '@/lib/i18n/locales';
import type { ArticleModule } from './types';

// ── English ──────────────────────────────────────────────────────────────────

// Getting started
import * as installExtEn from '@/content/docs/en/getting-started/install-the-extension.mdx';
import * as connectMarketplaceEn from '@/content/docs/en/getting-started/connect-your-first-marketplace.mdx';
import * as accountSubEn from '@/content/docs/en/getting-started/account-and-subscription.mdx';

// Inventory & posting (sidebar group 1)
import * as listingsEn from '@/content/docs/en/inventory/listings.mdx';
import * as botsEn from '@/content/docs/en/inventory/bots.mdx';
import * as relistEn from '@/content/docs/en/inventory/relist.mdx';
import * as refreshEn from '@/content/docs/en/inventory/refresh.mdx';
import * as crosslistEn from '@/content/docs/en/inventory/crosslist.mdx';
import * as shopDesignerEn from '@/content/docs/en/inventory/shop-designer.mdx';
import * as csvImportEn from '@/content/docs/en/inventory/csv-import.mdx';
import * as cloudSyncEn from '@/content/docs/en/inventory/cloud-sync.mdx';

// Automate (sidebar group 2)
import * as deadStockEn from '@/content/docs/en/automate/dead-stock.mdx';
import * as autoOffersEn from '@/content/docs/en/automate/auto-offers.mdx';
import * as linkingEn from '@/content/docs/en/automate/linking.mdx';
import * as restockerEn from '@/content/docs/en/automate/restocker.mdx';
import * as priceDropsEn from '@/content/docs/en/automate/price-drops.mdx';

// Buyer messages (sidebar group 3)
import * as offersEn from '@/content/docs/en/buyers/offers.mdx';
import * as messagesEn from '@/content/docs/en/buyers/messages.mdx';
import * as labelsEn from '@/content/docs/en/buyers/labels.mdx';

// ── French ───────────────────────────────────────────────────────────────────

import * as installExtFr from '@/content/docs/fr/getting-started/install-the-extension.mdx';
import * as connectMarketplaceFr from '@/content/docs/fr/getting-started/connect-your-first-marketplace.mdx';
import * as accountSubFr from '@/content/docs/fr/getting-started/account-and-subscription.mdx';

import * as listingsFr from '@/content/docs/fr/inventory/listings.mdx';
import * as botsFr from '@/content/docs/fr/inventory/bots.mdx';
import * as relistFr from '@/content/docs/fr/inventory/relist.mdx';
import * as refreshFr from '@/content/docs/fr/inventory/refresh.mdx';
import * as crosslistFr from '@/content/docs/fr/inventory/crosslist.mdx';
import * as shopDesignerFr from '@/content/docs/fr/inventory/shop-designer.mdx';
import * as csvImportFr from '@/content/docs/fr/inventory/csv-import.mdx';
import * as cloudSyncFr from '@/content/docs/fr/inventory/cloud-sync.mdx';

import * as deadStockFr from '@/content/docs/fr/automate/dead-stock.mdx';
import * as autoOffersFr from '@/content/docs/fr/automate/auto-offers.mdx';
import * as linkingFr from '@/content/docs/fr/automate/linking.mdx';
import * as restockerFr from '@/content/docs/fr/automate/restocker.mdx';
import * as priceDropsFr from '@/content/docs/fr/automate/price-drops.mdx';

import * as offersFr from '@/content/docs/fr/buyers/offers.mdx';
import * as messagesFr from '@/content/docs/fr/buyers/messages.mdx';
import * as labelsFr from '@/content/docs/fr/buyers/labels.mdx';

// ── Spanish ──────────────────────────────────────────────────────────────────

import * as installExtEs from '@/content/docs/es/getting-started/install-the-extension.mdx';
import * as connectMarketplaceEs from '@/content/docs/es/getting-started/connect-your-first-marketplace.mdx';
import * as accountSubEs from '@/content/docs/es/getting-started/account-and-subscription.mdx';

import * as listingsEs from '@/content/docs/es/inventory/listings.mdx';
import * as botsEs from '@/content/docs/es/inventory/bots.mdx';
import * as relistEs from '@/content/docs/es/inventory/relist.mdx';
import * as refreshEs from '@/content/docs/es/inventory/refresh.mdx';
import * as crosslistEs from '@/content/docs/es/inventory/crosslist.mdx';
import * as shopDesignerEs from '@/content/docs/es/inventory/shop-designer.mdx';
import * as csvImportEs from '@/content/docs/es/inventory/csv-import.mdx';
import * as cloudSyncEs from '@/content/docs/es/inventory/cloud-sync.mdx';

import * as deadStockEs from '@/content/docs/es/automate/dead-stock.mdx';
import * as autoOffersEs from '@/content/docs/es/automate/auto-offers.mdx';
import * as linkingEs from '@/content/docs/es/automate/linking.mdx';
import * as restockerEs from '@/content/docs/es/automate/restocker.mdx';
import * as priceDropsEs from '@/content/docs/es/automate/price-drops.mdx';

import * as offersEs from '@/content/docs/es/buyers/offers.mdx';
import * as messagesEs from '@/content/docs/es/buyers/messages.mdx';
import * as labelsEs from '@/content/docs/es/buyers/labels.mdx';

// ── German ───────────────────────────────────────────────────────────────────

import * as installExtDe from '@/content/docs/de/getting-started/install-the-extension.mdx';
import * as connectMarketplaceDe from '@/content/docs/de/getting-started/connect-your-first-marketplace.mdx';
import * as accountSubDe from '@/content/docs/de/getting-started/account-and-subscription.mdx';

import * as listingsDe from '@/content/docs/de/inventory/listings.mdx';
import * as botsDe from '@/content/docs/de/inventory/bots.mdx';
import * as relistDe from '@/content/docs/de/inventory/relist.mdx';
import * as refreshDe from '@/content/docs/de/inventory/refresh.mdx';
import * as crosslistDe from '@/content/docs/de/inventory/crosslist.mdx';
import * as shopDesignerDe from '@/content/docs/de/inventory/shop-designer.mdx';
import * as csvImportDe from '@/content/docs/de/inventory/csv-import.mdx';
import * as cloudSyncDe from '@/content/docs/de/inventory/cloud-sync.mdx';

import * as deadStockDe from '@/content/docs/de/automate/dead-stock.mdx';
import * as autoOffersDe from '@/content/docs/de/automate/auto-offers.mdx';
import * as linkingDe from '@/content/docs/de/automate/linking.mdx';
import * as restockerDe from '@/content/docs/de/automate/restocker.mdx';
import * as priceDropsDe from '@/content/docs/de/automate/price-drops.mdx';

import * as offersDe from '@/content/docs/de/buyers/offers.mdx';
import * as messagesDe from '@/content/docs/de/buyers/messages.mdx';
import * as labelsDe from '@/content/docs/de/buyers/labels.mdx';

const ARTICLE_MODULES_EN: ArticleModule[] = [
  installExtEn as unknown as ArticleModule,
  connectMarketplaceEn as unknown as ArticleModule,
  accountSubEn as unknown as ArticleModule,
  listingsEn as unknown as ArticleModule,
  botsEn as unknown as ArticleModule,
  relistEn as unknown as ArticleModule,
  refreshEn as unknown as ArticleModule,
  crosslistEn as unknown as ArticleModule,
  shopDesignerEn as unknown as ArticleModule,
  csvImportEn as unknown as ArticleModule,
  cloudSyncEn as unknown as ArticleModule,
  deadStockEn as unknown as ArticleModule,
  autoOffersEn as unknown as ArticleModule,
  linkingEn as unknown as ArticleModule,
  restockerEn as unknown as ArticleModule,
  priceDropsEn as unknown as ArticleModule,
  offersEn as unknown as ArticleModule,
  messagesEn as unknown as ArticleModule,
  labelsEn as unknown as ArticleModule,
];

export const ARTICLE_MODULES_BY_LOCALE: Record<Locale, ArticleModule[]> = {
  en: ARTICLE_MODULES_EN,
  fr: [
    installExtFr as unknown as ArticleModule,
    connectMarketplaceFr as unknown as ArticleModule,
    accountSubFr as unknown as ArticleModule,
    listingsFr as unknown as ArticleModule,
    botsFr as unknown as ArticleModule,
    relistFr as unknown as ArticleModule,
    refreshFr as unknown as ArticleModule,
    crosslistFr as unknown as ArticleModule,
    shopDesignerFr as unknown as ArticleModule,
    csvImportFr as unknown as ArticleModule,
    cloudSyncFr as unknown as ArticleModule,
    deadStockFr as unknown as ArticleModule,
    autoOffersFr as unknown as ArticleModule,
    linkingFr as unknown as ArticleModule,
    restockerFr as unknown as ArticleModule,
    priceDropsFr as unknown as ArticleModule,
    offersFr as unknown as ArticleModule,
    messagesFr as unknown as ArticleModule,
    labelsFr as unknown as ArticleModule,
  ],
  es: [
    installExtEs as unknown as ArticleModule,
    connectMarketplaceEs as unknown as ArticleModule,
    accountSubEs as unknown as ArticleModule,
    listingsEs as unknown as ArticleModule,
    botsEs as unknown as ArticleModule,
    relistEs as unknown as ArticleModule,
    refreshEs as unknown as ArticleModule,
    crosslistEs as unknown as ArticleModule,
    shopDesignerEs as unknown as ArticleModule,
    csvImportEs as unknown as ArticleModule,
    cloudSyncEs as unknown as ArticleModule,
    deadStockEs as unknown as ArticleModule,
    autoOffersEs as unknown as ArticleModule,
    linkingEs as unknown as ArticleModule,
    restockerEs as unknown as ArticleModule,
    priceDropsEs as unknown as ArticleModule,
    offersEs as unknown as ArticleModule,
    messagesEs as unknown as ArticleModule,
    labelsEs as unknown as ArticleModule,
  ],
  de: [
    installExtDe as unknown as ArticleModule,
    connectMarketplaceDe as unknown as ArticleModule,
    accountSubDe as unknown as ArticleModule,
    listingsDe as unknown as ArticleModule,
    botsDe as unknown as ArticleModule,
    relistDe as unknown as ArticleModule,
    refreshDe as unknown as ArticleModule,
    crosslistDe as unknown as ArticleModule,
    shopDesignerDe as unknown as ArticleModule,
    csvImportDe as unknown as ArticleModule,
    cloudSyncDe as unknown as ArticleModule,
    deadStockDe as unknown as ArticleModule,
    autoOffersDe as unknown as ArticleModule,
    linkingDe as unknown as ArticleModule,
    restockerDe as unknown as ArticleModule,
    priceDropsDe as unknown as ArticleModule,
    offersDe as unknown as ArticleModule,
    messagesDe as unknown as ArticleModule,
    labelsDe as unknown as ArticleModule,
  ],
  // Arabic and Chinese ship with the UI and FAQ translated but the long-form
  // docs still in English, so they read the English articles for now. Swap
  // these to `content/docs/ar` and `content/docs/zh` imports once those
  // articles are written, and add the locale to TRANSLATED_DOCS_LOCALES below
  // so the docs pages start claiming hreflang and their own canonical again.
  ar: ARTICLE_MODULES_EN,
  zh: ARTICLE_MODULES_EN,
};

// Locales with actually translated article files above. ar and zh are missing
// on purpose: their /docs URLs serve the English fallback modules, so letting
// them claim hreflang="ar"/"zh" (or their own canonical) would present the
// same English text to search engines as three competing pages. Docs page
// metadata and the sitemap both build their alternates from this list.
export const TRANSLATED_DOCS_LOCALES: readonly Locale[] = ['en', 'fr', 'es', 'de'];
