import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { pageMetadata } from '@/lib/site';

// Referral landing page - where /r/{code} sends a referred visitor after
// setting the slx_ref attribution cookie. Explains the deal they were
// promised (discounted first month) instead of dropping them on /features
// with no context. The discount itself is applied automatically at checkout
// via the cookie (see docs/REFERRALS.md), so this page has no client logic.

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Invited' });
  return pageMetadata({
    locale,
    path: '/invited',
    title: t('metaTitle'),
    description: t('metaDescription'),
  });
}

const MONO = 'font-mono text-[0.68rem] uppercase tracking-[0.12em]';

export default async function InvitedPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Invited');

  const steps = [
    { num: '1', text: t('step1') },
    { num: '2', text: t('step2') },
    { num: '3', text: t('step3') },
  ];

  return (
    <main>
      <section className="mx-auto w-full max-w-7xl px-6 pt-10 pb-16 text-center sm:pt-14">
        <span className={`${MONO} text-zinc-500`}>{t('eyebrow')}</span>
        <h1 className="mx-auto mt-6 max-w-4xl text-5xl font-semibold leading-[1.02] tracking-tight sm:text-6xl">
          {t('title')}
        </h1>
        <p className="mx-auto mt-8 max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
          {t('description')}
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/auth/signup"
            className="rounded-full bg-black px-6 py-3 text-sm font-medium text-white dark:bg-white dark:text-black"
          >
            {t('claimCta')}
          </Link>
          <Link
            href="/features"
            className="rounded-full border border-black/10 px-6 py-3 text-sm font-medium dark:border-white/20"
          >
            {t('exploreCta')}
          </Link>
        </div>
        <p className="mt-6 text-sm text-zinc-500">{t('note')}</p>
      </section>

      <section className="mx-auto w-full max-w-4xl px-6 pb-24">
        <div className="grid gap-4 sm:grid-cols-3">
          {steps.map((step) => (
            <div
              key={step.num}
              className="rounded-2xl border border-black/10 p-6 text-left dark:border-white/10"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black text-sm font-semibold text-white dark:bg-white dark:text-black">
                {step.num}
              </span>
              <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
                {step.text}
              </p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
