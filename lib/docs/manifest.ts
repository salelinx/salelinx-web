import type { ArticleModule } from './types';

import * as installExt from '@/content/docs/getting-started/install-the-extension.mdx';
import * as connectMarketplace from '@/content/docs/getting-started/connect-your-first-marketplace.mdx';
import * as crosslistFirst from '@/content/docs/crosslisting/crosslist-your-first-item.mdx';
import * as manageInventory from '@/content/docs/listings/manage-inventory.mdx';

export const ARTICLE_MODULES: ArticleModule[] = [
  installExt as unknown as ArticleModule,
  connectMarketplace as unknown as ArticleModule,
  crosslistFirst as unknown as ArticleModule,
  manageInventory as unknown as ArticleModule,
];
