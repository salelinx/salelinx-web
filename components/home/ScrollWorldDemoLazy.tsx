'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState, type ReactNode } from 'react';

// The demo is eight animated scenes below the fold. Hydrating them on load
// was most of the homepage's main-thread time, so nothing is fetched until
// the reader is a screen away.
const ScrollWorldDemo = dynamic(
  () => import('./ScrollWorldDemo').then((m) => m.ScrollWorldDemo),
  { ssr: false },
);

export function ScrollWorldDemoLazy({ fallback }: { fallback: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setNear(true);
        io.disconnect();
      },
      { rootMargin: '100% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return <div ref={ref}>{near ? <ScrollWorldDemo /> : fallback}</div>;
}
