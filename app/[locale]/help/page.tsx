import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { SupportCard } from '@/components/docs/SupportCard';
import { Icon, type IconName } from '@/components/Icon';
import { pageMetadata } from '@/lib/site';

const MONO = 'font-mono text-[0.68rem] uppercase tracking-[0.12em]';

const CARDS: Array<{ key: 'faq' | 'docs' | 'status'; href: string; icon: IconName }> = [
  { key: 'faq', href: '/help/faq', icon: 'message' },
  { key: 'docs', href: '/docs', icon: 'book' },
  { key: 'status', href: '/docs/status', icon: 'circle' },
];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Help' });
  return pageMetadata({
    locale,
    path: '/help',
    title: t('metaTitle'),
    description: t('metaDescription'),
  });
}

export default async function HelpPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Help');

  return (
    <main className="mx-auto w-full max-w-4xl px-6">
      <section className="pt-20 pb-10 sm:pt-24">
        <span className={`${MONO} text-zinc-500`}>{t('eyebrow')}</span>
        <h1 className="mt-6 max-w-3xl text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
          {t('title')}
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
          {t('body')}
        </p>
      </section>

      <section className="pb-12">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {CARDS.map((card) => (
            <Link
              key={card.key}
              href={card.href}
              className="group flex flex-col gap-3 rounded-xl border border-black/10 bg-white p-5 transition hover:border-black/30 dark:border-white/15 dark:bg-zinc-950 dark:hover:border-white/40"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-black/10 text-zinc-700 dark:border-white/10 dark:text-zinc-200">
                <Icon name={card.icon} className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-base font-semibold tracking-tight">
                  {t(`${card.key}CardTitle`)}
                </h2>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  {t(`${card.key}CardBody`)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="border-t border-black/10 py-16 dark:border-white/10">
        <SupportCard />
      </section>
    </main>
  );
}
