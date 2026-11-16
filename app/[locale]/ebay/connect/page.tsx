import type { Metadata } from 'next';
import { Suspense } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { pageMetadata } from '@/lib/site';
import { EbayConnect } from '@/components/EbayConnect';

// Connecting an eBay account on the website, with the seller's own SaleLinx login: the Shopify
// app's page in a store's admin opens it, and eBay's sign-in comes back to it (EBAY_RUNAME_WEB's
// accept URL, with code and state; its declined URL adds declined=1). See docs/EDGE-FUNCTIONS.md
// "eBay".

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'EbayConnect' });
  return {
    ...pageMetadata({ locale, path: '/ebay/connect', title: t('metaTitle') }),
    robots: { index: false, follow: false },
  };
}

export default async function EbayConnectPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('EbayConnect');

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-xl flex-col items-center justify-center px-6 py-16 text-center">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t('title')}</h1>
      {/* useSearchParams needs a Suspense boundary or the route opts out of static rendering. */}
      <Suspense>
        <EbayConnect />
      </Suspense>
    </main>
  );
}
