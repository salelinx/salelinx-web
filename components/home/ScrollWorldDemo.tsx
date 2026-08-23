'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Icon } from '@/components/Icon';
import { HeroPreview, SIDE_TABS, type TabId } from './HeroPreview';

/**
 * Scroll-scrubbed feature demo.
 *
 * The mechanic is ported from oso95/scroll-world's scrub engine: the stage is
 * pinned to the viewport while the page scrolls past a tall spacer, and scroll
 * distance is remapped onto a series of fixed-width segments. scroll-world
 * scrubs `video.currentTime` inside each segment; we have a live React panel
 * rather than a rendered camera flight, so a segment drives which feature the
 * panel is showing plus a settle/crossfade at the seams.
 *
 * Everything here degrades to the plain auto-cycling panel on narrow screens
 * and under prefers-reduced-motion, and that fallback is CSS-driven (see the
 * `md:` / `motion-reduce:` variants below) so there is no hydration-time jump.
 */

// Viewport-heights of scroll spent on each feature. scroll-world's default
// `diveScroll` is 1.3vh per scene; a UI panel reads faster than a camera
// flight, so the dwell is shorter here or the page feels like treacle.
const SEGMENT_SCROLL = 0.9;

// scroll-world's `linger`: how much of the segment is spent settled on the
// scene rather than moving between them. 0 is linear, 1 is fully eased.
const LINGER = 0.55;

// Fraction of a segment at each end treated as the seam, where the outgoing
// feature's copy fades out and the incoming one fades in.
const SEAM = 0.14;

const SEGMENTS = SIDE_TABS.length;

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

/**
 * scroll-world's `lingerEase`: blends linear progress with a cubic centred on
 * the segment midpoint. The cubic is flat around its centre and steep at the
 * edges, so the scene holds still mid-segment and moves quickly through the
 * boundary. L of 0 leaves progress linear.
 */
function lingerEase(x: number, L: number): number {
  const c = x - 0.5;
  return (1 - L) * x + L * (4 * c * c * c + 0.5);
}

export function ScrollWorldDemo() {
  const t = useTranslations('Home');
  const tp = useTranslations('Home.preview');

  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);

  // `driving` is false until we've confirmed the pinned layout is actually
  // live. While false the panel stays uncontrolled and auto-cycles, which is
  // exactly the behaviour we want on mobile and under reduced motion.
  const [driving, setDriving] = useState(false);
  const [index, setIndex] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    // The pinned stage has to fit inside one viewport: the panel alone floors
    // at 480px, and the chrome plus copy layer add roughly 220px on top. Below
    // that height the scrub would clip the panel, so we fall back instead.
    const mq = window.matchMedia(
      '(min-width: 768px) and (min-height: 720px) and (prefers-reduced-motion: no-preference)',
    );
    const sync = () => setDriving(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    if (!driving) return;

    let frame = 0;
    // Index lives in a ref as well as state so the scroll handler can compare
    // against it without re-subscribing on every segment change.
    let currentIndex = -1;

    const measure = () => {
      frame = 0;
      const section = sectionRef.current;
      const stage = stageRef.current;
      if (!section || !stage) return;

      const scrollable = section.offsetHeight - window.innerHeight;
      if (scrollable <= 0) return;

      const travelled = -section.getBoundingClientRect().top;
      const raw = clamp01(travelled / scrollable);

      // Remap 0..1 across the whole spacer onto 0..SEGMENTS, then split into
      // the segment we're in and how far through it we are.
      const p = raw * SEGMENTS;
      const nextIndex = Math.min(SEGMENTS - 1, Math.max(0, Math.floor(p)));
      const within = clamp01(p - nextIndex);
      const eased = lingerEase(within, LINGER);

      // Seam weight: 1 while settled on a feature, easing to 0 at both edges
      // of the segment. Drives the copy crossfade and the stage's settle.
      const seam =
        eased < SEAM
          ? eased / SEAM
          : eased > 1 - SEAM
            ? (1 - eased) / SEAM
            : 1;

      // Written straight to CSS custom properties rather than through state:
      // this runs every scroll frame and re-rendering an 11-panel demo at that
      // rate would drop frames. Only the segment index goes through React.
      stage.style.setProperty('--seam', seam.toFixed(4));
      stage.style.setProperty('--settle', (0.985 + seam * 0.015).toFixed(4));
      railRef.current?.style.setProperty('--seg', eased.toFixed(4));

      if (nextIndex !== currentIndex) {
        currentIndex = nextIndex;
        setIndex(nextIndex);
      }
      if (raw > 0.002) setStarted(true);
    };

    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [driving]);

  // Clicking a sidebar tab or a route dot scrolls to the middle of that
  // feature's segment, which then feeds the tab back down through `index`.
  const scrollToSegment = useCallback((i: number) => {
    const section = sectionRef.current;
    if (!section) return;
    const scrollable = section.offsetHeight - window.innerHeight;
    if (scrollable <= 0) return;
    window.scrollTo({
      top: section.offsetTop + scrollable * ((i + 0.5) / SEGMENTS),
      behavior: 'smooth',
    });
  }, []);

  const handleTabChange = useCallback(
    (id: TabId) => {
      const i = SIDE_TABS.findIndex((tab) => tab.id === id);
      if (i >= 0) scrollToSegment(i);
    },
    [scrollToSegment],
  );

  const activeId = SIDE_TABS[index]?.id ?? SIDE_TABS[0].id;

  return (
    <section
      ref={sectionRef}
      id="demo"
      aria-label={t('previewEyebrow')}
      className="relative scroll-mt-20"
      style={
        driving
          ? { height: `${SEGMENTS * SEGMENT_SCROLL * 100 + 100}vh` }
          : undefined
      }
    >
      <div
        className={
          driving
            ? 'sticky top-0 flex h-screen flex-col justify-center'
            : 'relative'
        }
      >
        <div
          className={
            driving
              ? 'mx-auto w-full max-w-6xl px-6'
              : 'mx-auto w-full max-w-6xl px-6 py-12'
          }
        >
          {/* Copy layer. scroll-world overlays an eyebrow/title/body per scene;
              ours reuses the panel's own translated header strings so it stays
              localised without a new set of keys per feature. */}
          <div
            className="mb-6 flex flex-col items-center text-center transition-opacity duration-200"
            style={{ opacity: driving ? 'var(--seam, 1)' : 1 }}
          >
            <span className="inline-flex items-center gap-2.5 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-zinc-600 dark:text-zinc-400">
              <span aria-hidden className="h-px w-8 bg-black/15 dark:bg-white/20" />
              {t('previewEyebrow')}
              <span aria-hidden className="h-px w-8 bg-black/15 dark:bg-white/20" />
            </span>
            <h2
              key={activeId}
              className="panel-swap mt-4 text-2xl font-semibold tracking-[-0.02em] text-zinc-900 sm:text-3xl dark:text-zinc-50"
            >
              {tp(`headers.${activeId}.title`)}
            </h2>
            <p
              key={`${activeId}-meta`}
              className="panel-swap mt-1.5 font-mono text-[0.7rem] uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-500"
            >
              {tp(`headers.${activeId}.meta`)}
            </p>
          </div>

          {/* The stage. Scaled a hair down at the seams so each feature reads
              as landing rather than cutting, which is the panel equivalent of
              scroll-world's connector crossfade. */}
          <div
            ref={stageRef}
            className="origin-center will-change-transform"
            style={{
              transform: driving ? 'scale(var(--settle, 1))' : undefined,
            }}
          >
            {driving ? (
              <HeroPreview activeTab={activeId} onTabChange={handleTabChange} />
            ) : (
              <HeroPreview />
            )}
          </div>
        </div>

        {/* Route dots, scroll-world's side nav. Hidden below the pinned
            breakpoint, where there is no scrub to navigate. */}
        {driving ? (
          <div
            ref={railRef}
            className="pointer-events-none absolute inset-y-0 end-4 hidden flex-col items-center justify-center gap-2.5 lg:flex xl:end-8"
            aria-hidden
          >
            {SIDE_TABS.map((tab, i) => {
              const isActive = i === index;
              return (
                <button
                  key={tab.id}
                  type="button"
                  tabIndex={-1}
                  onClick={() => scrollToSegment(i)}
                  title={tp(`tabs.${tab.id}`)}
                  className={
                    isActive
                      ? 'pointer-events-auto flex size-7 items-center justify-center rounded-full bg-white text-emerald-600 shadow-[0_1px_0_rgba(0,0,0,0.04),0_6px_16px_-8px_rgba(0,0,0,0.35)] ring-1 ring-black/10 transition dark:bg-white/[0.1] dark:text-emerald-400 dark:ring-white/15'
                      : 'pointer-events-auto flex size-7 items-center justify-center rounded-full text-zinc-400 transition hover:bg-black/[0.04] hover:text-zinc-600 dark:text-zinc-600 dark:hover:bg-white/[0.06] dark:hover:text-zinc-300'
                  }
                >
                  <Icon name={tab.icon} className="h-3.5 w-3.5" />
                </button>
              );
            })}
          </div>
        ) : null}

        {/* Scroll hint, fades out once the visitor takes the cue. */}
        {driving ? (
          <div
            className={
              started
                ? 'pointer-events-none absolute inset-x-0 bottom-6 flex justify-center opacity-0 transition-opacity duration-500'
                : 'pointer-events-none absolute inset-x-0 bottom-6 flex justify-center opacity-100 transition-opacity duration-500'
            }
          >
            <span className="inline-flex items-center gap-2 font-mono text-[0.62rem] uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-500">
              {t('previewScrollHint')}
              <svg
                width="13"
                height="13"
                viewBox="0 0 14 14"
                fill="none"
                aria-hidden="true"
                className="hero-preview-arrow"
              >
                <path
                  d="M7 3.5v6.5M4 7l3 3 3-3"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </div>
        ) : null}
      </div>
    </section>
  );
}
