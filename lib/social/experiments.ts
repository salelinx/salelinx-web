// A video's numbers at a given age after posting, read off its snapshots, and
// the permutation test Compare uses. Pure, so tests can run it without a
// database (tests/social.test.ts).
//
// Comparing at the same age is the point: a video posted on Monday always has
// more lifetime views than one posted on Friday, which says nothing about
// which was better. Videos on different platforms are never pooled either.

import type { HourlyRow } from "./types";

export const AGES_H = [1, 6, 24, 72, 168] as const;

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
  // Hours since posting against views, for the chart.
  curve: { h: number; views: number }[];
};

export function videoCurve(rows: HourlyRow[], publishedAt: string | null): VideoCurve {
  const empty = Object.fromEntries(AGES_H.map((h) => [h, null])) as AgeValues;
  if (!publishedAt) return { ages: empty, curve: [] };
  const published = Date.parse(publishedAt);
  const views = rows
    .filter((r) => r.views !== null)
    .map((r) => ({ t: Date.parse(r.captured_at), v: r.views! }));
  const ages = Object.fromEntries(
    AGES_H.map((h) => [h, valueAtAge(views, published, h)]),
  ) as AgeValues;

  const curve = views
    .filter((p) => p.t >= published)
    .map((p) => ({ h: (p.t - published) / HOUR_MS, views: p.v }))
    .sort((a, b) => a.h - b.h);
  return { ages, curve: [{ h: 0, views: 0 }, ...curve] };
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
    // A random split only needs the smaller side drawn: shuffle just that
    // many places (a partial Fisher-Yates), so Compare can test dozens of
    // groups of a few hundred posts without stalling the page.
    const rand = mulberry32(n * 7919 + k);
    const pool = [...all];
    const small = Math.min(k, n - k);
    for (; tried < 20000; tried++) {
      let sumSmall = 0;
      for (let i = 0; i < small; i++) {
        const j = i + Math.floor(rand() * (n - i));
        [pool[i], pool[j]] = [pool[j], pool[i]];
        sumSmall += pool[i];
      }
      if (diff(small === k ? sumSmall : total - sumSmall) >= observed) extreme++;
    }
  }
  return extreme / tried;
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
