import type { CSSProperties } from 'react';
import { getTranslations } from 'next-intl/server';
import { Icon, type IconName } from '@/components/Icon';
import { Reveal } from '@/components/Reveal';

type StepId = 'install' | 'link' | 'crosslist';

type Step = {
  id: StepId;
  number: string;
  icon: IconName;
  accent: {
    text: string;
    glow: string;
    bar: string;
  };
};

const STEPS: Step[] = [
  {
    id: 'install',
    number: '01',
    icon: 'puzzle',
    accent: {
      text: 'text-amber-500 dark:text-amber-400',
      glow: 'bg-amber-500/10 dark:bg-amber-400/15',
      bar: 'from-amber-400/70 via-amber-500/40 to-transparent',
    },
  },
  {
    id: 'link',
    number: '02',
    icon: 'link',
    accent: {
      text: 'text-violet-500 dark:text-violet-400',
      glow: 'bg-violet-500/10 dark:bg-violet-400/15',
      bar: 'from-violet-400/70 via-violet-500/40 to-transparent',
    },
  },
  {
    id: 'crosslist',
    number: '03',
    icon: 'swap',
    accent: {
      text: 'text-emerald-500 dark:text-emerald-400',
      glow: 'bg-emerald-500/10 dark:bg-emerald-400/15',
      bar: 'from-emerald-400/70 via-emerald-500/40 to-transparent',
    },
  },
];

const MONO = 'font-mono text-[0.68rem] uppercase tracking-[0.12em]';

export async function HowItWorks() {
  const t = await getTranslations('Home.howItWorks');

  return (
    <section className="mx-auto w-full max-w-5xl px-6 py-24 sm:py-32">
      <Reveal as="div" className="pb-12 text-center">
        <span className={`${MONO} text-zinc-500`}>{t('eyebrow')}</span>
        <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl dark:text-zinc-50">
          {t('title')}
        </h2>
        <p className="mx-auto mt-4 max-w-md text-balance text-base text-zinc-600 dark:text-zinc-400">
          {t('body')}
        </p>
      </Reveal>

      <Reveal as="ul" className="cascade-list grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
        {STEPS.map((step, idx) => (
          <li
            key={step.id}
            className="cascade-item"
            style={
              {
                '--stagger-delay': `${idx * 120}ms`,
              } as CSSProperties
            }
          >
            <article className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-black/[0.08] bg-white/40 p-6 dark:border-white/[0.08] dark:bg-white/[0.02]">
              <div
                className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r ${step.accent.bar}`}
                aria-hidden
              />

              <div className="flex items-center justify-between">
                <span
                  className={`font-mono text-3xl font-semibold leading-none tracking-tight tabular-nums ${step.accent.text}`}
                  aria-hidden
                >
                  {step.number}
                </span>
                <span
                  className={`relative flex h-10 w-10 items-center justify-center rounded-xl text-zinc-700 dark:text-zinc-200`}
                >
                  <span
                    className={`absolute inset-0 rounded-xl ${step.accent.glow}`}
                    aria-hidden
                  />
                  <span className="relative">
                    <Icon name={step.icon} />
                  </span>
                </span>
              </div>

              <h3 className="mt-6 text-lg font-semibold tracking-tight text-zinc-900 sm:text-xl dark:text-zinc-50">
                {t(`steps.${step.id}.title`)}
              </h3>
              <p className="mt-2 text-[0.95rem] leading-relaxed text-zinc-600 dark:text-zinc-400">
                {t(`steps.${step.id}.body`)}
              </p>
            </article>
          </li>
        ))}
      </Reveal>
    </section>
  );
}
