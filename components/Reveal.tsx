"use client";

import {
  useEffect,
  useRef,
  useState,
  type ElementType,
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
  /**
   * Apply `panel-swap` on entry instead of the reveal classes. Use this to
   * reveal a block whose `cascade-item` descendants are nested more than one
   * level deep: `.in-view > .cascade-item` only reaches direct children, while
   * `.panel-swap .cascade-item` matches at any depth.
   */
  panel?: boolean;
  /** Passed through: panels mocking the extension UI must stay LTR in RTL locales. */
  dir?: "ltr" | "rtl" | "auto";
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
  panel = false,
  dir,
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

  // The panel variant carries no resting class: its children sit at
  // `.cascade-item`'s base opacity 0 until `panel-swap` arrives on entry.
  const classes = (
    panel
      ? `${shown ? "panel-swap" : ""} ${className}`
      : `${pop ? "reveal-pop" : "reveal"}${shown ? " in-view" : ""} ${className}`
  ).trim();

  // Dynamic tag via a capitalized alias so this is plain JSX (the React lint /
  // compiler understands ref forwarding here, unlike a createElement call). The
  // intrinsic-tag union would otherwise intersect each tag's differing ref
  // type; spread a loosely-typed props bag so our single HTMLElement ref fits
  // whichever tag `as` resolves to (all are HTMLElements at runtime).
  const Tag = as as ElementType;
  const tagProps: Record<string, unknown> = {
    ref,
    className: classes,
    ...(dir ? { dir } : {}),
  };
  return <Tag {...tagProps}>{children}</Tag>;
}
