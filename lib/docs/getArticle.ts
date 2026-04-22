import type { Locale } from '@/lib/i18n/locales';
import { ARTICLE_MODULES_BY_LOCALE } from './manifest';
import type { ArticleMetadata, ArticleModule, CategorySlug } from './types';

function modulesFor(locale: Locale): ArticleModule[] {
  return ARTICLE_MODULES_BY_LOCALE[locale] ?? ARTICLE_MODULES_BY_LOCALE.en;
}

export function listAllArticles(locale: Locale): ArticleModule[] {
  return [...modulesFor(locale)].sort((a, b) => {
    if (a.metadata.category !== b.metadata.category) {
      return a.metadata.category.localeCompare(b.metadata.category);
    }
    return a.metadata.order - b.metadata.order;
  });
}

export function listByCategory(
  locale: Locale,
  category: CategorySlug,
): ArticleModule[] {
  return modulesFor(locale)
    .filter((m) => m.metadata.category === category)
    .sort((a, b) => a.metadata.order - b.metadata.order);
}

export function getArticle(
  locale: Locale,
  category: CategorySlug,
  slug: string,
): ArticleModule | undefined {
  return modulesFor(locale).find(
    (m) => m.metadata.category === category && m.metadata.slug === slug,
  );
}

export function getPrevNext(
  locale: Locale,
  meta: ArticleMetadata,
): {
  prev?: ArticleMetadata;
  next?: ArticleMetadata;
} {
  const siblings = listByCategory(locale, meta.category).map((m) => m.metadata);
  const i = siblings.findIndex((m) => m.slug === meta.slug);
  return {
    prev: i > 0 ? siblings[i - 1] : undefined,
    next: i < siblings.length - 1 ? siblings[i + 1] : undefined,
  };
}

export function getRecentlyUpdated(
  locale: Locale,
  limit = 5,
): ArticleMetadata[] {
  return [...modulesFor(locale)]
    .map((m) => m.metadata)
    .filter((m) => m.status !== 'stub')
    .sort((a, b) => b.updated.localeCompare(a.updated))
    .slice(0, limit);
}

export function getArticleCountByCategory(
  locale: Locale,
): Record<CategorySlug, number> {
  const counts: Record<string, number> = {};
  for (const m of modulesFor(locale)) {
    counts[m.metadata.category] = (counts[m.metadata.category] ?? 0) + 1;
  }
  return counts as Record<CategorySlug, number>;
}
