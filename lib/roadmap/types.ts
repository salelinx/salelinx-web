import type { Marketplace } from '@/lib/docs/types';
import { DEFAULT_LOCALE, LOCALES, type Locale } from '@/lib/i18n/locales';

// Shapes and pure helpers for the public roadmap. Rows live in the
// roadmap_items table (migration 032_roadmap_items.sql) and are edited in
// /admin/roadmap. No server-only imports here: the admin editor is a Client
// Component and imports these too. Loaders are in ./data.ts.

export const ROADMAP_STATUSES = ['exploring', 'building', 'shipped'] as const;
export type RoadmapStatus = (typeof ROADMAP_STATUSES)[number];

// Closed set, mirrored by the CHECK on roadmap_items.tag. Labels are
// translated under Roadmap.tag in messages/*.json, so adding a tag means
// adding it in all three places.
export const ROADMAP_TAGS = [
  'inventory',
  'automation',
  'ai',
  'insights',
  'marketplaces',
] as const;
export type RoadmapTagKey = (typeof ROADMAP_TAGS)[number];

// Must match the CHECK on roadmap_items.marketplaces and admin_save_roadmap_item's
// allowed list (041_roadmap_ebay_marketplace.sql); a value missing there is
// refused with invalid_marketplaces.
export const ROADMAP_MARKETPLACES: Marketplace[] = ['depop', 'vinted', 'ebay'];

// Copy per locale. English is always present (the table CHECK requires it);
// any other locale may be missing and falls back to English.
export type LocalizedText = Partial<Record<Locale, string>> & { en: string };

export type RoadmapItem = {
  id: string;
  status: RoadmapStatus;
  sort_order: number;
  tag: RoadmapTagKey | null;
  marketplaces: Marketplace[];
  title: LocalizedText;
  description: LocalizedText;
  // 'YYYY-QN', shown on cards that are not shipped.
  target_quarter: string | null;
  // 'YYYY-MM', shown on shipped cards.
  shipped_month: string | null;
  visible: boolean;
  updated_at: string;
};

export function localized(text: LocalizedText, locale: string): string {
  return text[locale as Locale] || text[DEFAULT_LOCALE] || text.en;
}

// Locales other than English that have no copy for this card. Drives the
// "missing translations" hint in the console.
export function missingLocales(item: Pick<RoadmapItem, 'title' | 'description'>): Locale[] {
  return LOCALES.filter(
    (l) => l !== DEFAULT_LOCALE && (!item.title[l] || !item.description[l]),
  );
}

export function itemsByStatus(
  items: RoadmapItem[],
  status: RoadmapStatus,
): RoadmapItem[] {
  return items
    .filter((i) => i.status === status)
    .sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id));
}

// The card footer, as a translation key plus values. Built from status and
// the date fields rather than stored as text, so it comes out translated in
// every locale. `month` is returned as a Date for the caller to format, since
// month names are locale-specific.
export type RoadmapMeta =
  | { key: 'scoping' | 'inDevelopment' | 'shippedUndated' }
  | { key: 'target'; quarter: string; year: string }
  | { key: 'shipped'; month: Date };

export function roadmapMeta(
  item: Pick<RoadmapItem, 'status' | 'target_quarter' | 'shipped_month'>,
): RoadmapMeta {
  if (item.status === 'shipped') {
    const m = item.shipped_month?.match(/^(\d{4})-(\d{2})$/);
    if (!m) return { key: 'shippedUndated' };
    return { key: 'shipped', month: new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1)) };
  }
  const q = item.target_quarter?.match(/^(\d{4})-Q([1-4])$/);
  if (q) return { key: 'target', year: q[1], quarter: q[2] };
  return { key: item.status === 'building' ? 'inDevelopment' : 'scoping' };
}
