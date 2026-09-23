'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';

/**
 * Real screenshots of the extension panel, one per tab.
 *
 * Built on CSS scroll-snap rather than a carousel library: swipe, momentum,
 * keyboard scrolling and RTL all come free from the platform, and the slides
 * stay in the DOM so they are findable and linkable. The buttons only scroll
 * the container; nothing is hidden behind JS.
 *
 * Slides are narrower than the track on purpose. The sliver of the next slide
 * is what tells someone there is more than one without needing a hint, and it
 * is the difference between this reading as a carousel and reading as a
 * screenshot with some buttons under it.
 *
 * Tab labels reuse `Home.preview.tabs`, already translated in all six locales.
 */

type Slide = { file: string; labelKey: string };

const SLIDES: Slide[] = [
  { file: '01-crosslist.png', labelKey: 'crosslist' },
  { file: '02-my-listings.png', labelKey: 'listings' },
  { file: '03-restocker.png', labelKey: 'restocker' },
  { file: '04-shop-designer.png', labelKey: 'shopDesigner' },
  { file: '05-grow.png', labelKey: 'followBot' },
  { file: '06-messages.png', labelKey: 'conversations' },
];

/** Intrinsic size of the captures, for aspect ratio and next/image sizing. */
const W = 2940;
const H = 1604;

export function PanelCarousel({ className = '' }: { className?: string }) {
  const t = useTranslations('Home.preview.tabs');
  const tc = useTranslations('Home.panelCarousel');
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const goTo = useCallback((i: number) => {
    const track = trackRef.current;
    const slide = track?.children[i] as HTMLElement | undefined;
    if (!track || !slide) return;
    // Honour the OS setting: an instant jump is the correct reduced-motion
    // answer here, not a slower animation.
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // scrollIntoView rather than arithmetic on offsetLeft: it is correct in
    // RTL, where the track's scroll origin is on the right.
    slide.scrollIntoView({
      behavior: reduced ? 'auto' : 'smooth',
      block: 'nearest',
      inline: 'center',
    });
  }, []);

  const step = useCallback(
    (delta: number) => goTo(Math.min(SLIDES.length - 1, Math.max(0, active + delta))),
    [active, goTo],
  );

  // Track which slide is centred so the controls reflect swipes and keyboard
  // scrolling, not just clicks. IntersectionObserver rather than a scroll
  // handler so it costs nothing while idle.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            const i = Array.prototype.indexOf.call(track.children, e.target);
            if (i !== -1) setActive(i);
          }
        }
      },
      { root: track, threshold: 0.6 },
    );
    for (const child of Array.from(track.children)) io.observe(child);
    return () => io.disconnect();
  }, []);

  return (
    <section className={className} aria-labelledby="panel-carousel-title">
      <div className="text-center">
        <h2
          id="panel-carousel-title"
          className="text-3xl font-semibold tracking-tight sm:text-4xl"
        >
          {tc('title')}
        </h2>
        <p className="mt-3 text-base text-zinc-600 dark:text-zinc-400">{tc('subtitle')}</p>
      </div>

      <div
        className="relative mt-10"
        role="group"
        aria-roledescription="carousel"
        aria-label={tc('title')}
      >
        <div
          ref={trackRef}
          tabIndex={0}
          className="flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth px-[6%] py-2
                     [scrollbar-width:none] [&::-webkit-scrollbar]:hidden
                     focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4
                     focus-visible:outline-emerald-600"
        >
          {SLIDES.map((s, i) => (
            <div
              key={s.file}
              id={`panel-slide-${i}`}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} / ${SLIDES.length}: ${t(s.labelKey)}`}
              className="w-[88%] shrink-0 snap-center"
            >
              <Image
                src={`/panel/${s.file}`}
                alt={t(s.labelKey)}
                width={W}
                height={H}
                /* No priority: this sits below the fold at both mount points,
                   and preloading it only steals bandwidth from the real LCP
                   element. */
                loading="lazy"
                /* Above next/image's default 75. These are UI screenshots
                   full of 11px text and thin borders, and 75 visibly softens
                   them in a way it never would on a photograph. */
                quality={90}
                sizes="(max-width: 640px) 88vw, (max-width: 1024px) 80vw, 900px"
                className={`w-full rounded-xl border border-black/10 shadow-lg transition-opacity
                            duration-300 dark:border-white/10 ${
                              active === i ? 'opacity-100' : 'opacity-60'
                            }`}
              />
            </div>
          ))}
        </div>

        {/* Arrows sit over the peeking neighbours. Hidden from assistive tech:
            the labelled buttons below do the same job without relying on
            direction, which is ambiguous in RTL anyway. */}
        <button
          type="button"
          onClick={() => step(-1)}
          disabled={active === 0}
          aria-hidden="true"
          tabIndex={-1}
          className="absolute start-1 top-1/2 hidden -translate-y-1/2 rounded-full border border-black/10
                     bg-white/90 p-2.5 shadow-md backdrop-blur transition hover:bg-white
                     disabled:pointer-events-none disabled:opacity-0 sm:block
                     dark:border-white/15 dark:bg-zinc-900/90"
        >
          <Chevron className="rotate-180 rtl:rotate-0" />
        </button>
        <button
          type="button"
          onClick={() => step(1)}
          disabled={active === SLIDES.length - 1}
          aria-hidden="true"
          tabIndex={-1}
          className="absolute end-1 top-1/2 hidden -translate-y-1/2 rounded-full border border-black/10
                     bg-white/90 p-2.5 shadow-md backdrop-blur transition hover:bg-white
                     disabled:pointer-events-none disabled:opacity-0 sm:block
                     dark:border-white/15 dark:bg-zinc-900/90"
        >
          <Chevron className="rtl:rotate-180" />
        </button>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        {SLIDES.map((s, i) => (
          <button
            key={s.file}
            type="button"
            onClick={() => goTo(i)}
            aria-current={active === i ? 'true' : undefined}
            aria-controls={`panel-slide-${i}`}
            className={`rounded-full px-3.5 py-1.5 text-sm transition-colors ${
              active === i
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                : 'bg-black/5 text-zinc-600 hover:bg-black/10 dark:bg-white/10 dark:text-zinc-300'
            }`}
          >
            {t(s.labelKey)}
          </button>
        ))}
      </div>

      <p className="mt-4 text-center text-sm tabular-nums text-zinc-500 dark:text-zinc-500">
        {active + 1} / {SLIDES.length}
      </p>
    </section>
  );
}

function Chevron({ className = '' }: { className?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 14 14" fill="none" aria-hidden="true" className={className}>
      <path
        d="M5.5 3.5L9 7l-3.5 3.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
