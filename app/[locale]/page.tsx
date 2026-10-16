import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import {
  CHROME_WEB_STORE_URL,
  SITE_NAME,
  SITE_URL,
  absoluteUrl,
  pageMetadata,
} from '@/lib/site';
import { TIER_PRICES } from '@/lib/pricing';
import { Hero } from '@/components/home/Hero';
import { ScrollWorldDemo } from '@/components/home/ScrollWorldDemo';
import { HomeFaq } from '@/components/home/HomeFaq';
import { FinalCta } from '@/components/home/FinalCta';
import { RoadmapSection } from '@/components/features/RoadmapSection';
import { PricingSection } from '@/components/features/PricingSection';
import { getCachedTierConfigs } from '@/lib/supabase/tier-config';

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Layout' });
  return pageMetadata({
    locale,
    path: '/',
    title: t('metaTitle'),
    description: t('metaDescription'),
    // The homepage title already carries the brand; skip the template.
    absoluteTitle: true,
  });
}

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [tLayout, tHome, tiers] = await Promise.all([
    getTranslations('Layout'),
    getTranslations('Home'),
    getCachedTierConfigs(),
  ]);

  // One @graph so the brand is a single connected entity rather than three
  // unrelated blobs: Organization is what search engines attach brand aliases
  // and imagery to, and the other nodes point back at it.
  const orgId = `${SITE_URL}/#organization`;
  // The domain only ever spells the brand closed-up, so "sale linx" as two
  // words has nothing to match against. alternateName is the supported way to
  // declare the spellings people actually type.
  const brandAliases = ['Sale Linx', 'Salelinx', 'sale linx'];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': orgId,
        name: SITE_NAME,
        legalName: 'SALELINX LTD',
        alternateName: brandAliases,
        url: SITE_URL,
        logo: `${SITE_URL}/salelinx-icon.png`,
        image: `${SITE_URL}/og.png`,
        email: 'hello@salelinx.com',
        // The store listing is the same entity as this site. Without sameAs
        // they are two unconnected things that happen to share a name, and
        // neither inherits the other's signals.
        sameAs: [CHROME_WEB_STORE_URL],
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        name: SITE_NAME,
        alternateName: brandAliases,
        url: SITE_URL,
        // The site itself is served in every routing locale. This is wider
        // than the SoftwareApplication list below on purpose: the extension
        // ships fewer languages than the website.
        inLanguage: [...routing.locales],
        publisher: { '@id': orgId },
      },
      {
        '@type': 'SoftwareApplication',
        '@id': `${SITE_URL}/#software`,
        name: SITE_NAME,
        alternateName: brandAliases,
        description: tLayout('metaDescription'),
        url: absoluteUrl(locale, '/'),
        // Where it is installed from. This is the field that says "browser
        // extension, get it here" rather than leaving engines to infer a
        // product page, and it points at the same URL as Organization.sameAs.
        installUrl: CHROME_WEB_STORE_URL,
        downloadUrl: CHROME_WEB_STORE_URL,
        applicationSubCategory: 'Browser Extension',
        browserRequirements: 'Requires Google Chrome',
        // The languages the extension ships in (its _locales dirs), NOT the
        // website's six routing locales; ar/zh are website-only.
        inLanguage: ['en', 'fr', 'es', 'de'],
        featureList: [
          'Crosslist between Vinted, Depop and eBay',
          'Manage and edit eBay listings',
          'Bulk relist and refresh listings',
          'Scheduled price drops',
          'Dead stock detection',
          'Restock tracking across Depop, Vinted and eBay',
          'Send offers to likers and auto-accept offers',
          'Bulk listing and photo editor',
          'Shipping labels merged into one PDF',
        ],
        // Name the brand image explicitly. Without this the only images Google
        // could associate with the page were the product photos in the hero
        // preview, so it picked one (the star beanie) as the search thumbnail.
        image: `${SITE_URL}/og.png`,
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Chrome',
        publisher: { '@id': orgId },
        offers: {
          '@type': 'AggregateOffer',
          priceCurrency: 'GBP',
          // Read from the price table rather than repeated here: a hardcoded
          // copy silently goes stale the first time pricing changes, and stale
          // price markup is worse than none.
          lowPrice: TIER_PRICES.starter.gbp.replace(/[^0-9.]/g, ''),
          highPrice: TIER_PRICES.business.gbp.replace(/[^0-9.]/g, ''),
          offerCount: 3,
          url: absoluteUrl(locale, '/features'),
        },
      },
    ],
  };

  return (
    <main className="flex flex-1 flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Hero />
      <ScrollWorldDemo />
      {/* The HeadlineFeatures block used to sit here. The feature carousel
          above covers the same ground, so this was saying it twice. */}
      <div className="section-band">
        <div className="mx-auto w-full max-w-7xl px-6">
          <PricingSection tiers={tiers} eyebrow={tHome('pricingEyebrow')} centered />
        </div>
      </div>
      {/* FAQ after the closing CTA rather than before it: the CTA lands
          straight after pricing, and the questions are there for anyone
          still deciding. */}
      <FinalCta />
      <HomeFaq />
      {/* Roadmap closes the page, under the FAQ, like pricing above it. Nav
          links go to the /roadmap page instead (real URLs for sitelinks);
          both render the same cards from roadmap_items. */}
      <div className="mx-auto w-full max-w-7xl px-6">
        <RoadmapSection />
      </div>
    </main>
  );
}
