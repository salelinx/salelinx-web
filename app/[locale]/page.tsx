import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SITE_NAME, SITE_URL, absoluteUrl, pageMetadata } from '@/lib/site';
import { Hero } from '@/components/home/Hero';
import { MarketplaceStrip } from '@/components/home/MarketplaceStrip';
import { HowItWorks } from '@/components/home/HowItWorks';
import { FinalCta } from '@/components/home/FinalCta';
import { HeadlineFeatures } from '@/components/features/HeadlineFeatures';
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
        alternateName: brandAliases,
        url: SITE_URL,
        logo: `${SITE_URL}/salelinx-icon.png`,
        image: `${SITE_URL}/og.png`,
        email: 'hello@salelinx.com',
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        name: SITE_NAME,
        alternateName: brandAliases,
        url: SITE_URL,
        publisher: { '@id': orgId },
      },
      {
        '@type': 'SoftwareApplication',
        name: SITE_NAME,
        alternateName: brandAliases,
        description: tLayout('metaDescription'),
        url: absoluteUrl(locale, '/'),
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
          lowPrice: '7.99',
          highPrice: '24.99',
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
      <MarketplaceStrip />
      <div className="section-band">
        <HowItWorks />
      </div>
      <section id="features" className="mx-auto w-full max-w-7xl scroll-mt-20 px-6">
        <HeadlineFeatures />
      </section>
      <div className="section-band">
        <div className="mx-auto w-full max-w-7xl px-6">
          <PricingSection tiers={tiers} />
        </div>
      </div>
      <FinalCta />
    </main>
  );
}
