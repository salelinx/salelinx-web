'use client';

import { useEffect, useRef } from 'react';

const STEPS = 1000;

// No autoPlay: it overrides preload="none", and phones then fetched the whole
// file on page load whether or not anyone scrolled to it.
export function HeroVideo({ label }: { label: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const seek = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const v = ref.current!;
    const bar = seek.current!;
    // No margin: the video starts just below the first screen on phones.
    const io = new IntersectionObserver(([e]) =>
      e.isIntersecting ? v.play().catch(() => {}) : v.pause(),
    );
    io.observe(v);

    // Driven per frame rather than by timeupdate, which fires ~4 times a second
    // and makes the fill visibly step.
    let frame = 0;
    const paint = () => {
      if (!v.duration) return;
      const p = v.currentTime / v.duration;
      bar.value = String(p * STEPS);
      bar.style.setProperty('--p', `${p * 100}%`);
    };
    const loop = () => {
      paint();
      frame = requestAnimationFrame(loop);
    };
    const start = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(loop);
    };
    const stop = () => cancelAnimationFrame(frame);
    v.addEventListener('play', start);
    v.addEventListener('pause', stop);
    v.addEventListener('seeked', paint);
    return () => {
      io.disconnect();
      stop();
      v.removeEventListener('play', start);
      v.removeEventListener('pause', stop);
      v.removeEventListener('seeked', paint);
    };
  }, []);

  const onSeek = (e: React.FormEvent<HTMLInputElement>) => {
    const v = ref.current!;
    if (!v.duration) return;
    const value = Number(e.currentTarget.value);
    v.currentTime = (value / STEPS) * v.duration;
    e.currentTarget.style.setProperty('--p', `${(value / STEPS) * 100}%`);
  };

  return (
    <div className="group relative">
      <video
        ref={ref}
        className="block aspect-video w-full rounded-3xl object-cover shadow-2xl ring-1 ring-black/10 dark:ring-white/10"
        poster="/videos/salelinx-hero-poster.jpg"
        muted
        loop
        playsInline
        preload="none"
        aria-label={label}
      >
        <source src="/videos/salelinx-hero-4k.mp4" type="video/mp4" media="(min-width: 1024px)" />
        <source src="/videos/salelinx-hero.mp4" type="video/mp4" />
      </video>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-3 sm:p-5">
        <div className="pointer-events-auto flex w-full max-w-md items-center rounded-full bg-white/45 px-5 py-3 opacity-70 shadow-[0_10px_40px_-8px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.8)] ring-1 ring-black/[0.06] backdrop-blur-2xl backdrop-saturate-[1.8] transition duration-300 group-hover:opacity-100 focus-within:opacity-100 focus-within:ring-black/25 [@media(hover:none)]:opacity-100">
          <input
            ref={seek}
            type="range"
            min={0}
            max={STEPS}
            step="any"
            defaultValue={0}
            onInput={onSeek}
            aria-label="Video position"
            className="hero-seek w-full"
          />
        </div>
      </div>
    </div>
  );
}
