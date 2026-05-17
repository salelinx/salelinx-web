import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SITE_NAME, absoluteUrl } from '@/lib/site';
import { Hero } from '@/components/home/Hero';
import { HowItWorks } from '@/components/home/HowItWorks';
import { HeadlineFeatures } from '@/components/features/HeadlineFeatures';
import { PricingSection } from '@/components/features/PricingSection';
import { getTierConfigs } from '@/lib/supabase/tier-config';

export const revalidate = 60;

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [tLayout, tiers] = await Promise.all([
    getTranslations('Layout'),
    getTierConfigs(),
  ]);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: SITE_NAME,
    description: tLayout('metaDescription'),
    url: absoluteUrl(locale, '/'),
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Chrome',
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'GBP',
      lowPrice: '7.99',
      highPrice: '29.99',
    },
  };

  return (
    <main className="flex flex-1 flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Hero />
      <HowItWorks />
      <section id="features" className="mx-auto w-full max-w-7xl scroll-mt-20 px-6">
        <HeadlineFeatures />
      </section>
      <div className="mx-auto w-full max-w-7xl px-6">
        <PricingSection tiers={tiers} />
      </div>
    </main>
  );
}
