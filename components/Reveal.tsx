"use client";

import {
  createElement,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Triggers animation slightly before the element fully enters. Default 120px. */
  rootMargin?: string;
  /** Delay before the in-view class is applied (ms). Useful for chained reveals. */
  delay?: number;
  /** Use the popIn variant instead of tabSlideIn (better for cards). */
  pop?: boolean;
  as?: "div" | "section" | "article" | "ul" | "li";
}

/**
 * Wraps children in a tabSlideIn (or popIn) animation that triggers when
 * the element first scrolls into view. Children with `cascade-item` will
 * stagger in once the parent gets `in-view`.
 */
export function Reveal({
  children,
  className = "",
  rootMargin = "0px 0px -120px 0px",
  delay = 0,
  pop = false,
  as = "div",
}: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Already past the threshold on mount? Show immediately so above-the-fold
    // content does not pop in after a scroll event.
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight - 80) {
      const t = setTimeout(() => setShown(true), delay);
      return () => clearTimeout(t);
    }

    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setTimeout(() => setShown(true), delay);
            obs.disconnect();
            return;
          }
        }
      },
      { rootMargin },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [delay, rootMargin]);

  const base = pop ? "reveal-pop" : "reveal";
  const classes = `${base}${shown ? " in-view" : ""} ${className}`.trim();

  return createElement(as, { ref, className: classes }, children);
}
