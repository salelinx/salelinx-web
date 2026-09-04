import { routing } from '@/i18n/routing';
import { SITE_NAME, SITE_URL, absoluteUrl } from '@/lib/site';
import { TRANSLATED_DOCS_LOCALES } from '@/lib/docs/manifest';
import type { ArticleMetadata } from '@/lib/docs/types';

// Structured-data builders for the docs pages, rendered as
// <script type="application/ld+json"> by the page components. URLs always
// use the canonical locale (untranslated locales canonicalize to the
// default-locale URL, mirroring pageMetadata's contentLocales behaviour), so
// the markup never describes a URL whose own tags point elsewhere.

export function docsCanonicalLocale(locale: string): string {
  return (TRANSLATED_DOCS_LOCALES as readonly string[]).includes(locale)
    ? locale
    : routing.defaultLocale;
}

// Referenced (not restated) by @id on every page: the full Organization node
// with aliases and sameAs lives in the homepage graph. A compact copy here
// keeps the article graph self-contained for parsers that read one page.
function organizationNode() {
  return {
    '@type': 'Organization',
    '@id': `${SITE_URL}/#organization`,
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/salelinx-icon.png`,
  };
}

export function breadcrumbJsonLd(
  locale: string,
  trail: { name: string; path?: string }[],
): Record<string, unknown> {
  const canonicalLocale = docsCanonicalLocale(locale);
  return {
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((crumb, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: crumb.name,
      // The last crumb is the page itself; schema.org allows omitting item.
      ...(crumb.path ? { item: absoluteUrl(canonicalLocale, crumb.path) } : {}),
    })),
  };
}

export function articleJsonLd({
  locale,
  metadata,
  categoryTitle,
  docsLabel,
}: {
  locale: string;
  metadata: ArticleMetadata;
  categoryTitle: string;
  docsLabel: string;
}): Record<string, unknown> {
  const canonicalLocale = docsCanonicalLocale(locale);
  const path = `/docs/${metadata.category}/${metadata.slug}`;
  const url = absoluteUrl(canonicalLocale, path);
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'TechArticle',
        '@id': `${url}#article`,
        headline: metadata.title,
        description: metadata.description,
        url,
        mainEntityOfPage: url,
        inLanguage: canonicalLocale,
        dateModified: metadata.updated,
        author: { '@id': `${SITE_URL}/#organization` },
        publisher: { '@id': `${SITE_URL}/#organization` },
      },
      breadcrumbJsonLd(locale, [
        { name: docsLabel, path: '/docs' },
        { name: categoryTitle, path: `/docs/${metadata.category}` },
        { name: metadata.title },
      ]),
      organizationNode(),
    ],
  };
}

export function categoryJsonLd({
  locale,
  categoryTitle,
  docsLabel,
}: {
  locale: string;
  categoryTitle: string;
  docsLabel: string;
}): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      breadcrumbJsonLd(locale, [
        { name: docsLabel, path: '/docs' },
        { name: categoryTitle },
      ]),
      organizationNode(),
    ],
  };
}
