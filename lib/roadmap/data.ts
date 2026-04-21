import type { Marketplace } from '@/lib/docs/types';

export type RoadmapStatus = 'exploring' | 'building' | 'shipped';

export type RoadmapItem = {
  id: string;
  status: RoadmapStatus;
  title: string;
  description: string;
  marketplaces?: Marketplace[];
  tag?: string;
  meta: string;
};

export type RoadmapColumn = {
  status: RoadmapStatus;
  eyebrow: string;
  title: string;
  blurb: string;
};

export const ROADMAP_COLUMNS: RoadmapColumn[] = [
  {
    status: 'exploring',
    eyebrow: '01 / Later',
    title: 'Exploring',
    blurb: 'Ideas we’re scoping. No promises on timing.',
  },
  {
    status: 'building',
    eyebrow: '02 / Next',
    title: 'Building',
    blurb: 'Actively in development. Coming soon.',
  },
  {
    status: 'shipped',
    eyebrow: '03 / Done',
    title: 'Shipped',
    blurb: 'Available in the latest extension release.',
  },
];

export const ROADMAP_ITEMS: RoadmapItem[] = [
  {
    id: 'csv-bulk-import',
    status: 'exploring',
    title: 'Bulk CSV import',
    description: 'Upload a CSV of existing inventory and have SaleLinx create draft listings.',
    tag: 'Inventory',
    meta: 'Scoping',
  },
  {
    id: 'scheduled-relisting',
    status: 'exploring',
    title: 'Scheduled relisting',
    description: 'Queue relists to run on a schedule you set, not manually.',
    tag: 'Automation',
    meta: 'Scoping',
  },
  {
    id: 'ai-description-polish',
    status: 'exploring',
    title: 'AI description polish',
    description: 'One-click rewrite for titles and descriptions that look hand-written, not templated.',
    tag: 'AI',
    meta: 'Scoping',
  },

  {
    id: 'analytics-dashboard',
    status: 'building',
    title: 'Analytics dashboard',
    description: 'Sell-through rate, views per listing, and cross-marketplace sales trends.',
    tag: 'Insights',
    meta: 'Target Q2 2026',
  },

  {
    id: 'depop-vinted-crosslist',
    status: 'shipped',
    title: 'Depop and Vinted crosslisting',
    description: 'Bi-directional crosslisting with auto-mapped categories, sizes, and conditions.',
    marketplaces: ['depop', 'vinted'],
    meta: 'Shipped Apr 2026',
  },
  {
    id: 'shop-designer',
    status: 'shipped',
    title: 'Depop Shop Designer',
    description: 'Drag-and-drop layout tool for the Depop shop profile.',
    marketplaces: ['depop'],
    meta: 'Shipped Apr 2026',
  },
  {
    id: 'auto-offers',
    status: 'shipped',
    title: 'Auto-offer replies',
    description: 'Rule-based accept, counter, or decline on incoming offers across both marketplaces.',
    marketplaces: ['depop', 'vinted'],
    meta: 'Shipped Apr 2026',
  },
  {
    id: 'follow-bot',
    status: 'shipped',
    title: 'Follow and unfollow bot',
    description: 'Target followers, following, buyers, review-givers, or likers with human-looking pacing.',
    marketplaces: ['depop', 'vinted'],
    meta: 'Shipped Apr 2026',
  },
];

export function itemsByStatus(status: RoadmapStatus): RoadmapItem[] {
  return ROADMAP_ITEMS.filter((i) => i.status === status);
}
