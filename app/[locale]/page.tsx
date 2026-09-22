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
import { HowItWorks } from '@/components/home/HowItWorks';
import { FinalCta } from '@/components/home/FinalCta';
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
  const [tLayout, tiers] = await Promise.all([
    getTranslations('Layout'),
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
          'Crosslist between Depop and Vinted',
          'Bulk relist and refresh listings',
          'Scheduled price drops',
          'Restock tracking across both marketplaces',
          'Send and auto-accept offers',
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
      <div className="section-band">
        <HowItWorks />
      </div>
      {/* The HeadlineFeatures block used to sit here. The scroll section above
          now covers the same ground (and closes on a grid of every feature),
          so this was saying it twice. The `#features` anchor the header and
          mobile menu link to moved onto ScrollWorldDemo with it.
          HeadlineFeatures itself is still used by the /features page. */}
      <div className="section-band">
        <div className="mx-auto w-full max-w-7xl px-6">
          <PricingSection tiers={tiers} />
        </div>
      </div>
      <FinalCta />
    </main>
  );
}
