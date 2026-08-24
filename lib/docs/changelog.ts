import type { Locale } from '@/lib/i18n/locales';
import type { ChangelogEntryMetadata, ChangelogModule } from './types';

import * as initialReleaseEn from '@/content/changelog/en/2026-04-15-initial-release.mdx';
import * as initialReleaseFr from '@/content/changelog/fr/2026-04-15-initial-release.mdx';
import * as initialReleaseEs from '@/content/changelog/es/2026-04-15-initial-release.mdx';
import * as initialReleaseDe from '@/content/changelog/de/2026-04-15-initial-release.mdx';
import * as v110En from '@/content/changelog/en/2026-08-17-v1-1-0.mdx';
import * as v110Fr from '@/content/changelog/fr/2026-08-17-v1-1-0.mdx';
import * as v110Es from '@/content/changelog/es/2026-08-17-v1-1-0.mdx';
import * as v110De from '@/content/changelog/de/2026-08-17-v1-1-0.mdx';

// Entries are registered by hand, one import per locale. listChangelog sorts by
// metadata.date descending, so the order here does not matter.
const CHANGELOG_MODULES_BY_LOCALE: Record<Locale, ChangelogModule[]> = {
  en: [v110En as unknown as ChangelogModule, initialReleaseEn as unknown as ChangelogModule],
  fr: [v110Fr as unknown as ChangelogModule, initialReleaseFr as unknown as ChangelogModule],
  es: [v110Es as unknown as ChangelogModule, initialReleaseEs as unknown as ChangelogModule],
  de: [v110De as unknown as ChangelogModule, initialReleaseDe as unknown as ChangelogModule],
  // Changelog entries are not translated into Arabic or Chinese yet, so both
  // read the English ones. Add locale dirs under content/changelog to change that.
  ar: [v110En as unknown as ChangelogModule, initialReleaseEn as unknown as ChangelogModule],
  zh: [v110En as unknown as ChangelogModule, initialReleaseEn as unknown as ChangelogModule],
};

function modulesFor(locale: Locale): ChangelogModule[] {
  return CHANGELOG_MODULES_BY_LOCALE[locale] ?? CHANGELOG_MODULES_BY_LOCALE.en;
}

export function listChangelog(locale: Locale): ChangelogModule[] {
  return [...modulesFor(locale)].sort((a, b) =>
    b.metadata.date.localeCompare(a.metadata.date),
  );
}

export function getRecentChangelog(
  locale: Locale,
  limit = 3,
): ChangelogEntryMetadata[] {
  return listChangelog(locale)
    .slice(0, limit)
    .map((m) => m.metadata);
}

export function formatChangelogDate(iso: string, locale: Locale): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
