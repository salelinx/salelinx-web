'use client';

import { useEffect, useRef } from 'react';

// No autoPlay: it overrides preload="none", and phones then fetched the whole
// file on page load whether or not anyone scrolled to it.
export function HeroVideo({ label }: { label: string }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = ref.current!;
    // No margin: the video starts just below the first screen on phones.
    const io = new IntersectionObserver(([e]) =>
      e.isIntersecting ? v.play().catch(() => {}) : v.pause(),
    );
    io.observe(v);
    return () => io.disconnect();
  }, []);

  return (
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
  );
}
