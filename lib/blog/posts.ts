import type { BlogCategory, PostMetadata, PostModule } from './types';

// Blog posts are English-only: they target UK search queries, so there is no
// per-locale content tree like content/docs/. Every locale serves these
// modules and pageMetadata's contentLocales: ['en'] canonicalizes the
// localized URLs to the English one.
//
// Adding a post: create content/blog/en/<slug>.mdx with a named
// `export const metadata`, import it here and add it to POSTS. The sitemap,
// the index page and related-post links all read from this list.
import * as bestCrosslistingAppsUk from '@/content/blog/en/best-crosslisting-apps-uk.mdx';
import * as bestTimeToPostOnVinted from '@/content/blog/en/best-time-to-post-on-vinted.mdx';
import * as crosslistVintedToEbay from '@/content/blog/en/crosslist-vinted-to-ebay.mdx';
import * as depopVsVintedUk from '@/content/blog/en/depop-vs-vinted-uk.mdx';
import * as ebayFeesUk from '@/content/blog/en/ebay-fees-uk.mdx';
import * as ebayItemSpecifics from '@/content/blog/en/ebay-item-specifics.mdx';
import * as howToPriceSecondHandClothes from '@/content/blog/en/how-to-price-second-hand-clothes.mdx';
import * as howToRelistOnVinted from '@/content/blog/en/how-to-relist-on-vinted.mdx';
import * as howToSendOffers from '@/content/blog/en/how-to-send-offers-ebay-vinted-depop.mdx';
import * as taxOnVintedAndDepopSales from '@/content/blog/en/tax-on-vinted-and-depop-sales.mdx';
import * as vintedBump from '@/content/blog/en/vinted-bump-cost-and-does-it-work.mdx';
import * as vintedFeesUk from '@/content/blog/en/vinted-fees-uk.mdx';
import * as vintedParcelLostOrDamaged from '@/content/blog/en/vinted-parcel-lost-or-damaged.mdx';

export const BLOG_CONTENT_LOCALES = ['en'] as const;

const POSTS: PostModule[] = [
  bestCrosslistingAppsUk as unknown as PostModule,
  bestTimeToPostOnVinted as unknown as PostModule,
  crosslistVintedToEbay as unknown as PostModule,
  depopVsVintedUk as unknown as PostModule,
  ebayFeesUk as unknown as PostModule,
  ebayItemSpecifics as unknown as PostModule,
  howToPriceSecondHandClothes as unknown as PostModule,
  howToRelistOnVinted as unknown as PostModule,
  howToSendOffers as unknown as PostModule,
  taxOnVintedAndDepopSales as unknown as PostModule,
  vintedBump as unknown as PostModule,
  vintedFeesUk as unknown as PostModule,
  vintedParcelLostOrDamaged as unknown as PostModule,
];

export const BLOG_CATEGORIES: { slug: BlogCategory; title: string; blurb: string }[] = [
  {
    slug: 'guides',
    title: 'Selling guides',
    blurb: 'Answers to the questions Depop, Vinted and eBay sellers ask most.',
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
