"use client";

// The period and platform picked in the Stats pages' header, shared by
// every page in the section so moving between them keeps the view. Kept in
// localStorage (this browser only, never a cookie) and read through
// useSyncExternalStore, so the server render and hydration both use the
// defaults and the saved choice applies straight after. If storage is
// blocked, the choice lasts until the tab closes.

import { useSyncExternalStore } from "react";
import type { MarketingPlatform } from "@/lib/admin/marketing";
import { PERIODS, type Period } from "@/lib/social/insights";
import { SOCIAL_PLATFORMS } from "@/lib/social/types";

export type InsightsPrefs = { period: Period; platform: MarketingPlatform | "all" };

const KEY = "slx-insights";
const DEFAULTS: InsightsPrefs = { period: 30, platform: "all" };

const listeners = new Set<() => void>();
// The last choice, and whether storage failed, so a blocked localStorage
// still lets the switches work for this tab.
let memory: InsightsPrefs | null = null;
let broken = false;
let cache: { raw: string | null; value: InsightsPrefs } | null = null;

function parse(raw: string | null): InsightsPrefs {
  try {
    const p = JSON.parse(raw ?? "null") as Partial<InsightsPrefs> | null;
    return {
      period: PERIODS.includes(p?.period as Period) ? (p!.period as Period) : DEFAULTS.period,
      platform:
        p?.platform && (p.platform === "all" || SOCIAL_PLATFORMS.includes(p.platform)) ? p.platform : DEFAULTS.platform,
    };
  } catch {
    return DEFAULTS;
  }
}

function read(): InsightsPrefs {
  if (broken) return memory ?? DEFAULTS;
  let raw: string | null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    broken = true;
    return memory ?? DEFAULTS;
  }
  // The same object while nothing changed, as useSyncExternalStore requires.
  if (!cache || cache.raw !== raw) cache = { raw, value: parse(raw) };
  return cache.value;
}

function write(next: InsightsPrefs) {
  memory = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    broken = true;
  }
  for (const l of listeners) l();
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useInsightsPrefs(): [InsightsPrefs, (patch: Partial<InsightsPrefs>) => void] {
  const prefs = useSyncExternalStore(subscribe, read, () => DEFAULTS);
  return [prefs, (patch) => write({ ...read(), ...patch })];
}
