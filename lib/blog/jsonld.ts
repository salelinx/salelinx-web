import { routing } from '@/i18n/routing';
import { SITE_URL, absoluteUrl } from '@/lib/site';
import { organizationNode } from '@/lib/docs/jsonld';
import { AUTHORS } from './posts';
import type { FaqItem } from './faq';
import type { PostMetadata } from './types';

// Posts are English-only, so every URL here is the default-locale one, which
// is also what the localized copies canonicalize to.
const LOCALE = routing.defaultLocale;

export function postUrl(slug: string): string {
  return absoluteUrl(LOCALE, `/blog/${slug}`);
}

export function postJsonLd(meta: PostMetadata, faq: FaqItem[]): Record<string, unknown> {
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
        author: {
          '@type': 'Person',
          name: AUTHORS[meta.author],
          worksFor: { '@id': `${SITE_URL}/#organization` },
        },
        publisher: { '@id': `${SITE_URL}/#organization` },
        isPartOf: { '@id': `${absoluteUrl(LOCALE, '/blog')}#blog` },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Guides', item: absoluteUrl(LOCALE, '/blog') },
          { '@type': 'ListItem', position: 2, name: meta.title },
        ],
      },
      ...(faq.length
        ? [
            {
              '@type': 'FAQPage',
              '@id': `${url}#faq`,
              mainEntity: faq.map((f) => ({
                '@type': 'Question',
                name: f.question,
                acceptedAnswer: { '@type': 'Answer', text: f.answer },
              })),
            },
          ]
        : []),
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
        name: 'SaleLinx Guides',
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
