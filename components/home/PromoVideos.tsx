'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Reveal } from '@/components/Reveal';

// Web encodes of the 4K renders in Marketing/tiktok/out: 540px for the belt,
// hd/ at 1080px for the enlarged player. None has audio.
const VIDEOS = [
  'factory',
  'vending',
  'pricegun',
  'postoffice',
  'departures',
  'deepsea',
  'graveyard',
  'floordrobe',
  'inbox',
  'receipt',
  'quest',
  'comic',
  'tierlist',
  'reply',
  'gatekept',
  'copypaste',
  'search',
  'translator',
  'hero',
];

const RADIUS = 16;
const MONO = 'font-mono text-[0.68rem] uppercase tracking-[0.12em]';

export function PromoVideos() {
  const t = useTranslations('Home.promoVideos');
  const trackRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLButtonElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<{ name: string; tile: HTMLButtonElement } | null>(null);
  const closing = useRef(false);
  const [near, setNear] = useState(false);

  // Posters wait until the belt is close, so visitors who never scroll this
  // far do not pay for nineteen images.
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setNear(true), {
      rootMargin: '600px 0px',
    });
    io.observe(trackRef.current!);
    return () => io.disconnect();
  }, []);

  // Only clips actually on screen decode; the rest sit on their poster.
  useEffect(() => {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const v = e.target as HTMLVideoElement;
        if (e.isIntersecting) {
          if (!v.src) v.src = v.dataset.src!;
          v.play().catch(() => {});
        } else {
          v.pause();
        }
      }
    });
    trackRef.current?.querySelectorAll('video').forEach((v) => io.observe(v));
    return () => io.disconnect();
  }, []);

  // FLIP: the frame is laid out at its final size, then animated from the
  // tile's rect. The radius is scaled inversely so the corners match the tile
  // at the start instead of popping.
  const expand = (tile: HTMLButtonElement) => {
    const frame = frameRef.current!;
    const a = tile.getBoundingClientRect();
    const b = frame.getBoundingClientRect();
    const scale = a.width / b.width;
    const opts = { duration: 420, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' };
    backdropRef.current!.animate([{ opacity: 0 }, { opacity: 1 }], opts);
    frame.animate(
      [
        {
          transform: `translate(${a.left + a.width / 2 - (b.left + b.width / 2)}px, ${
            a.top + a.height / 2 - (b.top + b.height / 2)
          }px) scale(${scale})`,
          borderRadius: `${RADIUS / scale}px`,
        },
        { transform: 'none', borderRadius: `${RADIUS}px` },
      ],
      opts,
    );
  };

  useLayoutEffect(() => {
    if (!open) return;
    const tileVideo = open.tile.querySelector('video')!;
    const [canvas, ...videos] = frameRef.current!.children as unknown as [
      HTMLCanvasElement,
      HTMLVideoElement,
      HTMLVideoElement,
    ];
    // Exact frame the tile was showing, painted before the first frame of the
    // animation, so the enlarged view never starts on black.
    if (tileVideo.readyState >= 2) {
      canvas.width = tileVideo.videoWidth;
      canvas.height = tileVideo.videoHeight;
      canvas.getContext('2d')!.drawImage(tileVideo, 0, 0);
    }
    for (const v of videos) {
      v.currentTime = tileVideo.currentTime;
      v.play().catch(() => {});
    }
    expand(open.tile);
    overlayRef.current!.focus({ preventScroll: true });
  }, [open]);

  // The clip dissolves where it is, and the tile fades back in wherever the
  // belt has carried its slot in the meantime.
  const close = () => {
    if (!open || closing.current) return;
    closing.current = true;
    const { tile } = open;
    const shown = [...frameRef.current!.querySelectorAll('video')].reverse().find((v) => v.style.opacity === '1');
    if (shown) tile.querySelector('video')!.currentTime = shown.currentTime;
    const opts = { duration: 380, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'forwards' as const };
    backdropRef.current!.animate([{ opacity: 1 }, { opacity: 0 }], opts);
    frameRef.current!.animate(
      [
        { opacity: 1, transform: 'scale(1)', filter: 'blur(0px)' },
        { opacity: 0, transform: 'scale(1.06)', filter: 'blur(14px)' },
      ],
      opts,
    ).onfinish = () => {
      closing.current = false;
      setOpen(null);
      tile.focus({ preventScroll: true });
      tile.animate(
        [
          { opacity: 0, transform: 'scale(0.92)', filter: 'blur(6px)' },
          { opacity: 1, transform: 'none', filter: 'blur(0px)' },
        ],
        { duration: 420, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
      );
    };
  };

  return (
    <section className="border-t border-black/10 py-14 sm:py-20 dark:border-white/10">
      <Reveal as="div" className="mx-auto max-w-5xl px-6 pb-10 text-center sm:pb-12">
        <span className={`${MONO} text-zinc-600 dark:text-zinc-400`}>{t('eyebrow')}</span>
        <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl dark:text-zinc-50">
          {t('title')}
        </h2>
        <p className="mx-auto mt-4 max-w-md text-balance text-base text-zinc-600 dark:text-zinc-400">
          {t('body')}
        </p>
      </Reveal>

      {/* Reuses the feature ticker's -50% loop and its reduced-motion fallback. */}
      <div className="feature-ticker-viewport relative w-full overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)]">
        <div
          ref={trackRef}
          className="feature-ticker promo-belt flex w-max will-change-transform"
        >
          {[0, 1].map((copy) => (
            <div key={copy} aria-hidden={copy === 1} className="flex shrink-0 flex-col">
              <div className="flex">
                {VIDEOS.map((name, i) => (
                  <button
                    key={name}
                    type="button"
                    tabIndex={copy === 1 ? -1 : undefined}
                    aria-label={t('open', { n: i + 1 })}
                    onClick={(e) => setOpen({ name, tile: e.currentTarget })}
                    style={open?.tile && open.name === name ? { visibility: 'hidden' } : undefined}
                    className="mx-2 w-[150px] shrink-0 cursor-zoom-in overflow-hidden rounded-2xl bg-zinc-900 ring-1 ring-black/10 sm:w-[200px] lg:w-[220px] dark:ring-white/10"
                  >
                    <video
                      data-src={`/videos/promo/${name}.mp4`}
                      poster={near ? `/videos/promo/${name}.jpg` : undefined}
                      muted
                      loop
                      playsInline
                      preload="none"
                      className="pointer-events-none block aspect-[9/16] w-full object-cover"
                    />
                  </button>
                ))}
              </div>
              {/* The belt rides the same transform, so it moves with the clips. */}
              <div className="mt-4 h-2 bg-[repeating-linear-gradient(90deg,rgb(24_24_27/0.18)_0_14px,transparent_14px_28px)] dark:bg-[repeating-linear-gradient(90deg,rgb(255_255_255/0.18)_0_14px,transparent_14px_28px)]" />
            </div>
          ))}
        </div>
      </div>

      {open && (
        <button
          ref={overlayRef}
          type="button"
          aria-label={t('close')}
          onClick={close}
          onKeyDown={(e) => e.key === 'Escape' && close()}
          // No page scroll lock: toggling overflow on <html> sent the page into
          // a runaway layout loop. Touch scroll is blocked here; a wheel closes.
          onWheel={close}
          className="fixed inset-0 z-[100] flex cursor-zoom-out touch-none items-center justify-center overscroll-contain outline-none"
        >
          <div ref={backdropRef} className="absolute inset-0 bg-black/85" />
          <div
            ref={frameRef}
            style={{ backgroundImage: `url(/videos/promo/${open.name}.jpg)` }}
            className="relative aspect-[9/16] h-[min(88svh,calc(94vw*16/9))] overflow-hidden rounded-2xl bg-zinc-900 bg-cover shadow-2xl will-change-transform"
          >
            <canvas className="absolute inset-0 h-full w-full" />
            {/* Cached belt copy first, then the sharp one; each fades in only
                once it is actually playing. */}
            {[`/videos/promo/${open.name}.mp4`, `/videos/promo/hd/${open.name}.mp4`].map((src) => (
              <video
                key={src}
                src={src}
                muted
                loop
                playsInline
                onPlaying={(e) => (e.currentTarget.style.opacity = '1')}
                style={{ opacity: 0 }}
                className="pointer-events-none absolute inset-0 h-full w-full object-cover transition-opacity duration-200"
              />
            ))}
          </div>
        </button>
      )}
    </section>
  );
}
