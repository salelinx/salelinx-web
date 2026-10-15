import { routing } from '@/i18n/routing';
import { SITE_URL, absoluteUrl } from '@/lib/site';
import { organizationNode } from '@/lib/docs/jsonld';
import type { PostMetadata } from './types';

// Posts are English-only, so every URL here is the default-locale one, which
// is also what the localized copies canonicalize to.
const LOCALE = routing.defaultLocale;

export function postUrl(slug: string): string {
  return absoluteUrl(LOCALE, `/blog/${slug}`);
}

export function postJsonLd(meta: PostMetadata): Record<string, unknown> {
  const url = postUrl(meta.slug);
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BlogPosting',
        '@id': `${url}#article`,
        headline: meta.title,
        description: meta.description,
        url,
        mainEntityOfPage: url,
        inLanguage: LOCALE,
        datePublished: meta.published,
        dateModified: meta.updated,
        author: { '@id': `${SITE_URL}/#organization` },
        publisher: { '@id': `${SITE_URL}/#organization` },
        isPartOf: { '@id': `${absoluteUrl(LOCALE, '/blog')}#blog` },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Blog', item: absoluteUrl(LOCALE, '/blog') },
          { '@type': 'ListItem', position: 2, name: meta.title },
        ],
      },
      organizationNode(),
    ],
  };
}

export function blogJsonLd(posts: PostMetadata[]): Record<string, unknown> {
  const url = absoluteUrl(LOCALE, '/blog');
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Blog',
        '@id': `${url}#blog`,
        name: 'SaleLinx Blog',
        url,
        inLanguage: LOCALE,
        publisher: { '@id': `${SITE_URL}/#organization` },
        blogPost: posts.map((p) => ({
          '@type': 'BlogPosting',
          '@id': `${postUrl(p.slug)}#article`,
          headline: p.title,
          url: postUrl(p.slug),
          datePublished: p.published,
          dateModified: p.updated,
        })),
      },
      organizationNode(),
    ],
  };
}
