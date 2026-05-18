import type { DocCategory } from './types';

export const CATEGORIES: DocCategory[] = [
  { slug: 'getting-started', icon: 'play', order: 1 },
  { slug: 'inventory', icon: 'grid', order: 2 },
  { slug: 'automate', icon: 'sparkle', order: 3 },
  { slug: 'buyers', icon: 'message', order: 4 },
];

export function getCategory(slug: string): DocCategory | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}
