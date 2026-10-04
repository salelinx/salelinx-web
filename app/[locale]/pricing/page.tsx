import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PricingSection } from '@/components/features/PricingSection';
import { getCachedTierConfigs } from '@/lib/supabase/tier-config';
import { pageMetadata } from '@/lib/site';

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Pricing' });
  return pageMetadata({
    locale,
    path: '/pricing',
    title: t('sectionHeader.title'),
    description: t('sectionHeader.body'),
  });
}

export default async function PricingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tiers = await getCachedTierConfigs();

  return (
    <main className="mx-auto w-full max-w-7xl px-6">
      <PricingSection tiers={tiers} standalone />
    </main>
  );
}
