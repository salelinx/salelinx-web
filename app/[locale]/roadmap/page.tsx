import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { RoadmapSection } from '@/components/features/RoadmapSection';
import { pageMetadata } from '@/lib/site';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Roadmap' });
  return pageMetadata({
    locale,
    path: '/roadmap',
    title: t('sectionHeader.title'),
    description: t('sectionHeader.body'),
  });
}

export default async function RoadmapPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main className="mx-auto w-full max-w-7xl px-6">
      <RoadmapSection standalone />
    </main>
  );
}
