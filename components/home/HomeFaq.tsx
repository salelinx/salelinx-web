import { getLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Reveal } from '@/components/Reveal';
import { getAllFAQItems } from '@/lib/faq';
import type { Locale } from '@/lib/i18n/locales';
import { FaqClouds } from './FaqClouds';

const IDS = [
  'free-trial',
  'how-do-i-install',
  'which-browsers',
  'store-marketplace-password',
  'where-is-my-data',
  'how-to-cancel',
];

const MONO = 'font-mono text-[0.68rem] uppercase tracking-[0.12em]';
const LIST =
  'divide-y divide-black/10 overflow-hidden rounded-xl border border-black/10 dark:divide-white/10 dark:border-white/10';
const ROW = 'flex items-center justify-between gap-6 px-5 py-4';
const ANSWER =
  'bg-black/[0.02] px-5 py-5 text-sm leading-relaxed text-zinc-700 dark:bg-white/[0.02] dark:text-zinc-300';

export async function HomeFaq() {
  const [t, tHome, locale] = await Promise.all([
    getTranslations('Faq'),
    getTranslations('Home'),
    getLocale(),
  ]);
  const all = getAllFAQItems(locale as Locale);
  const items = IDS.flatMap((id) => all.filter((item) => item.id === id));

  return (
    <section id="faq" className="relative overflow-hidden">
      <FaqClouds />
      <div className="relative mx-auto w-full max-w-3xl px-6 py-14 sm:py-20">
      <Reveal as="div" className="pb-10 text-center">
        <span className={`${MONO} text-zinc-600 dark:text-zinc-400`}>{t('eyebrow')}</span>
        <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl dark:text-zinc-50">
          {t('title')}
        </h2>
      </Reveal>

      {/* One answer open at a time, and an invisible copy holding room for the
          longest one, so opening a question never moves the page below. */}
      <div className="grid">
        <div aria-hidden inert className="invisible [grid-area:1/1]">
          <div className={LIST}>
            {items.map((item) => (
              <div key={item.id} className={ROW}>
                <span className="font-medium" dangerouslySetInnerHTML={{ __html: item.q }} />
                <span className="shrink-0">+</span>
              </div>
            ))}
            <div className="grid">
              {items.map((item) => (
                <div key={item.id} className={`${ANSWER} [grid-area:1/1]`}>
                  {item.a}
                </div>
              ))}
            </div>
          </div>
          <p className="mt-8">
            <span className="text-sm">&nbsp;</span>
          </p>
        </div>

        <div className="self-start [grid-area:1/1]">
          <ul className={LIST}>
            {items.map((item) => (
              <li key={item.id}>
                <details name="home-faq" className="group disclosure faq-disclosure">
                  <summary
                    className={`${ROW} cursor-pointer list-none bg-white transition hover:bg-black/[0.03] dark:bg-zinc-950 dark:hover:bg-white/[0.03] [&::-webkit-details-marker]:hidden`}
                  >
                    <span className="font-medium" dangerouslySetInnerHTML={{ __html: item.q }} />
                    <span className="shrink-0 text-zinc-500 transition group-open:rotate-45" aria-hidden>
                      +
                    </span>
                  </summary>
                  <div className={ANSWER}>{item.a}</div>
                </details>
              </li>
            ))}
          </ul>

          <p className="mt-8 text-center">
            <Link href="/help/faq" className="text-sm font-medium underline underline-offset-4">
              {tHome('faqMore')}
            </Link>
          </p>
        </div>
      </div>
      </div>
    </section>
  );
}
