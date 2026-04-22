import type { DocCategory } from './types';

export const CATEGORIES: DocCategory[] = [
  { slug: 'getting-started', icon: 'play', order: 1 },
  { slug: 'crosslisting', icon: 'swap', order: 2 },
  { slug: 'listings', icon: 'grid', order: 3 },
  { slug: 'marketplaces', icon: 'globe', order: 4 },
];

export function getCategory(slug: string): DocCategory | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}
