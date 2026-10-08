import { getLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Reveal } from '@/components/Reveal';
import { getAllFAQItems } from '@/lib/faq';
import type { Locale } from '@/lib/i18n/locales';

const IDS = [
  'free-trial',
  'how-do-i-install',
  'which-browsers',
  'store-marketplace-password',
  'where-is-my-data',
  'how-to-cancel',
];

const MONO = 'font-mono text-[0.68rem] uppercase tracking-[0.12em]';

// Decorative question bubbles drifting in the gutters. x/y are % of the section,
// s is the width in px, d the animation delay in seconds; `wide` hides it on phones.
const BUBBLES = [
  { x: 6, y: 14, s: 76, d: 0, tilt: -8 },
  { x: 14, y: 58, s: 52, d: -3.2, tilt: 6, wide: true },
  { x: 4, y: 82, s: 60, d: -5.1, tilt: -4, wide: true },
  { x: 86, y: 10, s: 58, d: -1.6, tilt: 7 },
  { x: 90, y: 46, s: 84, d: -4.4, tilt: -6, wide: true },
  { x: 81, y: 78, s: 50, d: -2.5, tilt: 5, wide: true },
];

function QuestionBubble({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 64 58" width={size} height={(size * 58) / 64} aria-hidden="true">
      <path
        d="M14 1h36a13 13 0 0 1 13 13v18a13 13 0 0 1-13 13H26l-11 11v-11h-1A13 13 0 0 1 1 32V14A13 13 0 0 1 14 1z"
        className="fill-white/80 stroke-black/[0.08] dark:fill-zinc-900/80 dark:stroke-white/10"
        strokeWidth="1.5"
      />
      <text
        x="32"
        y="31"
        textAnchor="middle"
        dominantBaseline="middle"
        className="fill-zinc-400 dark:fill-zinc-500"
        style={{ font: '600 24px var(--font-sans, system-ui)' }}
      >
        ?
      </text>
    </svg>
  );
}

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
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {BUBBLES.map((b, i) => (
          <div
            key={i}
            className={`faq-bubble absolute drop-shadow-[0_8px_20px_rgb(0_0_0/0.06)] ${b.wide ? 'hidden lg:block' : 'hidden sm:block'}`}
            style={{ left: `${b.x}%`, top: `${b.y}%`, animationDelay: `${b.d}s`, rotate: `${b.tilt}deg` }}
          >
            <QuestionBubble size={b.s} />
          </div>
        ))}
      </div>
      <div className="relative mx-auto w-full max-w-3xl px-6 py-14 sm:py-20">
      <Reveal as="div" className="pb-10 text-center">
        <span className={`${MONO} text-zinc-600 dark:text-zinc-400`}>{t('eyebrow')}</span>
        <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl dark:text-zinc-50">
          {t('title')}
        </h2>
      </Reveal>

      <ul className="divide-y divide-black/10 overflow-hidden rounded-xl border border-black/10 dark:divide-white/10 dark:border-white/10">
        {items.map((item) => (
          <li key={item.id}>
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 bg-white px-5 py-4 transition hover:bg-black/[0.03] dark:bg-zinc-950 dark:hover:bg-white/[0.03] [&::-webkit-details-marker]:hidden">
                <span className="font-medium" dangerouslySetInnerHTML={{ __html: item.q }} />
                <span className="shrink-0 text-zinc-500 transition group-open:rotate-45" aria-hidden>
                  +
                </span>
              </summary>
              <div className="bg-black/[0.02] px-5 py-5 text-sm leading-relaxed text-zinc-700 dark:bg-white/[0.02] dark:text-zinc-300">
                {item.a}
              </div>
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
    </section>
  );
}
