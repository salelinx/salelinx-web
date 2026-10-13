import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { FeaturesSection } from '@/components/features/FeaturesSection';
import { PanelCarousel } from '@/components/home/PanelCarousel';
import { FinalCta } from '@/components/home/FinalCta';
import { Reveal } from '@/components/Reveal';
import { pageMetadata } from '@/lib/site';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Features' });
  return pageMetadata({
    locale,
    path: '/features',
    title: t('metaTitle'),
    description: t('metaDescription'),
  });
}

export default async function FeaturesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Features');

  return (
    <main className="mx-auto w-full max-w-7xl px-6">
      <Reveal>
        <h1 className="mx-auto max-w-3xl pt-10 pb-8 text-center text-4xl font-semibold leading-[1.05] tracking-tight text-balance sm:pt-12 sm:text-5xl">
          {t('hero.title')}
        </h1>
      </Reveal>
      <Reveal delay={150} className="mx-auto w-full max-w-4xl">
        <PanelCarousel />
      </Reveal>
      <FeaturesSection />
      <FinalCta title={t('finalCta.title')} body={t('finalCta.body')} />
    </main>
  );
}
