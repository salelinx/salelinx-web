"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

/**
 * Shared by the scenes added alongside the dead stock, price drop, refresher
 * and auto-offer panels. HeroPreview and RestockerScene still keep their own
 * copies; they are identical, so either can move over here when next touched.
 */

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/**
 * A counter that goes up every `intervalMs` while the scene is mounted. Holds
 * at 0 for reduced motion, so a scene should read `usePrefersReducedMotion`
 * and jump to its finished frame rather than freeze on an empty first one.
 */
export function useTick(intervalMs: number): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (window.matchMedia(REDUCED_MOTION_QUERY).matches) return;
    const id = window.setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return tick;
}

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(REDUCED_MOTION_QUERY);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(REDUCED_MOTION_QUERY).matches,
    // Server render assumes motion is fine; the client corrects on hydration.
    () => false,
  );
}
