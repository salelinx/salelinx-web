import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SITE_NAME, absoluteUrl } from '@/lib/site';
import { Hero } from '@/components/home/Hero';

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tLayout = await getTranslations('Layout');

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
    </main>
  );
}
