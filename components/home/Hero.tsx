import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Reveal } from '@/components/Reveal';
import { HeroPreview } from './HeroPreview';

export async function Hero() {
  const t = await getTranslations('Home');

  return (
    <section className="relative isolate overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[6%] h-[560px] w-[920px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,_rgba(16,185,129,0.12),_transparent_70%)] blur-2xl dark:bg-[radial-gradient(ellipse_at_center,_rgba(16,185,129,0.18),_transparent_70%)]" />
        <div className="absolute inset-0 opacity-[0.35] [background-image:radial-gradient(circle_at_1px_1px,rgba(0,0,0,0.16)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_at_50%_35%,black_15%,transparent_70%)] dark:opacity-[0.22] dark:[background-image:radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.18)_1px,transparent_1px)]" />
      </div>

      <div className="mx-auto flex max-w-5xl flex-col items-center px-6 pt-20 pb-10 text-center sm:pt-28">
        <Reveal delay={0}>
          <span className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/70 px-3 py-1.5 font-mono text-[0.68rem] uppercase tracking-[0.12em] text-zinc-700 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset] backdrop-blur dark:border-white/15 dark:bg-white/[0.04] dark:text-zinc-300 dark:shadow-[0_1px_0_rgba(255,255,255,0.04)_inset]">
            <span className="relative inline-flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            {t('heroEyebrow')}
          </span>
        </Reveal>

        <Reveal delay={120}>
          <h1 className="mt-7 max-w-3xl text-balance text-[2.75rem] font-medium leading-[1.02] tracking-[-0.03em] text-zinc-900 sm:text-6xl md:text-[4.5rem] dark:text-zinc-50">
            {t('heroTitle')}
          </h1>
        </Reveal>

        <Reveal delay={220}>
          <p className="mt-6 max-w-xl text-balance text-base leading-relaxed text-zinc-600 sm:text-lg dark:text-zinc-400">
            {t('heroSubtitle')}
          </p>
        </Reveal>

        <Reveal delay={320}>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/auth/signup"
              className="group relative inline-flex items-center gap-2 rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white shadow-[0_1px_0_rgba(255,255,255,0.08)_inset,0_10px_30px_-12px_rgba(0,0,0,0.45)] transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
            >
              {t('ctaGetStarted')}
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                aria-hidden="true"
                className="transition-transform duration-200 group-hover:translate-x-0.5"
              >
                <path
                  d="M5.5 3.5L9 7l-3.5 3.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
            <Link
              href="/features#pricing"
              className="inline-flex items-center rounded-full border border-black/10 bg-white/60 px-5 py-2.5 text-sm font-medium text-zinc-900 backdrop-blur transition hover:bg-white dark:border-white/15 dark:bg-white/[0.04] dark:text-zinc-50 dark:hover:bg-white/[0.08]"
            >
              {t('ctaSeePricing')}
            </Link>
          </div>
        </Reveal>
      </div>

      <div className="mx-auto max-w-5xl px-6 pb-24">
        <Reveal delay={450} pop>
          <HeroPreview />
        </Reveal>
      </div>
    </section>
  );
}
