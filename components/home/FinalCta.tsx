import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Reveal } from '@/components/Reveal';

const MONO = 'font-mono text-[0.68rem] uppercase tracking-[0.14em]';

export async function FinalCta() {
  const t = await getTranslations('Home.finalCta');

  return (
    <section className="cta-band">
      <div className="mx-auto flex max-w-4xl flex-col items-center px-6 py-24 text-center sm:py-32">
        <Reveal delay={0}>
          <span
            className={`${MONO} inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-zinc-300 backdrop-blur`}
          >
            <span className="relative inline-flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            {t('eyebrow')}
          </span>
        </Reveal>

        <Reveal delay={120}>
          <h2 className="mt-6 max-w-3xl text-balance text-4xl font-semibold leading-[1.05] tracking-[-0.02em] text-white sm:text-5xl md:text-6xl">
            {t('title')}
          </h2>
        </Reveal>

        <Reveal delay={220}>
          <p className="mt-5 max-w-xl text-balance text-base leading-relaxed text-zinc-300 sm:text-lg">
            {t('body')}
          </p>
        </Reveal>

        <Reveal delay={320}>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/auth/signup"
              className="group relative inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-zinc-900 shadow-[0_1px_0_rgba(255,255,255,0.4)_inset,0_20px_60px_-20px_rgba(16,185,129,0.6)] transition hover:bg-zinc-100"
            >
              {t('primary')}
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
              className="inline-flex items-center rounded-full border border-white/15 bg-white/[0.04] px-6 py-3 text-sm font-medium text-white backdrop-blur transition hover:bg-white/[0.08]"
            >
              {t('secondary')}
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
