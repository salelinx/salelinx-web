"use client";

import { useEffect, useRef } from "react";
import { notFound } from "next/navigation";

/**
 * Dev-only mobile filmstrip.
 *
 * Checking the homepage on a phone was effectively impossible from a headless
 * browser, which is how the scene spacing got shipped wrong twice. A screenshot
 * only ever captures the viewport, and the trick of using a very tall window
 * does not work here: the scenes are `min-h-[100svh]` and the hero is sized in
 * svh too, so making the window taller makes the content taller with it and
 * you photograph the same first screen at a different size.
 *
 * This renders the real homepage in a column of 390x844 iframes, each scrolled
 * to a different offset. Every frame is a true phone viewport, so `svh` and the
 * `sm:` breakpoint resolve exactly as they do on a device, and one wide
 * screenshot of this page shows the whole scroll.
 *
 * Same-origin, so scrollTo on the iframe's own window is allowed.
 *
 * Trust this over a narrow browser window. Chrome will not make a top-level
 * window much under 400px, so asking a headless one for 390 lays the page out
 * wider than that and then screenshots 390 of it: the hero headline appears to
 * overflow and the CTAs look clipped, none of which happens on a device. An
 * iframe can be exactly 390 wide, so it does not lie.
 */

const FRAME_W = 390;
const FRAME_H = 844;

/** Deliberate overlap, so nothing important can hide in a seam. */
const STEP = 700;
const FRAMES = 12;

function Frame({ offset }: { offset: number }) {
  const ref = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Re-apply a few times: the first scroll can land before images and the
    // panels' own layout settle, which shifts content under it.
    const apply = () => {
      try {
        el.contentWindow?.scrollTo(0, offset);
      } catch {
        // Cross-origin would throw. It never is here, but a dev page should
        // not take the whole route down if it ever becomes so.
      }
    };
    const timers = [300, 900, 1800, 3000].map((t) => setTimeout(apply, t));
    el.addEventListener("load", apply);
    return () => {
      timers.forEach(clearTimeout);
      el.removeEventListener("load", apply);
    };
  }, [offset]);

  return (
    <div className="flex shrink-0 flex-col gap-1">
      <p className="font-mono text-[10px] text-zinc-500">y = {offset}</p>
      <iframe
        ref={ref}
        src="/"
        title={`Homepage at ${offset}px`}
        scrolling="no"
        style={{ width: FRAME_W, height: FRAME_H }}
        className="rounded-lg border border-black/15 dark:border-white/20"
      />
    </div>
  );
}

export default function MobileFilmstripPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="p-4">
      <h1 className="mb-1 text-lg font-medium">Mobile filmstrip</h1>
      <p className="mb-4 font-mono text-[11px] text-zinc-500">
        development only · the real homepage in {FRAME_W}x{FRAME_H} viewports,
        stepped {STEP}px apart
      </p>
      <div className="flex gap-3">
        {Array.from({ length: FRAMES }, (_, i) => (
          <Frame key={i} offset={i * STEP} />
        ))}
      </div>
    </main>
  );
}
