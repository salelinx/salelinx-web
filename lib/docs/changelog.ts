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
import * as v112En from '@/content/changelog/en/2026-08-21-v1-1-2.mdx';
import * as v112Fr from '@/content/changelog/fr/2026-08-21-v1-1-2.mdx';
import * as v112Es from '@/content/changelog/es/2026-08-21-v1-1-2.mdx';
import * as v112De from '@/content/changelog/de/2026-08-21-v1-1-2.mdx';
import * as v113En from '@/content/changelog/en/2026-08-26-v1-1-3.mdx';
import * as v113Fr from '@/content/changelog/fr/2026-08-26-v1-1-3.mdx';
import * as v113Es from '@/content/changelog/es/2026-08-26-v1-1-3.mdx';
import * as v113De from '@/content/changelog/de/2026-08-26-v1-1-3.mdx';
// 1.1.4 was a Chrome Web Store listing update only; the 1.1.5 entry covers it.
import * as v115En from '@/content/changelog/en/2026-08-29-v1-1-5.mdx';
import * as v115Fr from '@/content/changelog/fr/2026-08-29-v1-1-5.mdx';
import * as v115Es from '@/content/changelog/es/2026-08-29-v1-1-5.mdx';
import * as v115De from '@/content/changelog/de/2026-08-29-v1-1-5.mdx';

// Entries are registered by hand, one import per locale. listChangelog sorts by
// metadata.date descending, so the order here does not matter.
const CHANGELOG_MODULES_BY_LOCALE: Record<Locale, ChangelogModule[]> = {
  en: [
    v115En as unknown as ChangelogModule,
    v113En as unknown as ChangelogModule,
    v112En as unknown as ChangelogModule,
    v110En as unknown as ChangelogModule,
    initialReleaseEn as unknown as ChangelogModule,
  ],
  fr: [
    v115Fr as unknown as ChangelogModule,
    v113Fr as unknown as ChangelogModule,
    v112Fr as unknown as ChangelogModule,
    v110Fr as unknown as ChangelogModule,
    initialReleaseFr as unknown as ChangelogModule,
  ],
  es: [
    v115Es as unknown as ChangelogModule,
    v113Es as unknown as ChangelogModule,
    v112Es as unknown as ChangelogModule,
    v110Es as unknown as ChangelogModule,
    initialReleaseEs as unknown as ChangelogModule,
  ],
  de: [
    v115De as unknown as ChangelogModule,
    v113De as unknown as ChangelogModule,
    v112De as unknown as ChangelogModule,
    v110De as unknown as ChangelogModule,
    initialReleaseDe as unknown as ChangelogModule,
  ],
  // Changelog entries are not translated into Arabic or Chinese yet, so both
  // read the English ones. Add locale dirs under content/changelog to change
  // that, and add the locale to TRANSLATED_CHANGELOG_LOCALES below.
  ar: [
    v115En as unknown as ChangelogModule,
    v113En as unknown as ChangelogModule,
    v112En as unknown as ChangelogModule,
    v110En as unknown as ChangelogModule,
    initialReleaseEn as unknown as ChangelogModule,
  ],
  zh: [
    v115En as unknown as ChangelogModule,
    v113En as unknown as ChangelogModule,
    v112En as unknown as ChangelogModule,
    v110En as unknown as ChangelogModule,
    initialReleaseEn as unknown as ChangelogModule,
  ],
};

// Locales with actually translated changelog entries. ar and zh serve the
// English fallback above, so the changelog page and the sitemap must not
// claim hreflang (or a localized canonical) for them; see TRANSLATED_DOCS_LOCALES
// in lib/docs/manifest.ts for the same pattern on articles.
export const TRANSLATED_CHANGELOG_LOCALES: readonly Locale[] = ['en', 'fr', 'es', 'de'];

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
