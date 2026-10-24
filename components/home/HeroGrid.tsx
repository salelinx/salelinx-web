'use client';

import { useEffect, useRef } from 'react';

const TARGET_ROW = 80;

/** The hero's grid rows, sized so a whole number of them fills the hero: a
 *  line on the header's edge and one on the bottom of the screen, never a
 *  leftover strip. Rows stretch a few px either side of 80 to make it fit. */
export function HeroGrid() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      const h = el.clientHeight;
      const rows = Math.max(1, Math.round(h / TARGET_ROW));
      // Columns stay 80px to line up with the page guides; dark mode has no rows.
      el.style.backgroundSize = `80px 100%, 100% ${h / rows}px`;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return <div ref={ref} aria-hidden className="hero-grid absolute inset-0" />;
}
