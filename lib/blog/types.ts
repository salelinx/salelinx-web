import type { Marketplace } from '@/lib/docs/types';

export type BlogCategory = 'guides' | 'comparisons';

export type PostMetadata = {
  // Used for the h1, <title> and og:title, so keep it under about 60 characters.
  title: string;
  // Meta description and the excerpt on the index card. Aim for 140 to 160.
  description: string;
  slug: string;
  category: BlogCategory;
  // YYYY-MM-DD. `updated` is the last time the facts were re-checked, which is
  // what dateModified and the sitemap's lastModified report.
  published: string;
  updated: string;
  // Rounded words / 220. tests/blog-content.test.ts recomputes it and fails
  // when the body has drifted, so edit this when the test says so.
  readingMinutes: number;
  marketplaces?: Marketplace[];
};

export type PostModule = {
  metadata: PostMetadata;
  default: React.ComponentType;
};
