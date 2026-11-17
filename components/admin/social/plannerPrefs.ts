"use client";

// The planner's view (week, month or list) and platform filter, remembered in
// this browser (localStorage, never a cookie) the same way as the Stats
// pages' switches (components/admin/insights/prefs.ts): read through
// useSyncExternalStore so the server render and hydration use the defaults,
// and kept in memory if storage is blocked.

import { useSyncExternalStore } from "react";
import { PLANNER_VIEWS, type PlannerView } from "@/lib/social/calendar";
import { SOCIAL_PLATFORMS, type SocialPlatform } from "@/lib/social/types";

export type PlannerPrefs = {
  view: PlannerView;
  platform: SocialPlatform | "all";
};

const KEY = "slx-planner";
const DEFAULTS: PlannerPrefs = { view: "week", platform: "all" };

const listeners = new Set<() => void>();
let memory: PlannerPrefs | null = null;
let broken = false;
let cache: { raw: string | null; value: PlannerPrefs } | null = null;

function parse(raw: string | null): PlannerPrefs {
  try {
    const p = JSON.parse(raw ?? "null") as Partial<PlannerPrefs> | null;
    return {
      view: PLANNER_VIEWS.includes(p?.view as PlannerView)
        ? (p!.view as PlannerView)
        : DEFAULTS.view,
      platform:
        p?.platform &&
        (p.platform === "all" || SOCIAL_PLATFORMS.includes(p.platform))
          ? p.platform
          : DEFAULTS.platform,
    };
  } catch {
    return DEFAULTS;
  }
}

function read(): PlannerPrefs {
  if (broken) return memory ?? DEFAULTS;
  let raw: string | null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    broken = true;
    return memory ?? DEFAULTS;
  }
  if (!cache || cache.raw !== raw) cache = { raw, value: parse(raw) };
  return cache.value;
}

function write(next: PlannerPrefs) {
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

export function usePlannerPrefs(): [
  PlannerPrefs,
  (patch: Partial<PlannerPrefs>) => void,
] {
  const prefs = useSyncExternalStore(subscribe, read, () => DEFAULTS);
  return [prefs, (patch) => write({ ...read(), ...patch })];
}
