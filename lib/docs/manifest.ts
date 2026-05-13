import type { Locale } from '@/lib/i18n/locales';
import type { ArticleModule } from './types';

// English
import * as installExtEn from '@/content/docs/en/getting-started/install-the-extension.mdx';
import * as connectMarketplaceEn from '@/content/docs/en/getting-started/connect-your-first-marketplace.mdx';
import * as accountSubEn from '@/content/docs/en/getting-started/account-and-subscription.mdx';
import * as crosslistFirstEn from '@/content/docs/en/crosslisting/crosslist-your-first-item.mdx';
import * as shopDesignerEn from '@/content/docs/en/crosslisting/shop-designer.mdx';
import * as csvImportEn from '@/content/docs/en/crosslisting/csv-import.mdx';
import * as manageInventoryEn from '@/content/docs/en/listings/manage-inventory.mdx';
import * as autoPriceDropsEn from '@/content/docs/en/visibility/auto-price-drops.mdx';
import * as shippingLabelsEn from '@/content/docs/en/sales/shipping-labels.mdx';
import * as autoOffersEn from '@/content/docs/en/sales/auto-offers.mdx';
import * as restockerEn from '@/content/docs/en/sales/restocker.mdx';
import * as relisterEn from '@/content/docs/en/sales/relister.mdx';

// French
import * as installExtFr from '@/content/docs/fr/getting-started/install-the-extension.mdx';
import * as connectMarketplaceFr from '@/content/docs/fr/getting-started/connect-your-first-marketplace.mdx';
import * as accountSubFr from '@/content/docs/fr/getting-started/account-and-subscription.mdx';
import * as crosslistFirstFr from '@/content/docs/fr/crosslisting/crosslist-your-first-item.mdx';
import * as shopDesignerFr from '@/content/docs/fr/crosslisting/shop-designer.mdx';
import * as csvImportFr from '@/content/docs/fr/crosslisting/csv-import.mdx';
import * as manageInventoryFr from '@/content/docs/fr/listings/manage-inventory.mdx';
import * as autoPriceDropsFr from '@/content/docs/fr/visibility/auto-price-drops.mdx';
import * as shippingLabelsFr from '@/content/docs/fr/sales/shipping-labels.mdx';
import * as autoOffersFr from '@/content/docs/fr/sales/auto-offers.mdx';
import * as restockerFr from '@/content/docs/fr/sales/restocker.mdx';
import * as relisterFr from '@/content/docs/fr/sales/relister.mdx';

// Spanish
import * as installExtEs from '@/content/docs/es/getting-started/install-the-extension.mdx';
import * as connectMarketplaceEs from '@/content/docs/es/getting-started/connect-your-first-marketplace.mdx';
import * as accountSubEs from '@/content/docs/es/getting-started/account-and-subscription.mdx';
import * as crosslistFirstEs from '@/content/docs/es/crosslisting/crosslist-your-first-item.mdx';
import * as shopDesignerEs from '@/content/docs/es/crosslisting/shop-designer.mdx';
import * as csvImportEs from '@/content/docs/es/crosslisting/csv-import.mdx';
import * as manageInventoryEs from '@/content/docs/es/listings/manage-inventory.mdx';
import * as autoPriceDropsEs from '@/content/docs/es/visibility/auto-price-drops.mdx';
import * as shippingLabelsEs from '@/content/docs/es/sales/shipping-labels.mdx';
import * as autoOffersEs from '@/content/docs/es/sales/auto-offers.mdx';
import * as restockerEs from '@/content/docs/es/sales/restocker.mdx';
import * as relisterEs from '@/content/docs/es/sales/relister.mdx';

// German
import * as installExtDe from '@/content/docs/de/getting-started/install-the-extension.mdx';
import * as connectMarketplaceDe from '@/content/docs/de/getting-started/connect-your-first-marketplace.mdx';
import * as accountSubDe from '@/content/docs/de/getting-started/account-and-subscription.mdx';
import * as crosslistFirstDe from '@/content/docs/de/crosslisting/crosslist-your-first-item.mdx';
import * as shopDesignerDe from '@/content/docs/de/crosslisting/shop-designer.mdx';
import * as csvImportDe from '@/content/docs/de/crosslisting/csv-import.mdx';
import * as manageInventoryDe from '@/content/docs/de/listings/manage-inventory.mdx';
import * as autoPriceDropsDe from '@/content/docs/de/visibility/auto-price-drops.mdx';
import * as shippingLabelsDe from '@/content/docs/de/sales/shipping-labels.mdx';
import * as autoOffersDe from '@/content/docs/de/sales/auto-offers.mdx';
import * as restockerDe from '@/content/docs/de/sales/restocker.mdx';
import * as relisterDe from '@/content/docs/de/sales/relister.mdx';

export const ARTICLE_MODULES_BY_LOCALE: Record<Locale, ArticleModule[]> = {
  en: [
    installExtEn as unknown as ArticleModule,
    connectMarketplaceEn as unknown as ArticleModule,
    accountSubEn as unknown as ArticleModule,
    crosslistFirstEn as unknown as ArticleModule,
    shopDesignerEn as unknown as ArticleModule,
    csvImportEn as unknown as ArticleModule,
    manageInventoryEn as unknown as ArticleModule,
    autoPriceDropsEn as unknown as ArticleModule,
    shippingLabelsEn as unknown as ArticleModule,
    autoOffersEn as unknown as ArticleModule,
    restockerEn as unknown as ArticleModule,
    relisterEn as unknown as ArticleModule,
  ],
  fr: [
    installExtFr as unknown as ArticleModule,
    connectMarketplaceFr as unknown as ArticleModule,
    accountSubFr as unknown as ArticleModule,
    crosslistFirstFr as unknown as ArticleModule,
    shopDesignerFr as unknown as ArticleModule,
    csvImportFr as unknown as ArticleModule,
    manageInventoryFr as unknown as ArticleModule,
    autoPriceDropsFr as unknown as ArticleModule,
    shippingLabelsFr as unknown as ArticleModule,
    autoOffersFr as unknown as ArticleModule,
    restockerFr as unknown as ArticleModule,
    relisterFr as unknown as ArticleModule,
  ],
  es: [
    installExtEs as unknown as ArticleModule,
    connectMarketplaceEs as unknown as ArticleModule,
    accountSubEs as unknown as ArticleModule,
    crosslistFirstEs as unknown as ArticleModule,
    shopDesignerEs as unknown as ArticleModule,
    csvImportEs as unknown as ArticleModule,
    manageInventoryEs as unknown as ArticleModule,
    autoPriceDropsEs as unknown as ArticleModule,
    shippingLabelsEs as unknown as ArticleModule,
    autoOffersEs as unknown as ArticleModule,
    restockerEs as unknown as ArticleModule,
    relisterEs as unknown as ArticleModule,
  ],
  de: [
    installExtDe as unknown as ArticleModule,
    connectMarketplaceDe as unknown as ArticleModule,
    accountSubDe as unknown as ArticleModule,
    crosslistFirstDe as unknown as ArticleModule,
    shopDesignerDe as unknown as ArticleModule,
    csvImportDe as unknown as ArticleModule,
    manageInventoryDe as unknown as ArticleModule,
    autoPriceDropsDe as unknown as ArticleModule,
    shippingLabelsDe as unknown as ArticleModule,
    autoOffersDe as unknown as ArticleModule,
    restockerDe as unknown as ArticleModule,
    relisterDe as unknown as ArticleModule,
  ],
};
