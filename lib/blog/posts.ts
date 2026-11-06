import type { AuthorId, BlogCategory, PostMetadata, PostModule } from './types';

export const AUTHORS: Record<AuthorId, string> = {
  lewis: 'Lewis Ludlam',
  matt: 'Matt Valetsky',
};

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
import * as sideHustleTax3000 from '@/content/blog/en/side-hustle-tax-3000-trading-allowance.mdx';
import * as taxOnVintedAndDepopSales from '@/content/blog/en/tax-on-vinted-and-depop-sales.mdx';
import * as vintedBump from '@/content/blog/en/vinted-bump-cost-and-does-it-work.mdx';
import * as vintedFeesUk from '@/content/blog/en/vinted-fees-uk.mdx';
import * as vintedParcelLostOrDamaged from '@/content/blog/en/vinted-parcel-lost-or-damaged.mdx';
import * as crosslistVintedToDepop from '@/content/blog/en/crosslist-vinted-to-depop.mdx';
import * as depopFeesUk from '@/content/blog/en/depop-fees-uk.mdx';
import * as depopRefunds from '@/content/blog/en/depop-refunds-not-as-described.mdx';
import * as doesVintedReportToHmrc from '@/content/blog/en/does-vinted-report-to-hmrc.mdx';
import * as moreSalesOnDepop from '@/content/blog/en/how-to-get-more-sales-on-depop.mdx';
import * as stopSellingTwice from '@/content/blog/en/stop-selling-same-item-twice.mdx';
import * as vintedAccountBanned from '@/content/blog/en/vinted-account-banned.mdx';
import * as vintedAlgorithm from '@/content/blog/en/vinted-algorithm-and-search.mdx';
import * as vintedItemsNotSelling from '@/content/blog/en/vinted-items-not-selling.mdx';
import * as vintedVsEbayUk from '@/content/blog/en/vinted-vs-ebay-uk.mdx';
import * as salelinxVsCrosslist from '@/content/blog/en/salelinx-vs-crosslist.mdx';
import * as salelinxVsListPerfectly from '@/content/blog/en/salelinx-vs-list-perfectly.mdx';
import * as salelinxVsVendoo from '@/content/blog/en/salelinx-vs-vendoo.mdx';

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
  sideHustleTax3000 as unknown as PostModule,
  taxOnVintedAndDepopSales as unknown as PostModule,
  vintedBump as unknown as PostModule,
  vintedFeesUk as unknown as PostModule,
  vintedParcelLostOrDamaged as unknown as PostModule,
  crosslistVintedToDepop as unknown as PostModule,
  depopFeesUk as unknown as PostModule,
  depopRefunds as unknown as PostModule,
  doesVintedReportToHmrc as unknown as PostModule,
  moreSalesOnDepop as unknown as PostModule,
  stopSellingTwice as unknown as PostModule,
  vintedAccountBanned as unknown as PostModule,
  vintedAlgorithm as unknown as PostModule,
  vintedItemsNotSelling as unknown as PostModule,
  vintedVsEbayUk as unknown as PostModule,
  salelinxVsCrosslist as unknown as PostModule,
  salelinxVsListPerfectly as unknown as PostModule,
  salelinxVsVendoo as unknown as PostModule,
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
