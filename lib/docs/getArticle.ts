import { ARTICLE_MODULES } from './manifest';
import type { ArticleMetadata, ArticleModule, CategorySlug } from './types';

export function listAllArticles(): ArticleModule[] {
  return [...ARTICLE_MODULES].sort((a, b) => {
    if (a.metadata.category !== b.metadata.category) {
      return a.metadata.category.localeCompare(b.metadata.category);
    }
    return a.metadata.order - b.metadata.order;
  });
}

export function listByCategory(category: CategorySlug): ArticleModule[] {
  return ARTICLE_MODULES.filter((m) => m.metadata.category === category).sort(
    (a, b) => a.metadata.order - b.metadata.order,
  );
}

export function getArticle(
  category: CategorySlug,
  slug: string,
): ArticleModule | undefined {
  return ARTICLE_MODULES.find(
    (m) => m.metadata.category === category && m.metadata.slug === slug,
  );
}

export function getPrevNext(meta: ArticleMetadata): {
  prev?: ArticleMetadata;
  next?: ArticleMetadata;
} {
  const siblings = listByCategory(meta.category).map((m) => m.metadata);
  const i = siblings.findIndex((m) => m.slug === meta.slug);
  return {
    prev: i > 0 ? siblings[i - 1] : undefined,
    next: i < siblings.length - 1 ? siblings[i + 1] : undefined,
  };
}

export function getRecentlyUpdated(limit = 5): ArticleMetadata[] {
  return [...ARTICLE_MODULES]
    .map((m) => m.metadata)
    .filter((m) => m.status !== 'stub')
    .sort((a, b) => b.updated.localeCompare(a.updated))
    .slice(0, limit);
}

export function getArticleCountByCategory(): Record<CategorySlug, number> {
  const counts: Record<string, number> = {};
  for (const m of ARTICLE_MODULES) {
    counts[m.metadata.category] = (counts[m.metadata.category] ?? 0) + 1;
  }
  return counts as Record<CategorySlug, number>;
}
