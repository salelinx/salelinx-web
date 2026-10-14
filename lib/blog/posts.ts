import type { BlogCategory, PostMetadata, PostModule } from './types';

// Blog posts are English-only: they target UK search queries, so there is no
// per-locale content tree like content/docs/. Every locale serves these
// modules and pageMetadata's contentLocales: ['en'] canonicalizes the
// localized URLs to the English one.
//
// Adding a post: create content/blog/en/<slug>.mdx with a named
// `export const metadata`, import it here and add it to POSTS. The sitemap,
// the index page and related-post links all read from this list.
import * as bestTimeToPostOnVinted from '@/content/blog/en/best-time-to-post-on-vinted.mdx';
import * as vendooAlternativeUk from '@/content/blog/en/vendoo-alternative-uk.mdx';
import * as listPerfectlyAlternativeUk from '@/content/blog/en/list-perfectly-alternative-uk.mdx';

export const BLOG_CONTENT_LOCALES = ['en'] as const;

const POSTS: PostModule[] = [
  bestTimeToPostOnVinted as unknown as PostModule,
  vendooAlternativeUk as unknown as PostModule,
  listPerfectlyAlternativeUk as unknown as PostModule,
];

export const BLOG_CATEGORIES: { slug: BlogCategory; title: string; blurb: string }[] = [
  {
    slug: 'guides',
    title: 'Selling guides',
    blurb: 'Answers to the questions Depop and Vinted sellers ask most.',
  },
  {
    slug: 'comparisons',
    title: 'Comparisons',
    blurb: 'How SaleLinx stacks up against other reselling tools, for sellers in the UK.',
  },
];

export function categoryTitle(slug: BlogCategory): string {
  return BLOG_CATEGORIES.find((c) => c.slug === slug)?.title ?? slug;
}

// Newest first, by publish date.
export function listPosts(): PostModule[] {
  return [...POSTS].sort((a, b) => b.metadata.published.localeCompare(a.metadata.published));
}

export function getPost(slug: string): PostModule | undefined {
  return POSTS.find((p) => p.metadata.slug === slug);
}

// Same-category posts first, then the rest, newest first within each.
export function relatedPosts(meta: PostMetadata, limit = 3): PostMetadata[] {
  const others = listPosts()
    .map((p) => p.metadata)
    .filter((m) => m.slug !== meta.slug);
  return [
    ...others.filter((m) => m.category === meta.category),
    ...others.filter((m) => m.category !== meta.category),
  ].slice(0, limit);
}

export function formatPostDate(date: string): string {
  // Fixed to en-GB and UTC: the posts are English-only and a date-only string
  // parses as UTC midnight, so a local timezone could shift it a day.
  return new Date(date).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
