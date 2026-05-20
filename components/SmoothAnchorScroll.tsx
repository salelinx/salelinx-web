'use client';

import { useEffect } from 'react';

const DURATION_MS = 1600;
const HEADER_OFFSET = 80;

// Gentle ease-out: starts moving immediately, decelerates smoothly into
// the target. Reads as a slow, deliberate brush rather than a snap.
function easeOutQuart(t: number) {
  return 1 - Math.pow(1 - t, 4);
}

function animateScroll(targetY: number) {
  const startY = window.scrollY;
  const distance = targetY - startY;
  if (Math.abs(distance) < 2) {
    window.scrollTo(0, targetY);
    return;
  }
  const startTime = performance.now();
  let raf = 0;
  const step = (now: number) => {
    const t = Math.min((now - startTime) / DURATION_MS, 1);
    window.scrollTo(0, startY + distance * easeOutQuart(t));
    if (t < 1) raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  return () => cancelAnimationFrame(raf);
}

// Fixed-duration smooth scroll for same-page hash links. Native CSS
// scroll-behavior: smooth has no duration control, so long pages feel
// sluggish. We intercept anchor clicks that point at an element on the
// current page and animate to it in DURATION_MS instead.
export function SmoothAnchorScroll() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const t = e.target;
      if (!(t instanceof Element)) return;
      const anchor = t.closest('a');
      if (!anchor) return;
      if (anchor.target === '_blank' || anchor.hasAttribute('download')) return;
      const href = anchor.getAttribute('href');
      if (!href) return;

      // Extract the hash from the href, then look up the target element in
      // the current document. If it exists here we intercept regardless of
      // pathname (next-intl's locale-prefixed hrefs and trailing-slash
      // mismatches would otherwise miss valid same-page anchors).
      let hash: string | null = null;
      if (href.startsWith('#')) {
        hash = href;
      } else {
        try {
          const url = new URL(href, window.location.href);
          if (url.origin !== window.location.origin || !url.hash) return;
          hash = url.hash;
        } catch {
          return;
        }
      }
      if (!hash || hash === '#') return;

      const id = decodeURIComponent(hash.slice(1));
      const el = document.getElementById(id);
      if (!el) return;

      // Capture phase: fire before Next.js Link's own onClick handler so
      // we can take over before the router does an instant hash scroll.
      e.preventDefault();
      e.stopImmediatePropagation();
      const targetY =
        el.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET;
      animateScroll(Math.max(0, targetY));
      if (window.location.hash !== hash) {
        history.pushState(null, '', hash);
      }
    };

    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  return null;
}
