import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Reveal } from '@/components/Reveal';
import { InstallExtensionButton } from '@/components/InstallExtensionButton';

export async function FinalCta() {
  const t = await getTranslations('Home.finalCta');

  return (
    <section className="cta-band">
      {/* Top padding is smaller than the bottom on purpose: the section above
          already ends with its own 80px of padding, so a symmetric py- here
          left ~208px of dead space above the heading against 128px below it,
          pushing the whole block visibly low. These values even it up. */}
      <div className="mx-auto flex max-w-4xl flex-col items-center px-6 pt-6 pb-24 text-center sm:pt-12 sm:pb-32">
        <Reveal delay={0}>
          <h2 className="max-w-3xl text-balance text-4xl font-semibold leading-[1.05] tracking-[-0.02em] text-zinc-950 sm:text-5xl md:text-6xl dark:text-white">
            {t('title')}
          </h2>
        </Reveal>

        <Reveal delay={120}>
          <p className="mt-5 max-w-xl text-balance text-base leading-relaxed text-zinc-600 sm:text-lg dark:text-zinc-300">
            {t('body')}
          </p>
        </Reveal>

        <Reveal delay={220}>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/auth/signup"
              className="group relative inline-flex items-center gap-2 rounded-full bg-zinc-950 px-6 py-3 text-sm font-semibold text-white shadow-[0_1px_0_rgba(255,255,255,0.1)_inset,0_20px_60px_-20px_rgba(0,0,0,0.5)] transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:shadow-[0_1px_0_rgba(255,255,255,0.4)_inset,0_20px_60px_-20px_rgba(16,185,129,0.6)] dark:hover:bg-zinc-100"
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
              className="inline-flex items-center rounded-full border border-black/10 bg-white/70 px-6 py-3 text-sm font-medium text-zinc-900 backdrop-blur transition hover:bg-white dark:border-white/15 dark:bg-white/[0.04] dark:text-white dark:hover:bg-white/[0.08]"
            >
              {t('secondary')}
            </Link>
            <InstallExtensionButton
              label={t('tertiary')}
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-black/10 bg-white/70 px-6 py-3 text-sm font-medium text-zinc-900 backdrop-blur transition hover:border-black/20 hover:bg-white dark:border-white/15 dark:bg-white/[0.04] dark:text-zinc-50 dark:hover:border-white/25 dark:hover:bg-white/[0.08]"
            />
          </div>
        </Reveal>
      </div>
    </section>
  );
}
