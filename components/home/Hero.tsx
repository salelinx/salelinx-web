import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Reveal } from '@/components/Reveal';
import { BrandWordmark } from '@/components/BrandWordmark';
import { InstallExtensionButton } from '@/components/InstallExtensionButton';
import { HeroPreview } from './HeroPreview';

// Sizes chosen so each wordmark's cap-height optically matches the
// surrounding text. depop's viewBox is tight to letter bounds, so 0.85em
// reads roughly the same as a capital letter. Vinted's letters fill ~85%
// of its (cropped) viewBox so we go slightly larger.
const HERO_BRAND_TAGS = {
  depop: () => (
    <BrandWordmark brand="depop" variant="wordmark" height="0.85em" className="mx-[0.06em]" />
  ),
  vinted: () => (
    <BrandWordmark brand="vinted" variant="wordmark" height="1em" className="mx-[0.06em]" />
  ),
};

export async function Hero() {
  const t = await getTranslations('Home');

  return (
    <section className="relative isolate overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 [background-image:radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.05)_1px,transparent_1.5px)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,black,transparent)]" />
      </div>

      <div className="mx-auto flex max-w-5xl flex-col items-center px-6 pt-20 pb-6 text-center sm:pt-28">
        <Reveal delay={0}>
          <h1 className="max-w-4xl text-balance text-[2.75rem] font-extrabold leading-[1.04] tracking-[-0.035em] text-zinc-950 sm:text-6xl md:text-[4.5rem] dark:text-zinc-50">
            {t.rich('heroTitle', HERO_BRAND_TAGS)}
          </h1>
        </Reveal>

        <Reveal delay={200}>
          <div className="mt-12 flex flex-wrap items-center justify-center gap-3 sm:mt-14">
            <Link
              href="/auth/signup"
              className="group relative inline-flex items-center gap-2 rounded-2xl bg-zinc-950 px-7 py-3.5 text-base font-semibold text-white shadow-[0_1px_0_rgba(255,255,255,0.1)_inset,0_14px_36px_-14px_rgba(0,0,0,0.5)] transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
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
            <InstallExtensionButton
              label={t('ctaAddToChrome')}
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-2xl border border-black/10 bg-white/70 px-6 py-3.5 text-base font-medium text-zinc-900 backdrop-blur transition hover:bg-white dark:border-white/15 dark:bg-white/[0.04] dark:text-zinc-50 dark:hover:bg-white/[0.08]"
            />
          </div>
        </Reveal>
      </div>

      <div className="mx-auto max-w-5xl px-6 pb-28 pt-16 sm:pt-20">
        <Reveal delay={350} pop className="hero-preview-reveal light">
          <HeroPreview />
        </Reveal>
      </div>
    </section>
  );
}
