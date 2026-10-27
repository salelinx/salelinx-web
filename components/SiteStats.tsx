'use client';

import { Analytics } from '@vercel/analytics/next';
import { STATS_OPT_OUT_KEY, statsUrl } from '@/lib/consent';

export function statsOptedOut(): boolean {
  try {
    return localStorage.getItem(STATS_OPT_OUT_KEY) === '1';
  } catch {
    return false;
  }
}

export function setStatsOptOut(optOut: boolean) {
  try {
    if (optOut) localStorage.setItem(STATS_OPT_OUT_KEY, '1');
    else localStorage.removeItem(STATS_OPT_OUT_KEY);
  } catch {}
}

export function SiteStats() {
  return (
    <Analytics
      beforeSend={(event) => {
        if (statsOptedOut()) return null;
        const url = statsUrl(event.url);
        return url ? { ...event, url } : null;
      }}
    />
  );
}
