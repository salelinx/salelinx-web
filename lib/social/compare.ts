// Compare: split our posts into groups by one thing (platform, length, when it
// went up, what the caption does, a tag) and see which groups do better on one
// measure. Each group is set against every other post, with the permutation
// test from the experiments (lib/social/experiments.ts) saying whether the gap
// is bigger than chance. Pure, so tests can run it
// (tests/social-insights.test.ts).
//
// Two traps it guards against. Raw views are never pooled across platforms,
// since each counts a view its own way; the index and the rates can be. And a
// group whose posts nearly all share something else (all TikTok, all talking
// head) gets that named, because then the two effects can't be told apart.

import { median, permutationP } from "./experiments";
import {
  comments1k,
  count,
  engagementRate,
  GAP_BUCKETS,
  gapBucket,
  likeRate,
  percent,
  saves1k,
  shares1k,
  subs1k,
  viewsPerDay,
  watched,
  type InsightVideo,
} from "./insights";
import { formatIndex } from "./overview";
import { DAYS, isTagged, LENGTH_BUCKETS, lengthBucket, PARTS } from "./tags";
import { PLATFORM_NAMES, SOCIAL_PLATFORMS } from "./types";

export type Measure = {
  key: string;
  label: string;
  hint: string;
  value: (v: InsightVideo) => number | null;
  // Compared on a log scale (views and the index), so one viral post can't decide it.
  log: boolean;
  // Raw views differ by platform; only the index and the rates can pool them.
  pooled: boolean;
  format: (x: number) => string;
};

const oneDecimal = (x: number) => x.toFixed(1);

export const MEASURES: Measure[] = [
  {
    key: "index168",
    label: "Against typical at 7 days",
    hint: "Views at 7 days over our typical post on the same platform at 7 days. 1.0x is typical.",
    value: (v) => v.index[168],
    log: true,
    pooled: true,
    format: (x) => formatIndex(x),
  },
  {
    key: "index24",
    label: "Against typical at 24 hours",
    hint: "Views at 24 hours over our typical post on the same platform at 24 hours.",
    value: (v) => v.index[24],
    log: true,
    pooled: true,
    format: (x) => formatIndex(x),
  },
  {
    key: "views168",
    label: "Views at 7 days",
    hint: "Views exactly a week after posting.",
    value: (v) => v.at[168],
    log: true,
    pooled: false,
    format: count,
  },
  {
    key: "views24",
    label: "Views at 24 hours",
    hint: "Views a day after posting.",
    value: (v) => v.at[24],
    log: true,
    pooled: false,
    format: count,
  },
  {
    key: "views6",
    label: "Views at 6 hours",
    hint: "Views six hours after posting.",
    value: (v) => v.at[6],
    log: true,
    pooled: false,
    format: count,
  },
  {
    key: "viewsPerDay",
    label: "Views per day",
    hint: "Lifetime views over days since posting.",
    value: viewsPerDay,
    log: true,
    pooled: false,
    format: count,
  },
  {
    key: "engagement",
    label: "Engagement rate",
    hint: "Likes, comments, shares and saves per view, from 100 views.",
    value: engagementRate,
    log: false,
    pooled: true,
    format: (x) => percent(x),
  },
  {
    key: "likes",
    label: "Like rate",
    hint: "Likes per view, from 100 views.",
    value: likeRate,
    log: false,
    pooled: true,
    format: (x) => percent(x),
  },
  {
    key: "comments1k",
    label: "Comments per 1,000 views",
    hint: "From 100 views.",
    value: comments1k,
    log: false,
    pooled: true,
    format: oneDecimal,
  },
  {
    key: "shares1k",
    label: "Shares per 1,000 views",
    hint: "From 100 views. Facebook gives no share count for Reels.",
    value: shares1k,
    log: false,
    pooled: true,
    format: oneDecimal,
  },
  {
    key: "saves1k",
    label: "Saves per 1,000 views",
    hint: "Instagram only.",
    value: saves1k,
    log: false,
    pooled: true,
    format: oneDecimal,
  },
  {
    key: "watched",
    label: "Watched",
    hint: "Average share of the video watched. YouTube, and Instagram once lengths are known.",
    value: watched,
    log: false,
    pooled: true,
    format: (x) => `${Math.round(x)}%`,
  },
  {
    key: "subs1k",
    label: "Subscribers per 1,000 views",
    hint: "YouTube only.",
    value: subs1k,
    log: false,
    pooled: true,
    format: (x) => x.toFixed(2),
  },
];

export const HASHTAG_BUCKETS = ["No hashtags", "1 to 2 hashtags", "3 to 5 hashtags", "6 or more hashtags"] as const;

export function hashtagBucket(n: number): (typeof HASHTAG_BUCKETS)[number] {
  if (n <= 0) return "No hashtags";
  if (n <= 2) return "1 to 2 hashtags";
  if (n <= 5) return "3 to 5 hashtags";
  return "6 or more hashtags";
}

export type Dimension = {
  key: string;
  label: string;
  values: (v: InsightVideo) => string[];
  order?: readonly string[];
  // Values that say what they are ("No question"), so "often with" needs no prefix.
  plain?: boolean;
};

const one = (x: string | null | undefined): string[] => (x ? [x] : []);
const flag = (v: InsightVideo, on: boolean | undefined, yes: string, no: string) =>
  isTagged(v.tags) ? [on ? yes : no] : [];

export const DIMENSIONS: Dimension[] = [
  {
    key: "platform",
    label: "Platform",
    values: (v) => [PLATFORM_NAMES[v.platform]],
    order: SOCIAL_PLATFORMS.map((p) => PLATFORM_NAMES[p]),
    plain: true,
  },
  { key: "length", label: "Length", values: (v) => one(lengthBucket(v.seconds)), order: LENGTH_BUCKETS },
  { key: "day", label: "Day posted", values: (v) => one(v.slot?.day), order: DAYS },
  { key: "part", label: "Time of day (UK)", values: (v) => one(v.slot?.part), order: PARTS },
  { key: "gap", label: "Since the previous post", values: (v) => one(gapBucket(v.gapHours)), order: GAP_BUCKETS },
  {
    key: "captionSize",
    label: "Caption length",
    values: (v) => one(v.caption?.size),
    order: ["Short caption", "Medium caption", "Long caption"],
    plain: true,
  },
  {
    key: "question",
    label: "Question in the caption",
    values: (v) => (v.caption ? [v.caption.question ? "Asks a question" : "No question"] : []),
    plain: true,
  },
  {
    key: "hashtags",
    label: "Hashtags",
    values: (v) => (v.caption ? [hashtagBucket(v.caption.hashtags)] : []),
    order: HASHTAG_BUCKETS,
    plain: true,
  },
  {
    key: "cta",
    label: "Call to action",
    values: (v) => (v.caption ? [v.caption.callToAction ? "Call to action" : "No call to action"] : []),
    plain: true,
  },
  { key: "madeWith", label: "Made with", values: (v) => one(v.tags.madeWith) },
  { key: "format", label: "Format", values: (v) => one(v.tags.format) },
  { key: "opening", label: "Opening", values: (v) => one(v.tags.opening) },
  { key: "style", label: "Style", values: (v) => one(v.tags.style) },
  { key: "topic", label: "Topic", values: (v) => v.tags.topics ?? [] },
  { key: "sound", label: "Sound", values: (v) => one(v.tags.sound) },
  {
    key: "face",
    label: "Face on screen",
    values: (v) => flag(v, v.tags.face, "Face on screen", "No face"),
    plain: true,
  },
  {
    key: "hookText",
    label: "Words on the first frame",
    values: (v) => flag(v, v.tags.hookText, "Words on the first frame", "No words on the first frame"),
    plain: true,
  },
  {
    key: "collab",
    label: "Made with a seller",
    values: (v) => flag(v, v.tags.collab, "Made with a seller", "Made by us"),
    plain: true,
  },
  {
    key: "source",
    label: "How it was posted",
    values: (v) => [v.postId ? "From the planner" : "Posted directly"],
    plain: true,
  },
];

export type Verdict = "real" | "leaning" | "none" | "few";

export const VERDICT_LABELS: Record<Verdict, string> = {
  real: "Real difference",
  leaning: "Leaning",
  none: "No clear difference",
  few: "Too few posts",
};

// Fewer than this on either side and the test can't say anything useful.
export const MIN_PER_SIDE = 3;

const transform = (m: Measure) => (x: number) =>
  m.log ? Math.log(Math.max(0, x) + (m.key.startsWith("index") ? 0.01 : 1)) : x;

/** Lift of `a` over `b` (medians), and whether the gap is more than chance. */
export function verdictOf(
  a: number[],
  b: number[],
  m: Measure,
): { lift: number | null; p: number | null; verdict: Verdict } {
  const ma = median(a);
  const mb = median(b);
  const lift = ma !== null && mb !== null && mb > 0 ? ma / mb - 1 : null;
  if (a.length < MIN_PER_SIDE || b.length < MIN_PER_SIDE) return { lift, p: null, verdict: "few" };
  const t = transform(m);
  const p = permutationP(a.map(t), b.map(t));
  return { lift, p, verdict: p < 0.05 ? "real" : p < 0.2 ? "leaning" : "none" };
}

export type ComparePoint = { key: string; value: number; video: InsightVideo };

export type GroupRow = {
  value: string;
  points: ComparePoint[];
  median: number | null;
  lift: number | null;
  p: number | null;
  verdict: Verdict;
  often: { label: string; share: number; restShare: number } | null;
};

const scoredBy = (videos: InsightVideo[], m: Measure) =>
  videos
    .map((v) => ({ v, x: m.value(v) }))
    .filter((s): s is { v: InsightVideo; x: number } => s.x !== null && Number.isFinite(s.x));

/**
 * Something most of a group shares that the rest mostly doesn't (at least 80%
 * against at most half), so its effect may be what the group is showing.
 */
export function oftenWith(
  members: InsightVideo[],
  rest: InsightVideo[],
  exclude: string,
): GroupRow["often"] {
  if (members.length < MIN_PER_SIDE) return null;
  let best: (NonNullable<GroupRow["often"]> & { score: number }) | null = null;
  for (const d of DIMENSIONS) {
    if (d.key === exclude) continue;
    const counts = new Map<string, number>();
    for (const v of members) for (const val of new Set(d.values(v))) counts.set(val, (counts.get(val) ?? 0) + 1);
    for (const [val, c] of counts) {
      const share = c / members.length;
      if (share < 0.8) continue;
      const restShare = rest.length ? rest.filter((v) => d.values(v).includes(val)).length / rest.length : 0;
      if (restShare > 0.5) continue;
      const score = share - restShare;
      if (!best || score > best.score)
        best = { label: d.plain ? val : `${d.label}: ${val}`, share, restShare, score };
    }
  }
  return best && { label: best.label, share: best.share, restShare: best.restShare };
}

/** One row per value of the dimension, each against every other post with a value. */
export function compareGroups(
  videos: InsightVideo[],
  dim: Dimension,
  m: Measure,
): { rows: GroupRow[]; missing: number; overall: number | null } {
  const scored = scoredBy(videos, m).map((s) => ({ ...s, groups: dim.values(s.v) }));
  const withValue = scored.filter((s) => s.groups.length);

  const counts = new Map<string, number>();
  for (const s of withValue) for (const g of s.groups) counts.set(g, (counts.get(g) ?? 0) + 1);
  const known = (dim.order ?? []).filter((g) => counts.has(g));
  const others = [...counts.keys()]
    .filter((g) => !known.includes(g))
    .sort((a, b) => counts.get(b)! - counts.get(a)! || a.localeCompare(b));

  const rows = [...known, ...others].map((value): GroupRow => {
    const inside = withValue.filter((s) => s.groups.includes(value));
    const outside = withValue.filter((s) => !s.groups.includes(value));
    const v = verdictOf(
      inside.map((s) => s.x),
      outside.map((s) => s.x),
      m,
    );
    return {
      value,
      points: inside.map((s) => ({ key: s.v.key, value: s.x, video: s.v })),
      median: median(inside.map((s) => s.x)),
      ...v,
      often: oftenWith(
        inside.map((s) => s.v),
        outside.map((s) => s.v),
        dim.key,
      ),
    };
  });
  return { rows, missing: scored.length - withValue.length, overall: median(withValue.map((s) => s.x)) };
}

export type Finding = { dimension: Dimension; row: GroupRow };

/**
 * Every group on every dimension that stands out on the measure ("real" or
 * "leaning"), clearest first. With this many tests a few "leaning" ones turn
 * up by chance alone, which the page says.
 */
export function findings(videos: InsightVideo[], m: Measure): Finding[] {
  const out: Finding[] = [];
  for (const dimension of DIMENSIONS) {
    const { rows } = compareGroups(videos, dimension, m);
    // A dimension with one value has nothing to compare it with.
    if (rows.length < 2) continue;
    for (const row of rows) {
      if (row.verdict !== "real" && row.verdict !== "leaning") continue;
      // With two values, each against the rest is the same test twice: keep the winner.
      if (rows.length === 2 && (row.lift ?? 0) < 0) continue;
      out.push({ dimension, row });
    }
  }
  return out.sort((a, b) => a.row.p! - b.row.p! || Math.abs(b.row.lift ?? 0) - Math.abs(a.row.lift ?? 0));
}

/** A against B on one dimension. Posts in both (two topics) are left out of both. */
export function compareTwo(
  videos: InsightVideo[],
  dim: Dimension,
  a: string,
  b: string,
  m: Measure,
): { a: ComparePoint[]; b: ComparePoint[]; both: number; lift: number | null; p: number | null; verdict: Verdict } {
  const scored = scoredBy(videos, m).map((s) => ({ ...s, groups: dim.values(s.v) }));
  const inA = scored.filter((s) => s.groups.includes(a) && !s.groups.includes(b));
  const inB = scored.filter((s) => s.groups.includes(b) && !s.groups.includes(a));
  const both = scored.filter((s) => s.groups.includes(a) && s.groups.includes(b)).length;
  const point = (s: { v: InsightVideo; x: number }) => ({ key: s.v.key, value: s.x, video: s.v });
  return {
    a: inA.map(point),
    b: inB.map(point),
    both,
    ...verdictOf(
      inA.map((s) => s.x),
      inB.map((s) => s.x),
      m,
    ),
  };
}
