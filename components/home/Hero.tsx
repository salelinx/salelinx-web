import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Reveal } from "@/components/Reveal";
import { BrandWordmark } from "@/components/BrandWordmark";
import { InstallExtensionButton } from "@/components/InstallExtensionButton";
import { Logo3D } from "./Logo3D";
import { RollingPhrase } from "./RollingPhrase";

// Sizes chosen so each wordmark's cap-height optically matches the
// surrounding text. depop's viewBox is tight to letter bounds, so 0.85em
// reads roughly the same as a capital letter. Vinted's letters fill ~85%
// of its (cropped) viewBox so we go slightly larger.
const HERO_BRAND_TAGS = {
  depop: () => (
    <BrandWordmark
      brand="depop"
      variant="wordmark"
      height="0.85em"
      className="mx-[0.06em]"
    />
  ),
  vinted: () => (
    <BrandWordmark
      brand="vinted"
      variant="wordmark"
      height="1em"
      className="mx-[0.06em]"
    />
  ),
};

export async function Hero() {
  const t = await getTranslations("Home");

  // The hero holds the viewport on its own: it fills the screen below the
  // sticky header (72px) and centres the headline in it, so the fold ends
  // cleanly on the hero and the first scene starts just below it.
  //
  // This was 82svh for a while, deliberately trimmed so the crosslist scene
  // peeked in at the bottom edge: a full-height hero means nothing moves until
  // you have scrolled a whole viewport, and the peek was there to earn that
  // first scroll. It was reverted because of what actually peeked. The scene
  // is a two-column grid with items-center, so the tall panel column starts
  // higher than the centred copy, and the only thing above the fold was the
  // panel's two platform wordmarks floating with no heading near them. That
  // read as stray logos, not as a section worth scrolling to.
  //
  // The scroll cue is now carried by the arrow under the CTAs instead. If the
  // first-scroll rate drops, put the peek back by showing the scene's heading
  // rather than the top of its panel, not by trimming svh again.
  return (
    <section className="relative isolate flex min-h-[calc(100svh-72px)] flex-col items-center justify-center overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 [background-image:radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.05)_1px,transparent_1.5px)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,black,transparent)]" />
      </div>

      <div className="mx-auto flex max-w-5xl flex-col items-center px-6 py-10 text-center">
        <Reveal delay={0}>
          <Logo3D />
        </Reveal>

        <Reveal delay={80}>
          {/* Wider tracking than the site's other eyebrows: without a pill
              around it the line needs the extra air to read as a label
              rather than a stray sentence above the headline. */}
          <span className="mt-5 block font-mono text-sm uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
            {t("introducing")}
          </span>
        </Reveal>

        <Reveal delay={120}>
          <h1 className="mt-7 max-w-3xl text-balance text-[2.75rem] font-semibold leading-[1.02] tracking-[-0.03em] text-zinc-900 sm:text-6xl md:text-[4.5rem] dark:text-zinc-50">
            {t.rich("heroTitle", HERO_BRAND_TAGS)}
          </h1>
        </Reveal>

        <Reveal delay={220}>
          <p className="mt-6 max-w-xl text-balance text-base leading-relaxed text-zinc-600 sm:text-lg dark:text-zinc-400">
            {t.rich("heroSubtitle", {
              word: () => (
                <RollingPhrase words={t.raw("heroWords") as string[]} />
              ),
            })}
          </p>
        </Reveal>

        <Reveal delay={320}>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/auth/signup"
              className="group relative inline-flex items-center gap-2 rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white shadow-[0_1px_0_rgba(255,255,255,0.08)_inset,0_10px_30px_-12px_rgba(0,0,0,0.45)] transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
            >
              {t("ctaGetStarted")}
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
              label={t("ctaAddToChrome")}
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-black/10 bg-white/70 px-5 py-2.5 text-sm font-medium text-zinc-900 backdrop-blur transition hover:border-black/20 hover:bg-white dark:border-white/15 dark:bg-white/[0.04] dark:text-zinc-50 dark:hover:border-white/25 dark:hover:bg-white/[0.08]"
            />
          </div>
        </Reveal>
      </div>

      {/* The demo itself now lives in ScrollWorldDemo, mounted as its own
          section in page.tsx. It has to sit outside this element because the
          hero clips overflow, and a clipping ancestor kills position: sticky.
          This chevron is the handoff into it. */}
      <div className="flex justify-center px-6 pb-10">
        <Reveal delay={420}>
          <svg
            width="18"
            height="18"
            viewBox="0 0 14 14"
            fill="none"
            aria-hidden="true"
            className="hero-preview-arrow text-zinc-400 dark:text-zinc-500"
          >
            <path
              d="M7 3.5v6.5M4 7l3 3 3-3"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Reveal>
      </div>
    </section>
  );
}
