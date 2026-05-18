import type { IconName } from '@/components/Icon';

export type CategorySlug =
  | 'getting-started'
  | 'crosslisting'
  | 'listings'
  | 'visibility'
  | 'sales'
  | 'marketplaces';

export type Marketplace = 'depop' | 'vinted';

export type StatusState = 'ok' | 'degraded' | 'down';

export type DocCategory = {
  slug: CategorySlug;
  icon: IconName;
  order: number;
};

export type ArticleMetadata = {
  title: string;
  description?: string;
  category: CategorySlug;
  slug: string;
  order: number;
  updated: string;
  tags?: string[];
  marketplaces?: Marketplace[];
  status?: 'published' | 'stub';
};

export type ArticleModule = {
  metadata: ArticleMetadata;
  default: React.ComponentType;
};

export type ChangelogEntryMetadata = {
  title: string;
  date: string;
  summary: string;
  tags?: string[];
};

export type ChangelogModule = {
  metadata: ChangelogEntryMetadata;
  default: React.ComponentType;
};

export type MarketplaceStatus = {
  marketplace: Marketplace;
  state: StatusState;
  note?: string;
  updatedAt: string;
};
