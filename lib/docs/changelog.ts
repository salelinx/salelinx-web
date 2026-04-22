import type { Locale } from '@/lib/i18n/locales';
import type { ChangelogEntryMetadata, ChangelogModule } from './types';

import * as initialReleaseEn from '@/content/changelog/en/2026-04-15-initial-release.mdx';
import * as initialReleaseFr from '@/content/changelog/fr/2026-04-15-initial-release.mdx';
import * as initialReleaseEs from '@/content/changelog/es/2026-04-15-initial-release.mdx';
import * as initialReleaseDe from '@/content/changelog/de/2026-04-15-initial-release.mdx';

const CHANGELOG_MODULES_BY_LOCALE: Record<Locale, ChangelogModule[]> = {
  en: [initialReleaseEn as unknown as ChangelogModule],
  fr: [initialReleaseFr as unknown as ChangelogModule],
  es: [initialReleaseEs as unknown as ChangelogModule],
  de: [initialReleaseDe as unknown as ChangelogModule],
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
