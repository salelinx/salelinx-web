import type { Marketplace } from '@/lib/docs/types';

export type RoadmapStatus = 'exploring' | 'building' | 'shipped';

export type RoadmapMetaKey =
  | 'scoping'
  | 'targetQ2_2026'
  | 'shippedApr_2026';

export type RoadmapTagKey = 'inventory' | 'automation' | 'ai' | 'insights';

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

export const ROADMAP_ITEMS: RoadmapItem[] = [
  {
    id: 'csv-bulk-import',
    status: 'exploring',
    tagKey: 'inventory',
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
    status: 'building',
    tagKey: 'insights',
    metaKey: 'targetQ2_2026',
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
