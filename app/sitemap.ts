import type { MetadataRoute } from 'next';
import { routing } from '@/i18n/routing';
import { SITE_URL, absoluteUrl } from '@/lib/site';
import { ARTICLE_MODULES_BY_LOCALE } from '@/lib/docs/manifest';

const STATIC_PATHS: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] }[] = [
  { path: '/', priority: 1.0, changeFrequency: 'weekly' },
  { path: '/features', priority: 0.9, changeFrequency: 'weekly' },
  { path: '/faq', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/docs', priority: 0.8, changeFrequency: 'weekly' },
  { path: '/docs/changelog', priority: 0.6, changeFrequency: 'weekly' },
  { path: '/docs/status', priority: 0.5, changeFrequency: 'daily' },
  { path: '/legal/privacy', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/legal/terms', priority: 0.3, changeFrequency: 'yearly' },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];
  const now = new Date();

  for (const { path, priority, changeFrequency } of STATIC_PATHS) {
    const alternateLanguages: Record<string, string> = {};
    for (const locale of routing.locales) {
      alternateLanguages[locale] = absoluteUrl(locale, path);
    }
    entries.push({
      url: absoluteUrl(routing.defaultLocale, path),
      lastModified: now,
      changeFrequency,
      priority,
      alternates: { languages: alternateLanguages },
    });
  }

  const articles = ARTICLE_MODULES_BY_LOCALE[routing.defaultLocale];
  for (const article of articles) {
    const { category, slug, updated } = article.metadata;
    const path = `/docs/${category}/${slug}`;
    const alternateLanguages: Record<string, string> = {};
    for (const locale of routing.locales) {
      alternateLanguages[locale] = absoluteUrl(locale, path);
    }
    entries.push({
      url: absoluteUrl(routing.defaultLocale, path),
      lastModified: updated ? new Date(updated) : now,
      changeFrequency: 'monthly',
      priority: 0.6,
      alternates: { languages: alternateLanguages },
    });
  }

  return entries;
}

export const baseUrl = SITE_URL;
