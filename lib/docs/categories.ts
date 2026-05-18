import type { DocCategory } from './types';

export const CATEGORIES: DocCategory[] = [
  { slug: 'getting-started', icon: 'play', order: 1 },
  { slug: 'crosslisting', icon: 'swap', order: 2 },
  { slug: 'listings', icon: 'grid', order: 3 },
  { slug: 'visibility', icon: 'refresh', order: 4 },
  { slug: 'sales', icon: 'tag', order: 5 },
  { slug: 'marketplaces', icon: 'globe', order: 6 },
];

export function getCategory(slug: string): DocCategory | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}
