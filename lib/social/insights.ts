// The figures behind the pages in the Stats dropdown past its Overview
// (/admin/marketing/insights/*). The Overview leads with the index (each post
// against our typical one); these pages are the rest of the picture: what each period
// gained, engagement, followers, timing, how a video's views build up, and
// which kinds of post do better. Pure, so tests can run it without a database
// (tests/social-insights.test.ts). See docs/SOCIAL.md "Stats pages".
//
// Gains come from the daily snapshots: each day's lifetime count less the day
// before. Platforms report lifetime totals, so a period's views are the sum of
// those differences, never a sum of lifetime views.

import {
  daysBefore,
  MARKETING_PLATFORMS,
  type MarketingFollowerRow,
  type MarketingPlatform,
  type MarketingStatRow,
} from "@/lib/admin/marketing";
import { median } from "./experiments";
import {
  indexVideos,
  per1k,
  videoKey,
  viewsAtAges,
  watchedPct,
  type AgePointRow,
  type PostForOverview,
  type VideoRowWithTags,
} from "./overview";
import { captionFeatures, cleanTags, slotOf, type CaptionFeatures, type Day, type Part, type SocialTags } from "./tags";

export const PERIODS = [7, 30, 90] as const;
export type Period = (typeof PERIODS)[number];

/** Daily history the section loads: two of the longest period, plus the day the first is measured from. */
export const HISTORY_DAYS = 2 * 90 + 1;

/** The ages marketing_video_age_points gives (054_social_tags.sql). */
export const AGES = [1, 6, 24, 72, 168] as const;
export type Age = (typeof AGES)[number];
export const AGE_SHORT: Record<Age, string> = { 1: "1h", 6: "6h", 24: "24h", 72: "3d", 168: "7d" };

export const GAIN_METRICS = ["views", "likes", "comments", "shares", "saves", "watchSeconds", "subscribers"] as const;
export type GainMetric = (typeof GAIN_METRICS)[number];
export type Gains = Record<GainMetric, number>;

const COLUMN: Record<GainMetric, keyof MarketingStatRow> = {
  views: "views",
  likes: "likes",
  comments: "comments",
  shares: "shares",
  saves: "saves",
  watchSeconds: "watch_seconds",
  subscribers: "subscribers_gained",
};

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

// Rates need enough views that one like doesn't swing them (as per1k).
export const MIN_VIEWS_FOR_RATES = 100;

export const zeroGains = (): Gains => ({
  views: 0,
  likes: 0,
  comments: 0,
  shares: 0,
  saves: 0,
  watchSeconds: 0,
  subscribers: 0,
});

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** The `count` days ending on `last`, oldest first. */
export function dayRange(last: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => daysBefore(last, count - 1 - i));
}

/**
 * One video's gains per day: each snapshot less the one before it, clamped at
 * zero since a platform sometimes recounts down. Its first snapshot counts in
 * full when the video went up after tracking began (`trackedFrom`, the first
 * day of snapshots), or the day before that snapshot: all its views then came
 * in while we were watching, even if the first sync to see it was late.
 * Otherwise that row holds everything from before tracking began.
 */
export function dailyGains(
  snaps: MarketingStatRow[],
  publishedAt: string | null,
  trackedFrom?: string | null,
): { day: string; gains: Gains }[] {
  const sorted = [...snaps].sort((a, b) => a.day.localeCompare(b.day));
  const publishedDay = publishedAt?.slice(0, 10) ?? null;
  return sorted.map((cur, i) => {
    const prev = i > 0 ? sorted[i - 1] : null;
    const isNew =
      !prev &&
      publishedDay !== null &&
      (publishedDay >= daysBefore(cur.day, 1) || (!!trackedFrom && publishedDay >= trackedFrom));
    const gains = zeroGains();
    for (const m of GAIN_METRICS) {
      const now = num(cur[COLUMN[m]]);
      if (now === null) continue;
      if (prev) {
        const before = num(prev[COLUMN[m]]);
        if (before !== null) gains[m] = Math.max(0, now - before);
      } else if (isNew) gains[m] = Math.max(0, now);
    }
    return { day: cur.day, gains };
  });
}

export type Window = { from: string; to: string };

/** The `period` days ending today (back = 0), or the run of them before that (back = 1). */
export function periodWindow(today: string, period: number, back = 0): Window {
  const to = daysBefore(today, period * back);
  return { from: daysBefore(to, period - 1), to };
}

const inWindow = (day: string, w: Window) => day >= w.from && day <= w.to;

/** One platform copy of a video, with everything the section shows. */
export type InsightVideo = {
  key: string;
  platform: MarketingPlatform;
  external_id: string;
  title: string;
  url: string | null;
  thumbnail: string | null;
  publishedAt: string | null;
  postId: string | null;
  tags: SocialTags;
  seconds: number | null;
  caption: CaptionFeatures | null;
  slot: { day: Day; part: Part; hour: number } | null;
  ageDays: number | null;
  // Lifetime, from the newest daily snapshot.
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  reach: number | null;
  watchSeconds: number | null;
  avgWatchSeconds: number | null;
  avgViewPct: number | null;
  subscribers: number | null;
  at: Record<Age, number | null>;
  index: Record<24 | 168, number | null>;
  // What it gained in each period ending today.
  gained: Record<Period, Gains>;
  // Hours since the platform's previous video went up.
  gapHours: number | null;
};

export type PlatformDaily = {
  gains: Gains[];
  uploads: number[];
  followers: (number | null)[];
  // Every tracked video's latest lifetime views, summed; null before tracking.
  lifetimeViews: (number | null)[];
};

export type InsightsData = {
  today: string;
  nowMs: number;
  // HISTORY_DAYS days ending today, oldest first; every daily array lines up with it.
  days: string[];
  // The first day whose gains we trust: the day after the first snapshot.
  measuredFrom: string | null;
  videos: InsightVideo[];
  daily: Record<MarketingPlatform, PlatformDaily>;
};

/** Everything the insights pages read, from the tables. */
export function assembleInsights(input: {
  today: string;
  nowMs: number;
  videos: VideoRowWithTags[];
  stats: MarketingStatRow[];
  agePoints: AgePointRow[];
  posts: PostForOverview[];
  followers: MarketingFollowerRow[];
}): InsightsData {
  const days = dayRange(input.today, HISTORY_DAYS);
  const dayIndex = new Map(days.map((d, i) => [d, i]));

  const postOf = new Map<string, { post: PostForOverview; caption: string | null }>();
  for (const post of input.posts)
    for (const t of post.targets)
      if (t.external_id) postOf.set(videoKey(t.platform, t.external_id), { post, caption: t.caption });

  const snapsOf = new Map<string, MarketingStatRow[]>();
  for (const s of input.stats) {
    const k = videoKey(s.platform, s.external_id);
    const list = snapsOf.get(k);
    if (list) list.push(s);
    else snapsOf.set(k, [s]);
  }
  for (const list of snapsOf.values()) list.sort((a, b) => a.day.localeCompare(b.day));

  const published = new Map(input.videos.map((v) => [videoKey(v.platform, v.external_id), v.published_at]));
  const at = viewsAtAges(input.agePoints, published);
  const { index } = indexVideos(
    input.videos.map((v) => {
      const key = videoKey(v.platform, v.external_id);
      return { key, platform: v.platform, published_at: v.published_at, at: at.get(key) ?? {} };
    }),
  );

  const firstDay = input.stats.reduce<string | null>((m, s) => (m === null || s.day < m ? s.day : m), null);

  const daily = {} as Record<MarketingPlatform, PlatformDaily>;
  for (const p of MARKETING_PLATFORMS)
    daily[p] = {
      gains: days.map(zeroGains),
      uploads: days.map(() => 0),
      followers: days.map(() => null),
      lifetimeViews: days.map(() => null),
    };

  const windows = Object.fromEntries(PERIODS.map((p) => [p, periodWindow(input.today, p)])) as Record<Period, Window>;

  // Hours since the previous video on the same platform.
  const gapOf = new Map<string, number>();
  for (const p of MARKETING_PLATFORMS) {
    const mine = input.videos
      .filter((v) => v.platform === p && v.published_at)
      .sort((a, b) => a.published_at!.localeCompare(b.published_at!));
    for (let i = 1; i < mine.length; i++)
      gapOf.set(
        videoKey(p, mine[i].external_id),
        (Date.parse(mine[i].published_at!) - Date.parse(mine[i - 1].published_at!)) / HOUR_MS,
      );
  }

  const videos = input.videos.map((v): InsightVideo => {
    const key = videoKey(v.platform, v.external_id);
    const snaps = snapsOf.get(key) ?? [];
    const latest = snaps[snaps.length - 1];
    const linked = postOf.get(key);
    const ages = at.get(key) ?? {};

    const gained = Object.fromEntries(PERIODS.map((p) => [p, zeroGains()])) as Record<Period, Gains>;
    for (const { day, gains } of dailyGains(snaps, v.published_at, firstDay)) {
      const i = dayIndex.get(day);
      if (i !== undefined) for (const m of GAIN_METRICS) daily[v.platform].gains[i][m] += gains[m];
      for (const p of PERIODS)
        if (inWindow(day, windows[p])) for (const m of GAIN_METRICS) gained[p][m] += gains[m];
    }
    const upDay = v.published_at?.slice(0, 10);
    const upIndex = upDay ? dayIndex.get(upDay) : undefined;
    if (upIndex !== undefined) daily[v.platform].uploads[upIndex] += 1;

    const caption = linked?.caption ?? v.caption ?? null;
    const publishedMs = v.published_at ? Date.parse(v.published_at) : NaN;
    return {
      key,
      platform: v.platform,
      external_id: v.external_id,
      title: linked?.post.name ?? v.title ?? "(untitled)",
      url: v.url,
      thumbnail: v.thumbnail_url,
      publishedAt: v.published_at,
      postId: linked?.post.id ?? null,
      tags: cleanTags(linked ? linked.post.tags : v.tags),
      seconds: num(linked?.post.media_seconds) ?? num(v.duration_seconds),
      caption: captionFeatures(caption ?? v.title),
      slot: slotOf(v.published_at),
      ageDays: Number.isFinite(publishedMs) ? Math.max(0, (input.nowMs - publishedMs) / DAY_MS) : null,
      views: num(latest?.views),
      likes: num(latest?.likes),
      comments: num(latest?.comments),
      shares: num(latest?.shares),
      saves: num(latest?.saves),
      reach: num(latest?.reach),
      watchSeconds: num(latest?.watch_seconds),
      avgWatchSeconds: num(latest?.avg_watch_seconds),
      avgViewPct: num(latest?.avg_view_pct),
      subscribers: num(latest?.subscribers_gained),
      at: { 1: ages[1] ?? null, 6: ages[6] ?? null, 24: ages[24] ?? null, 72: ages[72] ?? null, 168: ages[168] ?? null },
      index: index.get(key) ?? { 24: null, 168: null },
      gained,
      gapHours: gapOf.get(key) ?? null,
    };
  });

  // Lifetime views by day: each video's latest count on or before the day.
  for (const p of MARKETING_PLATFORMS) {
    const mine = input.videos
      .filter((v) => v.platform === p)
      .map((v) => snapsOf.get(videoKey(p, v.external_id)) ?? [])
      .filter((s) => s.length);
    const cursor = mine.map(() => -1);
    days.forEach((day, i) => {
      let total = 0;
      let any = false;
      mine.forEach((snaps, j) => {
        while (cursor[j] + 1 < snaps.length && snaps[cursor[j] + 1].day <= day) cursor[j]++;
        const v = cursor[j] >= 0 ? num(snaps[cursor[j]].views) : null;
        if (v !== null) {
          total += v;
          any = true;
        }
      });
      daily[p].lifetimeViews[i] = any ? total : null;
    });
  }

  for (const f of input.followers) {
    const i = dayIndex.get(f.day);
    if (i !== undefined && daily[f.platform]) daily[f.platform].followers[i] = num(f.followers);
  }

  return {
    today: input.today,
    nowMs: input.nowMs,
    days,
    measuredFrom: firstDay ? daysBefore(firstDay, -1) : null,
    videos,
    daily,
  };
}

// --- Period sums ---------------------------------------------------------------

export type PeriodTotals = Gains & { uploads: number };

/** What the given platforms gained over a window. */
export function windowTotals(data: InsightsData, platforms: MarketingPlatform[], w: Window): PeriodTotals {
  const out: PeriodTotals = { ...zeroGains(), uploads: 0 };
  data.days.forEach((day, i) => {
    if (!inWindow(day, w)) return;
    for (const p of platforms) {
      for (const m of GAIN_METRICS) out[m] += data.daily[p].gains[i][m];
      out.uploads += data.daily[p].uploads[i];
    }
  });
  return out;
}

/** One value per day of the window, for a sparkline or a column chart. */
export function windowSeries(
  data: InsightsData,
  platforms: MarketingPlatform[],
  w: Window,
  value: (gains: Gains, uploads: number) => number,
): { days: string[]; values: number[] } {
  const days: string[] = [];
  const values: number[] = [];
  data.days.forEach((day, i) => {
    if (!inWindow(day, w)) return;
    const sum: Gains = zeroGains();
    let uploads = 0;
    for (const p of platforms) {
      for (const m of GAIN_METRICS) sum[m] += data.daily[p].gains[i][m];
      uploads += data.daily[p].uploads[i];
    }
    days.push(day);
    values.push(value(sum, uploads));
  });
  return { days, values };
}

/** How much of a window the snapshots cover: all of it, some, or none. */
export function coverage(data: InsightsData, w: Window): "full" | "partial" | "none" {
  if (!data.measuredFrom || data.measuredFrom > w.to) return "none";
  return data.measuredFrom <= w.from ? "full" : "partial";
}

/** A platform's follower count on a day: the last one recorded on or before it. */
export function followersOn(data: InsightsData, platform: MarketingPlatform, day: string): number | null {
  const counts = data.daily[platform].followers;
  for (let i = data.days.length - 1; i >= 0; i--) if (data.days[i] <= day && counts[i] !== null) return counts[i];
  return null;
}

/**
 * Net followers over a window: the last count in it less the last one before
 * it. When counting began inside the window, from its first count instead,
 * as views are counted from when tracking began.
 */
export function followersGained(data: InsightsData, platform: MarketingPlatform, w: Window): number | null {
  const end = followersOn(data, platform, w.to);
  let start = followersOn(data, platform, daysBefore(w.from, 1));
  if (start === null) {
    const counts = data.daily[platform].followers;
    const i = data.days.findIndex((d, j) => inWindow(d, w) && counts[j] !== null);
    start = i < 0 ? null : counts[i];
  }
  return end === null || start === null ? null : end - start;
}

/** Net followers per day of the window; null where either day has no count. */
export function followerSeries(data: InsightsData, platform: MarketingPlatform, w: Window): (number | null)[] {
  const out: (number | null)[] = [];
  data.days.forEach((day, i) => {
    if (!inWindow(day, w)) return;
    const now = data.daily[platform].followers[i];
    const before = i > 0 ? data.daily[platform].followers[i - 1] : null;
    out.push(now === null || before === null ? null : now - before);
  });
  return out;
}

/** Signed change from `before` to `now` as a ratio (0.12 = 12% up), or null. */
export function change(now: number | null, before: number | null): number | null {
  if (now === null || before === null || before === 0) return null;
  return now / before - 1;
}

// --- Per-video rates -------------------------------------------------------------

/** Likes, comments, shares and saves, counting what the platform reports. */
export function engagements(v: Pick<InsightVideo, "likes" | "comments" | "shares" | "saves">): number | null {
  const parts = [v.likes, v.comments, v.shares, v.saves].filter((x): x is number => x !== null);
  return parts.length ? parts.reduce((a, b) => a + b, 0) : null;
}

/** Engagements per view, 0 to 1, or null under 100 views. */
export function engagementRate(v: InsightVideo): number | null {
  const e = engagements(v);
  if (e === null || v.views === null || v.views < MIN_VIEWS_FOR_RATES) return null;
  return e / v.views;
}

/** Likes per view, 0 to 1, or null under 100 views. */
export function likeRate(v: InsightVideo): number | null {
  if (v.likes === null || v.views === null || v.views < MIN_VIEWS_FOR_RATES) return null;
  return v.likes / v.views;
}

export const comments1k = (v: InsightVideo) => per1k(v.comments, v.views);
export const shares1k = (v: InsightVideo) => per1k(v.shares, v.views);
export const saves1k = (v: InsightVideo) => per1k(v.saves, v.views);
export const subs1k = (v: InsightVideo) => per1k(v.subscribers, v.views);
/** Average share watched, 0 to 100, from 100 views like the other rates. */
export const watched = (v: InsightVideo) =>
  v.views !== null && v.views >= MIN_VIEWS_FOR_RATES
    ? watchedPct({ avgViewPct: v.avgViewPct, avgWatchSeconds: v.avgWatchSeconds, seconds: v.seconds })
    : null;

/** Lifetime views per day since it went up, from its first full day. */
export function viewsPerDay(v: InsightVideo): number | null {
  if (v.views === null || v.ageDays === null) return null;
  return v.views / Math.max(1, v.ageDays);
}

// --- How views build up ------------------------------------------------------------

/** Share of its first week's views a video had at `h` hours, 0 to 1. */
export function weekShare(v: Pick<InsightVideo, "at">, h: Age): number | null {
  const week = v.at[168];
  const then = v.at[h];
  if (week === null || week <= 0 || then === null) return null;
  return Math.min(1, then / week);
}

/**
 * Hours until a video had half its first week's views, interpolated between
 * neighbouring ages. Every age up to the crossing must be measured: a video
 * known only at 7 days would otherwise read as a straight line from zero,
 * which always says 3.5 days.
 */
export function halfLifeHours(v: Pick<InsightVideo, "at">): number | null {
  const week = v.at[168];
  if (week === null || week <= 0) return null;
  const target = week / 2;
  let prev = { h: 0, views: 0 };
  for (const h of AGES) {
    const views = v.at[h];
    if (views === null) return null;
    if (views >= target) {
      if (views === prev.views) return h;
      return prev.h + ((target - prev.views) / (views - prev.views)) * (h - prev.h);
    }
    prev = { h, views };
  }
  return null;
}

/** Spearman's rank correlation, -1 to 1, or null under 3 pairs or with no spread. */
export function spearman(xs: number[], ys: number[]): number | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return null;
  const rank = (vals: number[]) => {
    const order = vals.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
    const out = new Array<number>(n);
    for (let i = 0; i < n; ) {
      let j = i;
      while (j + 1 < n && order[j + 1].v === order[i].v) j++;
      const r = (i + j) / 2 + 1;
      for (let k = i; k <= j; k++) out[order[k].i] = r;
      i = j + 1;
    }
    return out;
  };
  const rx = rank(xs.slice(0, n));
  const ry = rank(ys.slice(0, n));
  const mean = (n + 1) / 2;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (rx[i] - mean) * (ry[i] - mean);
    sxx += (rx[i] - mean) ** 2;
    syy += (ry[i] - mean) ** 2;
  }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : null;
}

/** How well views at `h` rank videos the way their first week does, on one platform. */
export function earlySignal(videos: InsightVideo[], h: Age): { rho: number | null; n: number } {
  const pairs = videos.filter((v) => v.at[h] !== null && v.at[168] !== null);
  return { rho: spearman(pairs.map((v) => v.at[h]!), pairs.map((v) => v.at[168]!)), n: pairs.length };
}

export const AGE_BUCKETS = ["Posted this period", "Up to 4 weeks before", "1 to 3 months before", "Older"] as const;
export type AgeBucket = (typeof AGE_BUCKETS)[number];

/** Where a period's views came from: posts made in it, or ones already up. */
export function ageBucket(publishedAt: string | null, w: Window): AgeBucket {
  const day = publishedAt?.slice(0, 10);
  if (!day || day >= w.from) return "Posted this period";
  if (day >= daysBefore(w.from, 28)) return "Up to 4 weeks before";
  if (day >= daysBefore(w.from, 91)) return "1 to 3 months before";
  return "Older";
}

// --- Timing ----------------------------------------------------------------------

export const GAP_BUCKETS = ["Under 12 hours", "12 to 24 hours", "1 to 2 days", "2 to 4 days", "4 days or more"] as const;

export function gapBucket(hours: number | null): (typeof GAP_BUCKETS)[number] | null {
  if (hours === null || !Number.isFinite(hours) || hours < 0) return null;
  if (hours < 12) return "Under 12 hours";
  if (hours < 24) return "12 to 24 hours";
  if (hours < 48) return "1 to 2 days";
  if (hours < 96) return "2 to 4 days";
  return "4 days or more";
}

/** The Monday (UTC) of the week a day falls in, "YYYY-MM-DD". */
export function weekOf(day: string): string {
  const d = new Date(`${day.slice(0, 10)}T00:00:00Z`);
  const back = (d.getUTCDay() + 6) % 7;
  return daysBefore(day.slice(0, 10), back);
}

/** Median and count of the numbers in a list, ignoring nulls. */
export function summarise(values: (number | null)[]): { median: number | null; n: number } {
  const xs = values.filter((x): x is number => x !== null && Number.isFinite(x));
  return { median: median(xs), n: xs.length };
}

// --- Formatting ------------------------------------------------------------------

/** 940, 12,480, 1.2M: in full under a million. */
export function count(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "-";
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  return Math.round(n).toLocaleString("en-GB");
}

/** 940, 12.5K, 1.2M: for tiles and axes. */
export function compact(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "-";
  const a = Math.abs(n);
  if (a >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (a >= 10_000) return `${Math.round(n / 1000)}K`;
  if (a >= 1_000) return `${(n / 1000).toFixed(1)}K`;
  return String(Math.round(n));
}

/** A 0 to 1 share as 12.3% (or 12% at whole = true). */
export function percent(x: number | null | undefined, whole = false): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return "-";
  const p = x * 100;
  return whole || p >= 100 ? `${Math.round(p)}%` : `${p.toFixed(1)}%`;
}

/** +12%, -3%, or "same". */
export function signedPercent(x: number | null): string {
  if (x === null) return "-";
  const p = Math.round(x * 100);
  if (p === 0) return "same";
  return `${p > 0 ? "+" : ""}${p}%`;
}

/** 45m, 3.2h, 6d. */
export function hours(h: number | null): string {
  if (h === null || !Number.isFinite(h)) return "-";
  if (h < 1) return `${Math.max(1, Math.round(h * 60))}m`;
  if (h < 48) return `${h < 10 ? h.toFixed(1) : Math.round(h)}h`;
  return `${(h / 24).toFixed(1)}d`;
}

/** 3 Nov, from "YYYY-MM-DD". */
export function shortDay(day: string): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

/** Mon 3 Nov. */
export function weekdayDay(day: string): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

/** 1,234h or 4.5h of watch time, from seconds. */
export function watchHours(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return "-";
  const h = seconds / 3600;
  return h < 10 ? `${h.toFixed(1)}h` : `${Math.round(h).toLocaleString("en-GB")}h`;
}
