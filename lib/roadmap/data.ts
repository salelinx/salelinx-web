import type { Marketplace } from '@/lib/docs/types';

export type RoadmapStatus = 'exploring' | 'building' | 'shipped';

export type RoadmapMetaKey =
  | 'scoping'
  | 'targetQ4_2026'
  | 'nextRelease'
  | 'shippedOct_2026'
  | 'shippedSep_2026'
  | 'shippedAug_2026'
  | 'shippedApr_2026';

export type RoadmapTagKey =
  | 'inventory'
  | 'automation'
  | 'ai'
  | 'insights'
  | 'marketplaces';

export type RoadmapItem = {
  id: string;
  status: RoadmapStatus;
  metaKey: RoadmapMetaKey;
  marketplaces?: Marketplace[];
  tagKey?: RoadmapTagKey;
};

export type RoadmapColumn = {
  status: RoadmapStatus;
};

export const ROADMAP_COLUMNS: RoadmapColumn[] = [
  { status: 'exploring' },
  { status: 'building' },
  { status: 'shipped' },
];

// Shipped items are newest first; dates come from content/changelog.
export const ROADMAP_ITEMS: RoadmapItem[] = [
  {
    id: 'ebay-integration',
    status: 'building',
    tagKey: 'marketplaces',
    metaKey: 'targetQ4_2026',
  },
  {
    id: 'bulk-price-edit',
    status: 'building',
    tagKey: 'inventory',
    metaKey: 'nextRelease',
  },
  {
    id: 'poshmark-integration',
    status: 'exploring',
    tagKey: 'marketplaces',
    metaKey: 'scoping',
  },
  {
    id: 'scheduled-relisting',
    status: 'exploring',
    tagKey: 'automation',
    metaKey: 'scoping',
  },
  {
    id: 'ai-description-polish',
    status: 'exploring',
    tagKey: 'ai',
    metaKey: 'scoping',
  },
  {
    id: 'analytics-dashboard',
    status: 'exploring',
    tagKey: 'insights',
    metaKey: 'scoping',
  },
  {
    id: 'crosslist-review',
    status: 'shipped',
    marketplaces: ['depop', 'vinted'],
    metaKey: 'shippedOct_2026',
  },
  {
    id: 'local-currency',
    status: 'shipped',
    marketplaces: ['depop', 'vinted'],
    metaKey: 'shippedSep_2026',
  },
  {
    id: 'crosslist-drafts',
    status: 'shipped',
    marketplaces: ['depop', 'vinted'],
    metaKey: 'shippedSep_2026',
  },
  {
    id: 'synced-presets',
    status: 'shipped',
    marketplaces: ['depop', 'vinted'],
    metaKey: 'shippedSep_2026',
  },
  {
    id: 'label-carriers',
    status: 'shipped',
    marketplaces: ['depop', 'vinted'],
    metaKey: 'shippedAug_2026',
  },
  {
    id: 'choose-marketplaces',
    status: 'shipped',
    marketplaces: ['depop', 'vinted'],
    metaKey: 'shippedAug_2026',
  },
  {
    id: 'google-sign-in',
    status: 'shipped',
    metaKey: 'shippedAug_2026',
  },
  {
    id: 'depop-vinted-crosslist',
    status: 'shipped',
    marketplaces: ['depop', 'vinted'],
    metaKey: 'shippedApr_2026',
  },
  {
    id: 'shop-designer',
    status: 'shipped',
    marketplaces: ['depop'],
    metaKey: 'shippedApr_2026',
  },
  {
    id: 'auto-offers',
    status: 'shipped',
    marketplaces: ['depop', 'vinted'],
    metaKey: 'shippedApr_2026',
  },
  {
    id: 'follow-bot',
    status: 'shipped',
    marketplaces: ['depop', 'vinted'],
    metaKey: 'shippedApr_2026',
  },
];

export function itemsByStatus(status: RoadmapStatus): RoadmapItem[] {
  return ROADMAP_ITEMS.filter((i) => i.status === status);
}
