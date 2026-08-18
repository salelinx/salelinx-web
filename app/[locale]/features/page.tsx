import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { FeaturesSection } from '@/components/features/FeaturesSection';
import { PricingSection } from '@/components/features/PricingSection';
import { RoadmapSection } from '@/components/features/RoadmapSection';
import { getCachedTierConfigs } from '@/lib/supabase/tier-config';
import { pageMetadata } from '@/lib/site';

export const revalidate = 60;

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

const MONO = 'font-mono text-[0.68rem] uppercase tracking-[0.12em]';

export default async function FeaturesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, tiers] = await Promise.all([
    getTranslations('Features'),
    getCachedTierConfigs(),
  ]);

  return (
    <main>
      <section className="mx-auto w-full max-w-7xl px-6 pt-20 pb-20 text-center sm:pt-28 sm:pb-24">
        <span className={`${MONO} text-zinc-500`}>{t('hero.eyebrow')}</span>
        <h1 className="mx-auto mt-6 max-w-5xl text-5xl font-semibold leading-[1.02] tracking-tight sm:text-7xl">
          {t('hero.title')}
        </h1>
        <p className="mx-auto mt-8 max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
          {t('hero.description')}
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/auth/signup"
            className="rounded-full bg-black px-6 py-3 text-sm font-medium text-white dark:bg-white dark:text-black"
          >
            {t('hero.installExtension')}
          </Link>
          <a
            href="#pricing"
            className="rounded-full border border-black/10 px-6 py-3 text-sm font-medium dark:border-white/20"
          >
            {t('hero.seePricing')}
          </a>
        </div>
      </section>

      <div className="mx-auto w-full max-w-7xl px-6">
        <FeaturesSection />
        <PricingSection tiers={tiers} />
        <RoadmapSection />

        <section className="border-t border-black/10 py-24 text-center dark:border-white/10">
          <span className={`${MONO} text-zinc-500`}>{t('ctaSection.eyebrow')}</span>
          <h2 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
            {t('ctaSection.title')}
          </h2>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/auth/signup"
              className="rounded-full bg-black px-6 py-3 text-sm font-medium text-white dark:bg-white dark:text-black"
            >
              {t('ctaSection.getStarted')}
            </Link>
            <a
              href="#pricing"
              className="rounded-full border border-black/10 px-6 py-3 text-sm font-medium dark:border-white/20"
            >
              {t('ctaSection.seePricing')}
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
