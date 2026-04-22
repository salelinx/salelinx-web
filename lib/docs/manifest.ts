import type { Locale } from '@/lib/i18n/locales';
import type { ArticleModule } from './types';

import * as installExtEn from '@/content/docs/en/getting-started/install-the-extension.mdx';
import * as connectMarketplaceEn from '@/content/docs/en/getting-started/connect-your-first-marketplace.mdx';
import * as crosslistFirstEn from '@/content/docs/en/crosslisting/crosslist-your-first-item.mdx';
import * as manageInventoryEn from '@/content/docs/en/listings/manage-inventory.mdx';

import * as installExtFr from '@/content/docs/fr/getting-started/install-the-extension.mdx';
import * as connectMarketplaceFr from '@/content/docs/fr/getting-started/connect-your-first-marketplace.mdx';
import * as crosslistFirstFr from '@/content/docs/fr/crosslisting/crosslist-your-first-item.mdx';
import * as manageInventoryFr from '@/content/docs/fr/listings/manage-inventory.mdx';

import * as installExtEs from '@/content/docs/es/getting-started/install-the-extension.mdx';
import * as connectMarketplaceEs from '@/content/docs/es/getting-started/connect-your-first-marketplace.mdx';
import * as crosslistFirstEs from '@/content/docs/es/crosslisting/crosslist-your-first-item.mdx';
import * as manageInventoryEs from '@/content/docs/es/listings/manage-inventory.mdx';

import * as installExtDe from '@/content/docs/de/getting-started/install-the-extension.mdx';
import * as connectMarketplaceDe from '@/content/docs/de/getting-started/connect-your-first-marketplace.mdx';
import * as crosslistFirstDe from '@/content/docs/de/crosslisting/crosslist-your-first-item.mdx';
import * as manageInventoryDe from '@/content/docs/de/listings/manage-inventory.mdx';

export const ARTICLE_MODULES_BY_LOCALE: Record<Locale, ArticleModule[]> = {
  en: [
    installExtEn as unknown as ArticleModule,
    connectMarketplaceEn as unknown as ArticleModule,
    crosslistFirstEn as unknown as ArticleModule,
    manageInventoryEn as unknown as ArticleModule,
  ],
  fr: [
    installExtFr as unknown as ArticleModule,
    connectMarketplaceFr as unknown as ArticleModule,
    crosslistFirstFr as unknown as ArticleModule,
    manageInventoryFr as unknown as ArticleModule,
  ],
  es: [
    installExtEs as unknown as ArticleModule,
    connectMarketplaceEs as unknown as ArticleModule,
    crosslistFirstEs as unknown as ArticleModule,
    manageInventoryEs as unknown as ArticleModule,
  ],
  de: [
    installExtDe as unknown as ArticleModule,
    connectMarketplaceDe as unknown as ArticleModule,
    crosslistFirstDe as unknown as ArticleModule,
    manageInventoryDe as unknown as ArticleModule,
  ],
};
