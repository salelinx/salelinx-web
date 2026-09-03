import type { MetadataRoute } from 'next';
import { routing } from '@/i18n/routing';
import { SITE_URL, absoluteUrl } from '@/lib/site';
import { ARTICLE_MODULES_BY_LOCALE, TRANSLATED_DOCS_LOCALES } from '@/lib/docs/manifest';
import { TRANSLATED_CHANGELOG_LOCALES } from '@/lib/docs/changelog';

// `locales` limits which language alternates an entry claims; it must match
// the contentLocales the page itself passes to pageMetadata. Untranslated
// locales (docs in ar/zh, the English-only legal pages) are left out so the
// sitemap never advertises an hreflang the page's own tags do not carry.
// A single-locale entry gets no alternates block at all.
//
// No lastModified on static paths: we do not track real edit dates for them,
// and stamping every entry with the build time teaches crawlers to ignore
// the field, including the genuine per-article dates below.
const STATIC_PATHS: {
  path: string;
  priority: number;
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'];
  locales?: readonly string[];
}[] = [
  { path: '/', priority: 1.0, changeFrequency: 'weekly' },
  { path: '/features', priority: 0.9, changeFrequency: 'weekly' },
  { path: '/help', priority: 0.6, changeFrequency: 'monthly' },
  // The old /faq is a redirect stub; the FAQ itself lives at /help/faq.
  // /help/support is deliberately absent: it redirects logged-out visitors
  // (crawlers included) to login, so listing it would only draw soft-404s.
  { path: '/help/faq', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/docs', priority: 0.8, changeFrequency: 'weekly', locales: TRANSLATED_DOCS_LOCALES },
  {
    path: '/docs/changelog',
    priority: 0.6,
    changeFrequency: 'weekly',
    locales: TRANSLATED_CHANGELOG_LOCALES,
  },
  { path: '/docs/status', priority: 0.5, changeFrequency: 'daily' },
  { path: '/legal/privacy', priority: 0.3, changeFrequency: 'yearly', locales: ['en'] },
  { path: '/legal/terms', priority: 0.3, changeFrequency: 'yearly', locales: ['en'] },
];

function alternatesFor(
  path: string,
  locales: readonly string[],
): { languages: Record<string, string> } | undefined {
  if (locales.length <= 1) return undefined;
  const languages: Record<string, string> = {};
  for (const locale of locales) {
    languages[locale] = absoluteUrl(locale, path);
  }
  return { languages };
}

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];
  const now = new Date();

  for (const { path, priority, changeFrequency, locales } of STATIC_PATHS) {
    entries.push({
      url: absoluteUrl(routing.defaultLocale, path),
      changeFrequency,
      priority,
      alternates: alternatesFor(path, locales ?? routing.locales),
    });
  }

  const articles = ARTICLE_MODULES_BY_LOCALE[routing.defaultLocale];
  for (const article of articles) {
    const { category, slug, updated } = article.metadata;
    const path = `/docs/${category}/${slug}`;
    entries.push({
      url: absoluteUrl(routing.defaultLocale, path),
      lastModified: updated ? new Date(updated) : now,
      changeFrequency: 'monthly',
      priority: 0.6,
      alternates: alternatesFor(path, TRANSLATED_DOCS_LOCALES),
    });
  }

  return entries;
}

export const baseUrl = SITE_URL;
