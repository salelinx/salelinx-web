import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createTranslator } from 'next-intl';
import { LOCALES } from '../lib/i18n/locales';
import {
  ROADMAP_TITLE_MAX,
  archivedItems,
  itemsByStatus,
  localized,
  missingLocales,
  roadmapCopy,
  roadmapMeta,
  type RoadmapItem,
} from '../lib/roadmap/types';

function item(over: Partial<RoadmapItem>): RoadmapItem {
  return {
    id: 'x',
    status: 'exploring',
    sort_order: 0,
    tag: null,
    marketplaces: [],
    title: { en: 'Title' },
    description: { en: 'Description' },
    target_quarter: null,
    shipped_month: null,
    visible: true,
    archived_at: null,
    updated_at: '2026-10-13T00:00:00Z',
    ...over,
  };
}

describe('roadmapMeta', () => {
  it('uses the target quarter on cards that are not shipped', () => {
    expect(roadmapMeta(item({ status: 'building', target_quarter: '2026-Q4' }))).toEqual({
      key: 'target',
      year: '2026',
      quarter: '4',
    });
    expect(roadmapMeta(item({ status: 'exploring', target_quarter: '2027-Q1' }))).toEqual({
      key: 'target',
      year: '2027',
      quarter: '1',
    });
  });

  it('falls back to a per-column label without a target', () => {
    expect(roadmapMeta(item({ status: 'exploring' }))).toEqual({ key: 'scoping' });
    expect(roadmapMeta(item({ status: 'building' }))).toEqual({ key: 'inDevelopment' });
  });

  it('ignores a leftover target once shipped', () => {
    expect(
      roadmapMeta(item({ status: 'shipped', target_quarter: '2026-Q4', shipped_month: '2026-04' })),
    ).toEqual({ key: 'shipped', month: new Date(Date.UTC(2026, 3, 1)) });
    expect(roadmapMeta(item({ status: 'shipped', target_quarter: '2026-Q4' }))).toEqual({
      key: 'shippedUndated',
    });
  });
});

describe('localized', () => {
  it('falls back to English for a missing or blank locale', () => {
    const text = { en: 'Hello', fr: 'Bonjour', de: '' };
    expect(localized(text, 'fr')).toBe('Bonjour');
    expect(localized(text, 'de')).toBe('Hello');
    expect(localized(text, 'zh')).toBe('Hello');
  });

  it('lists locales missing either field', () => {
    const card = item({
      title: { en: 'a', fr: 'a', es: 'a', de: 'a', ar: 'a', zh: 'a' },
      description: { en: 'b', fr: 'b', es: 'b', de: 'b', ar: 'b' },
    });
    expect(missingLocales(card)).toEqual(['zh']);
  });
});

describe('itemsByStatus', () => {
  it('filters one column and orders by sort_order, then id', () => {
    const items = [
      item({ id: 'c', status: 'building', sort_order: 2 }),
      item({ id: 'b', status: 'building', sort_order: 1 }),
      item({ id: 'a', status: 'building', sort_order: 2 }),
      item({ id: 'z', status: 'shipped', sort_order: 0 }),
    ];
    expect(itemsByStatus(items, 'building').map((i) => i.id)).toEqual(['b', 'a', 'c']);
  });
});

// The footer labels are ICU messages with arguments, so a typo in one locale
// only shows up when that locale renders a card. Format every one here.
describe('Roadmap.meta messages', () => {
  for (const locale of LOCALES) {
    it(`${locale} renders every footer label`, () => {
      const messages = JSON.parse(
        readFileSync(path.resolve(__dirname, `../messages/${locale}.json`), 'utf8'),
      );
      const t = createTranslator({ locale, messages, namespace: 'Roadmap.meta' });
      for (const key of ['scoping', 'inDevelopment', 'shippedUndated'] as const) {
        expect(t(key)).toMatch(/\S/);
      }
      const target = t('target', { quarter: '4', year: '2026' });
      expect(target).toContain('2026');
      expect(target).not.toContain('{');
      // RoadmapCard passes the formatted month and its parts; a locale may
      // use either.
      const shipped = t('shipped', { date: 'DATE', year: '2026', month: '10' });
      expect(shipped).toMatch(/DATE|2026/);
      expect(shipped).not.toContain('{');
    });
  }

  it('matches the labels the hardcoded roadmap used to show', () => {
    const read = (l: string) =>
      JSON.parse(readFileSync(path.resolve(__dirname, `../messages/${l}.json`), 'utf8'));
    const target = (l: string) =>
      createTranslator({ locale: l, messages: read(l), namespace: 'Roadmap.meta' })('target', {
        quarter: '4',
        year: '2026',
      });
    expect(target('en')).toBe('Target Q4 2026');
    expect(target('fr')).toBe('Cible T4 2026');
    expect(target('ar')).toBe('الهدف الربع الرابع 2026');
    expect(target('zh')).toBe('目标 2026 年第四季度');

    const shipped = (l: string, date: string) =>
      createTranslator({ locale: l, messages: read(l), namespace: 'Roadmap.meta' })('shipped', {
        date,
        year: '2026',
        month: '10',
      });
    expect(shipped('en', 'Oct 2026')).toBe('Shipped Oct 2026');
    expect(shipped('es', 'octubre de 2026')).toBe('Lanzado en octubre de 2026');
    expect(shipped('zh', 'unused')).toBe('2026 年 10 月发布');
  });
});

describe('the archive', () => {
  const when = (day: number) => `2026-11-0${day}T00:00:00Z`;

  it('keeps archived cards out of their column', () => {
    const items = [
      item({ id: 'on-board', status: 'shipped' }),
      item({ id: 'put-away', status: 'shipped', archived_at: when(1) }),
    ];
    expect(itemsByStatus(items, 'shipped').map((i) => i.id)).toEqual(['on-board']);
  });

  it('lists only archived cards, most recent first', () => {
    const items = [
      item({ id: 'on-board' }),
      item({ id: 'older', archived_at: when(1) }),
      item({ id: 'newer', archived_at: when(2) }),
    ];
    expect(archivedItems(items).map((i) => i.id)).toEqual(['newer', 'older']);
  });

  // Rows read before the migration has run have no such column at all.
  it('treats a row with no archived_at as on the board', () => {
    const row = item({ id: 'old-row' });
    delete (row as Partial<RoadmapItem>).archived_at;
    expect(itemsByStatus([row], 'exploring')).toHaveLength(1);
    expect(archivedItems([row])).toHaveLength(0);
  });

  it('puts a copy of an archived card back on the board', () => {
    const copy = roadmapCopy(item({ id: 'x', archived_at: when(1) }), ['x']);
    expect(copy.archived_at).toBeNull();
    expect(copy.visible).toBe(false);
  });
});

describe('roadmapCopy', () => {
  // The same rule as the roadmap_items.id CHECK.
  const VALID_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

  it('hides the copy and keeps everything else', () => {
    const original = item({
      id: 'auto-relist',
      status: 'building',
      tag: 'automation',
      marketplaces: ['vinted'],
      title: { en: 'Auto relist', fr: 'Titre' },
      description: { en: 'Body', fr: 'Corps' },
      target_quarter: '2027-Q1',
    });
    expect(roadmapCopy(original, ['auto-relist'])).toEqual({
      ...original,
      id: 'auto-relist-copy',
      title: { en: 'Auto relist (copy)', fr: 'Titre' },
      visible: false,
    });
  });

  it('leaves the original untouched', () => {
    const original = item({ title: { en: 'Auto relist' } });
    roadmapCopy(original, []);
    expect(original.title.en).toBe('Auto relist');
    expect(original.visible).toBe(true);
  });

  it('skips ids already in use', () => {
    const taken = ['x', 'x-copy', 'x-copy-2'];
    expect(roadmapCopy(item({ id: 'x' }), taken).id).toBe('x-copy-3');
  });

  it('counts up rather than stacking suffixes when copying a copy', () => {
    const copy = roadmapCopy(
      item({ id: 'x-copy', title: { en: 'X (copy)' }, visible: false }),
      ['x', 'x-copy'],
    );
    expect(copy.id).toBe('x-copy-2');
    expect(copy.title.en).toBe('X (copy)');
  });

  it('keeps a full-length id within the cap and valid', () => {
    const long = `${'a'.repeat(54)}-${'b'.repeat(5)}`;
    expect(long).toHaveLength(60);
    const { id } = roadmapCopy(item({ id: long }), [long]);
    expect(id.length).toBeLessThanOrEqual(60);
    expect(id).toMatch(VALID_ID);
    expect(id.endsWith('-copy')).toBe(true);
  });

  it('does not leave a double hyphen when the cut lands on one', () => {
    const long = `${'a'.repeat(55)}-bbbb`;
    const { id } = roadmapCopy(item({ id: long }), [long]);
    expect(id).toBe(`${'a'.repeat(55)}-copy`);
    expect(id).toMatch(VALID_ID);
  });

  it('keeps a full-length title within the cap the save function enforces', () => {
    const { title } = roadmapCopy(
      item({ title: { en: 't'.repeat(ROADMAP_TITLE_MAX) } }),
      [],
    );
    expect(title.en.length).toBeLessThanOrEqual(ROADMAP_TITLE_MAX);
    expect(title.en.endsWith(' (copy)')).toBe(true);
  });
});
