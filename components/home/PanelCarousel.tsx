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
 * Labels reuse `Home.preview.tabs`, which is already translated into all six
 * locales, rather than adding keys that would need six translations.
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

const W = 1960;
const H = 1070;

export function PanelCarousel({ className = '' }: { className?: string }) {
  const t = useTranslations('Home.preview.tabs');
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const goTo = useCallback((i: number) => {
    const track = trackRef.current;
    const slide = track?.children[i] as HTMLElement | undefined;
    if (!track || !slide) return;
    // Honour the OS setting: an instant jump is the correct reduced-motion
    // answer here, not a slower animation.
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    track.scrollTo({ left: slide.offsetLeft - track.offsetLeft, behavior: reduced ? 'auto' : 'smooth' });
  }, []);

  // Track which slide is centred so the buttons reflect swipes and keyboard
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
    <div
      className={className}
      role="group"
      aria-roledescription="carousel"
      aria-label={t('crosslist')}
    >
      <div
        ref={trackRef}
        tabIndex={0}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth rounded-xl
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
            className="w-full shrink-0 snap-center"
          >
            <Image
              src={`/panel/${s.file}`}
              alt={t(s.labelKey)}
              width={W}
              height={H}
              /* Only the first slide is above the fold; the rest must not
                 compete with it for LCP. */
              priority={i === 0}
              loading={i === 0 ? undefined : 'lazy'}
              sizes="(max-width: 1024px) 100vw, 1024px"
              className="w-full rounded-xl border border-black/10 shadow-sm dark:border-white/10"
            />
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {SLIDES.map((s, i) => (
          <button
            key={s.file}
            type="button"
            onClick={() => goTo(i)}
            aria-current={active === i ? 'true' : undefined}
            aria-controls={`panel-slide-${i}`}
            className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
              active === i
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                : 'bg-black/5 text-zinc-600 hover:bg-black/10 dark:bg-white/10 dark:text-zinc-300'
            }`}
          >
            {t(s.labelKey)}
          </button>
        ))}
      </div>
    </div>
  );
}
