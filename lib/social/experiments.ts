// Experiment arithmetic: a video's numbers at a given age after posting, read
// off its snapshots, and a comparison of variants within one platform. Pure,
// so tests can run it without a database (tests/social.test.ts).
//
// Comparing at the same age is the point: a video posted on Monday always has
// more lifetime views than one posted on Friday, which says nothing about
// which was better. Videos on different platforms are never pooled either.

import type {
  ExperimentMetric,
  ExperimentVariant,
  HourlyRow,
  SocialPlatform,
} from "./types";

export const AGES_H = [1, 6, 24, 72, 168] as const;

export const METRIC_HOURS: Record<ExperimentMetric, number> = {
  views_1h: 1,
  views_6h: 6,
  views_24h: 24,
  views_72h: 72,
  views_7d: 168,
  engagement_7d: 168,
};

const HOUR_MS = 3600_000;

type Point = { t: number; v: number };

/**
 * A cumulative count at `hours` after posting, by straight-line interpolation
 * between the snapshots either side, with zero at the moment of posting.
 * Null if there is no snapshot at or after that age yet, or if the snapshots
 * either side are too far apart to trust (more than 2 hours, or a quarter of
 * the age, whichever is more): a video first tracked at 30 hours has no
 * honest 1-hour number.
 */
export function valueAtAge(
  points: Point[],
  publishedMs: number,
  hours: number,
): number | null {
  const target = publishedMs + hours * HOUR_MS;
  const sorted = points
    .filter((p) => p.t >= publishedMs)
    .sort((a, b) => a.t - b.t);
  let before: Point = { t: publishedMs, v: 0 };
  for (const p of sorted) {
    if (p.t < target) {
      before = p;
      continue;
    }
    if (p.t === target) return p.v;
    const gap = p.t - before.t;
    if (gap > Math.max(2 * HOUR_MS, hours * HOUR_MS * 0.25)) return null;
    return before.v + ((p.v - before.v) * (target - before.t)) / gap;
  }
  return null;
}

export type AgeValues = Record<(typeof AGES_H)[number], number | null>;

export type VideoCurve = {
  ages: AgeValues;
  engagement7d: number | null;
  // Hours since posting against views, for the chart.
  curve: { h: number; views: number }[];
};

export function videoCurve(rows: HourlyRow[], publishedAt: string | null): VideoCurve {
  const empty = Object.fromEntries(AGES_H.map((h) => [h, null])) as AgeValues;
  if (!publishedAt) return { ages: empty, engagement7d: null, curve: [] };
  const published = Date.parse(publishedAt);
  const series = (key: "views" | "likes" | "comments" | "shares") =>
    rows
      .filter((r) => r[key] !== null)
      .map((r) => ({ t: Date.parse(r.captured_at), v: r[key] as number }));
  const views = series("views");
  const ages = Object.fromEntries(
    AGES_H.map((h) => [h, valueAtAge(views, published, h)]),
  ) as AgeValues;

  const v7 = ages[168];
  let engagement7d: number | null = null;
  if (v7 !== null && v7 >= 100) {
    const at = (k: "likes" | "comments" | "shares") =>
      valueAtAge(series(k), published, 168) ?? 0;
    engagement7d = (at("likes") + at("comments") + at("shares")) / v7;
  }

  const curve = views
    .filter((p) => p.t >= published)
    .map((p) => ({ h: (p.t - published) / HOUR_MS, views: p.v }))
    .sort((a, b) => a.h - b.h);
  return { ages, engagement7d, curve: [{ h: 0, views: 0 }, ...curve] };
}

export function metricValue(c: VideoCurve, metric: ExperimentMetric): number | null {
  if (metric === "engagement_7d") return c.engagement7d;
  return c.ages[METRIC_HOURS[metric] as (typeof AGES_H)[number]];
}

/**
 * The typical value of a variant: views are compared on a log scale (a
 * geometric mean), since one viral video should not swamp three ordinary
 * ones; engagement is a rate, so a plain mean.
 */
export function typical(values: number[], metric: ExperimentMetric): number | null {
  if (!values.length) return null;
  if (metric === "engagement_7d") return values.reduce((a, b) => a + b, 0) / values.length;
  const logMean = values.reduce((a, v) => a + Math.log1p(v), 0) / values.length;
  return Math.expm1(logMean);
}

/** A small deterministic PRNG, so the same data always gives the same p. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function* combinations(n: number, k: number): Generator<number[]> {
  const idx = Array.from({ length: k }, (_, i) => i);
  while (true) {
    yield idx;
    let i = k - 1;
    while (i >= 0 && idx[i] === n - k + i) i--;
    if (i < 0) return;
    idx[i]++;
    for (let j = i + 1; j < k; j++) idx[j] = idx[j - 1] + 1;
  }
}

/**
 * Two-sided permutation test on the difference in means: how often a random
 * relabelling of the same videos splits them at least as far apart. Exact up
 * to 20,000 splits, sampled beyond. Makes no assumption about how views are
 * distributed, and with few videos it simply cannot get small: 1 vs 1 is
 * always p = 1, and it takes 4 per variant before p can drop under 0.05.
 */
export function permutationP(a: number[], b: number[]): number {
  const all = [...a, ...b];
  const n = all.length;
  const k = a.length;
  if (!k || !b.length) return 1;
  const total = all.reduce((s, v) => s + v, 0);
  const diff = (sumA: number) => Math.abs(sumA / k - (total - sumA) / (n - k));
  const observed = diff(a.reduce((s, v) => s + v, 0)) - 1e-12;

  let splits = 1;
  for (let i = 0; i < k; i++) splits = (splits * (n - i)) / (i + 1);

  let extreme = 0;
  let tried = 0;
  if (splits <= 20000) {
    for (const idx of combinations(n, k)) {
      let sumA = 0;
      for (const i of idx) sumA += all[i];
      if (diff(sumA) >= observed) extreme++;
      tried++;
    }
  } else {
    const rand = mulberry32(n * 7919 + k);
    const pool = [...all];
    for (; tried < 20000; tried++) {
      for (let i = n - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      let sumA = 0;
      for (let i = 0; i < k; i++) sumA += pool[i];
      if (diff(sumA) >= observed) extreme++;
    }
  }
  return extreme / tried;
}

export type ExperimentMember = {
  platform: SocialPlatform;
  external_id: string;
  variant: string;
  title: string | null;
  url: string | null;
  thumbnail_url: string | null;
  published_at: string | null;
} & VideoCurve & { value: number | null };

export type VariantResult = {
  key: string;
  label: string;
  videos: number;
  // Videos old enough (and tracked closely enough) to have the metric.
  measured: number;
  typical: number | null;
};

export type PlatformResult = {
  platform: SocialPlatform;
  variants: VariantResult[];
  leader: string | null;
  // Leader's typical value over the runner-up's, minus one.
  lift: number | null;
  p: number | null;
  verdict: "waiting" | "hint" | "inconclusive" | "significant";
};

export function comparePlatform(
  platform: SocialPlatform,
  members: ExperimentMember[],
  variants: ExperimentVariant[],
  metric: ExperimentMetric,
): PlatformResult {
  const mine = members.filter((m) => m.platform === platform);
  const values = (key: string) =>
    mine.filter((m) => m.variant === key && m.value !== null).map((m) => m.value!);
  const results: VariantResult[] = variants.map((v) => {
    const vals = values(v.key);
    return {
      key: v.key,
      label: v.label,
      videos: mine.filter((m) => m.variant === v.key).length,
      measured: vals.length,
      typical: typical(vals, metric),
    };
  });

  const ranked = results
    .filter((r) => r.typical !== null)
    .sort((a, b) => b.typical! - a.typical!);
  if (ranked.length < 2)
    return { platform, variants: results, leader: null, lift: null, p: null, verdict: "waiting" };

  const [first, second] = ranked;
  const lift = second.typical! > 0 ? first.typical! / second.typical! - 1 : null;
  const scale = (v: number) => (metric === "engagement_7d" ? v : Math.log1p(v));
  const p = permutationP(values(first.key).map(scale), values(second.key).map(scale));
  const verdict =
    first.measured < 2 || second.measured < 2
      ? "hint"
      : p < 0.05
        ? "significant"
        : "inconclusive";
  return { platform, variants: results, leader: first.key, lift, p, verdict };
}

/** Views at `h` hours along a curve, or null past its last snapshot. */
export function curveAt(curve: { h: number; views: number }[], h: number): number | null {
  if (!curve.length || h > curve[curve.length - 1].h) return null;
  let prev = curve[0];
  for (const p of curve) {
    if (p.h >= h) {
      if (p.h === prev.h) return p.views;
      return prev.views + ((p.views - prev.views) * (h - prev.h)) / (p.h - prev.h);
    }
    prev = p;
  }
  return null;
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * The typical video's curve: at each step, the median of every curve that
 * reaches that far, for as long as at least `min` of them do.
 */
export function medianCurve(
  curves: { h: number; views: number }[][],
  maxH: number,
  step = 1,
  min = 3,
): { h: number; views: number }[] {
  const out: { h: number; views: number }[] = [];
  for (let h = 0; h <= maxH; h += step) {
    const at = curves.map((c) => curveAt(c, h)).filter((v): v is number => v !== null);
    if (at.length < min) break;
    out.push({ h, views: median(at)! });
  }
  return out;
}
