import type { DocCategory } from './types';

export const CATEGORIES: DocCategory[] = [
  {
    slug: 'getting-started',
    title: 'Getting started',
    blurb: 'Install the extension, sign in, and post your first listing.',
    icon: 'play',
    order: 1,
  },
  {
    slug: 'crosslisting',
    title: 'Crosslisting',
    blurb: 'Post once, publish to both marketplaces with translated fields.',
    icon: 'swap',
    order: 2,
  },
  {
    slug: 'listings',
    title: 'Listings & inventory',
    blurb: 'Manage your catalogue, bulk edits, refresh, relist and backups.',
    icon: 'grid',
    order: 3,
  },
  {
    slug: 'marketplaces',
    title: 'Marketplaces',
    blurb: 'Platform-specific guides for Depop, Vinted and more.',
    icon: 'globe',
    order: 4,
  },
];

export function getCategory(slug: string): DocCategory | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}
