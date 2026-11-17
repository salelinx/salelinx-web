import type { Metadata } from 'next';
import { Suspense } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { pageMetadata } from '@/lib/site';
import { ShopifyConnect } from '@/components/ShopifyConnect';

// Where the Shopify app's Connect button lands (through shopify-public's /connect), with the code
// the app's page made for the store. A signed-in seller connects the store to their account here;
// the extension does the same itself when it is signed in. See docs/EDGE-FUNCTIONS.md "Shopify".

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'ShopifyConnect' });
  return {
    ...pageMetadata({ locale, path: '/shopify/connect', title: t('metaTitle') }),
    robots: { index: false, follow: false },
  };
}

export default async function ShopifyConnectPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('ShopifyConnect');

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-xl flex-col items-center justify-center px-6 py-16 text-center">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t('title')}</h1>
      {/* useSearchParams needs a Suspense boundary or the route opts out of static rendering. */}
      <Suspense>
        <ShopifyConnect />
      </Suspense>
    </main>
  );
}
