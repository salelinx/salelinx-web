'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
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
 * Slides are narrower than the track on purpose. The sliver of the neighbours
 * is what tells someone there is more than one without needing a hint, and it
 * is the difference between this reading as a carousel and reading as a
 * screenshot with some buttons under it.
 *
 * The first and last slides have a neighbour on one side only, which left the
 * opening view lopsided. Rather than build a looping carousel, the track is
 * bookended with two decorative clones so both edges have something to peek
 * at. They are aria-hidden, are not snap targets, and are never navigation
 * destinations, so the real slides stay six and the indices stay honest.
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

  /** Real slide i is child i+1: child 0 is the leading decorative clone. */
  const childOf = (track: HTMLElement, i: number) =>
    track.children[i + 1] as HTMLElement | undefined;

  const goTo = useCallback((i: number) => {
    const track = trackRef.current;
    const slide = track && childOf(track, i);
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

  // Open on the first real slide rather than the leading clone. scrollLeft is
  // nudged by a measured delta instead of scrollIntoView, which would drag the
  // whole page down to a carousel that is below the fold on mount.
  useLayoutEffect(() => {
    const track = trackRef.current;
    const first = track && childOf(track, 0);
    if (!track || !first) return;
    track.scrollLeft +=
      first.getBoundingClientRect().left -
      track.getBoundingClientRect().left -
      (track.clientWidth - first.clientWidth) / 2;
  }, []);

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
            // -1 for the leading clone; clones are never observed, so a real
            // slide always maps to a valid index.
            const i = Array.prototype.indexOf.call(track.children, e.target) - 1;
            if (i >= 0 && i < SLIDES.length) setActive(i);
          }
        }
      },
      { root: track, threshold: 0.6 },
    );
    for (let i = 0; i < SLIDES.length; i++) {
      const child = childOf(track, i);
      if (child) io.observe(child);
    }
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
          <CloneSlide file={SLIDES[SLIDES.length - 1].file} />
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
          <CloneSlide file={SLIDES[0].file} />
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

/**
 * A decorative copy of a slide, so the first and last real slides still have
 * something peeking on both sides. Deliberately not a snap target and not
 * observed, so it can never become the active slide or shift the count.
 */
function CloneSlide({ file }: { file: string }) {
  return (
    <div aria-hidden="true" className="w-[88%] shrink-0 select-none" style={{ scrollSnapAlign: 'none' }}>
      <Image
        src={`/panel/${file}`}
        alt=""
        width={W}
        height={H}
        loading="lazy"
        quality={75}
        sizes="(max-width: 640px) 88vw, (max-width: 1024px) 80vw, 900px"
        className="pointer-events-none w-full rounded-xl border border-black/10 opacity-60 shadow-lg dark:border-white/10"
      />
    </div>
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
