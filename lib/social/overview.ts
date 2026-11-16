// The Stats overview's arithmetic: each video's views at 24 hours and 7 days
// against our typical video on the same platform at the same age (the index),
// and the period figures built on it. Pure, so tests can run it without a
// database (tests/social-overview.test.ts).
//
// Why an index and not views: older videos have had longer, each platform
// counts a view its own way (YouTube changed how it counts Shorts views in
// March 2025), and a good month lifts everything. Dividing by our own typical
// video at the same age cancels all three, so a TikTok and a Facebook post can
// sit on one chart. 1.0 is typical, 2.0 is twice as good.

import type { MarketingPlatform, MarketingStatRow, MarketingVideoRow } from "@/lib/admin/marketing";
import { median, valueAtAge } from "./experiments";
import { autoTags, cleanTags, type SocialTags } from "./tags";

export const INDEX_AGES = [24, 168] as const;
export type IndexAge = (typeof INDEX_AGES)[number];

export const AGE_LABELS: Record<IndexAge, string> = { 24: "24 hours", 168: "7 days" };

// "Typical" is the median of this many of our most recent measured videos on
// the platform, and needs at least MIN_OTHERS besides the one being scored.
export const TYPICAL_OF = 30;
export const MIN_OTHERS = 3;

// Per-1,000 rates need enough views that one like doesn't swing them.
const MIN_VIEWS_FOR_RATES = 100;

/** A row of the marketing_video_age_points view (054_social_tags.sql). */
export type AgePointRow = {
  platform: MarketingPlatform;
  external_id: string;
  age_hours: number;
  hourly_before_at: string | null;
  hourly_before_views: number | null;
  hourly_after_at: string | null;
  hourly_after_views: number | null;
  daily_before_at: string | null;
  daily_before_views: number | null;
  daily_after_at: string | null;
  daily_after_views: number | null;
};

export const videoKey = (platform: string, id: string) => `${platform}:${id}`;

/**
 * Views at each age, keyed by video then age, from the view's snapshots either
 * side of it. valueAtAge applies the usual gap rule, so a video tracked only
 * daily has a 7-day figure but no 24-hour one.
 */
export function viewsAtAges(
  rows: AgePointRow[],
  publishedAt: Map<string, string | null>,
): Map<string, Partial<Record<number, number | null>>> {
  const out = new Map<string, Partial<Record<number, number | null>>>();
  for (const r of rows) {
    const key = videoKey(r.platform, r.external_id);
    const published = publishedAt.get(key);
    if (!published) continue;
    const points: { t: number; v: number }[] = [];
    const add = (at: string | null, v: number | null) => {
      if (at && v !== null && v !== undefined) points.push({ t: Date.parse(at), v: Number(v) });
    };
    add(r.hourly_before_at, r.hourly_before_views);
    add(r.hourly_after_at, r.hourly_after_views);
    add(r.daily_before_at, r.daily_before_views);
    add(r.daily_after_at, r.daily_after_views);
    const ages = out.get(key) ?? {};
    ages[r.age_hours] = valueAtAge(points, Date.parse(published), r.age_hours);
    out.set(key, ages);
  }
  return out;
}

type Measurable = {
  key: string;
  platform: MarketingPlatform;
  published_at: string | null;
  at: Partial<Record<number, number | null>>;
};

export type Typical = Record<MarketingPlatform, Record<IndexAge, { views: number | null; videos: number }>>;

/**
 * Each video's index at each age, and each platform's typical views. A video
 * is scored against the platform's most recent measured videos other than
 * itself, so a new post never pulls its own baseline up.
 */
export function indexVideos(
  videos: Measurable[],
  opts: { recent?: number; minOthers?: number } = {},
): { index: Map<string, Record<IndexAge, number | null>>; typical: Typical } {
  const recent = opts.recent ?? TYPICAL_OF;
  const minOthers = opts.minOthers ?? MIN_OTHERS;
  const index = new Map<string, Record<IndexAge, number | null>>();
  for (const v of videos) index.set(v.key, { 24: null, 168: null });
  const typical = {} as Typical;

  for (const platform of ["youtube", "instagram", "tiktok", "facebook"] as const) {
    typical[platform] = { 24: { views: null, videos: 0 }, 168: { views: null, videos: 0 } };
    for (const age of INDEX_AGES) {
      const measured = videos
        .filter((v) => v.platform === platform && v.published_at && typeof v.at[age] === "number")
        .sort((a, b) => b.published_at!.localeCompare(a.published_at!));
      const baseline = measured.slice(0, recent);
      typical[platform][age] = {
        views: median(baseline.map((v) => v.at[age]!)),
        videos: baseline.length,
      };
      for (const v of measured) {
        const others = baseline.filter((o) => o.key !== v.key).map((o) => o.at[age]!);
        if (others.length < minOthers) continue;
        const typ = median(others);
        if (typ && typ > 0) index.get(v.key)![age] = v.at[age]! / typ;
      }
    }
  }
  return { index, typical };
}

/** One platform's copy of a video, with everything the overview shows. */
export type OverviewVideo = {
  key: string;
  platform: MarketingPlatform;
  external_id: string;
  title: string | null;
  url: string | null;
  thumbnail_url: string | null;
  published_at: string | null;
  // Set when it went out through the planner; its tags then live on the post.
  postId: string | null;
  postName: string | null;
  tags: SocialTags;
  seconds: number | null;
  caption: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  avgWatchSeconds: number | null;
  avgViewPct: number | null;
  subscribersGained: number | null;
  at: Record<IndexAge, number | null>;
  index: Record<IndexAge, number | null>;
};

/** marketing_videos with 054's columns, which are absent until it runs. */
export type VideoRowWithTags = MarketingVideoRow & {
  tags?: unknown;
  duration_seconds?: number | string | null;
  caption?: string | null;
};

/** social_posts with the targets that went live, as the Stats page reads them. */
export type PostForOverview = {
  id: string;
  name: string;
  tags?: unknown;
  media_seconds?: number | string | null;
  targets: { platform: MarketingPlatform; external_id: string | null; caption: string | null }[];
};

const numOrNull = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * Everything the overview needs per video, from the tables: the latest daily
 * snapshot's numbers, views at each age, the index, and the tags, length and
 * caption, taken from the planner post where there is one.
 */
export function assembleVideos(input: {
  videos: VideoRowWithTags[];
  latest: Map<string, MarketingStatRow>;
  agePoints: AgePointRow[];
  posts: PostForOverview[];
}): { videos: OverviewVideo[]; typical: Typical } {
  const postOf = new Map<string, { post: PostForOverview; caption: string | null }>();
  for (const post of input.posts)
    for (const t of post.targets)
      if (t.external_id) postOf.set(videoKey(t.platform, t.external_id), { post, caption: t.caption });

  const published = new Map(input.videos.map((v) => [videoKey(v.platform, v.external_id), v.published_at]));
  const at = viewsAtAges(input.agePoints, published);
  const measurable = input.videos.map((v) => {
    const key = videoKey(v.platform, v.external_id);
    return { key, platform: v.platform, published_at: v.published_at, at: at.get(key) ?? {} };
  });
  const { index, typical } = indexVideos(measurable);

  const videos = input.videos.map((v): OverviewVideo => {
    const key = videoKey(v.platform, v.external_id);
    const s = input.latest.get(key);
    const linked = postOf.get(key);
    const ages = at.get(key) ?? {};
    return {
      key,
      platform: v.platform,
      external_id: v.external_id,
      title: v.title,
      url: v.url,
      thumbnail_url: v.thumbnail_url,
      published_at: v.published_at,
      postId: linked?.post.id ?? null,
      postName: linked?.post.name ?? null,
      tags: cleanTags(linked ? linked.post.tags : v.tags),
      seconds: numOrNull(linked?.post.media_seconds) ?? numOrNull(v.duration_seconds),
      caption: linked?.caption ?? v.caption ?? v.title,
      views: numOrNull(s?.views),
      likes: numOrNull(s?.likes),
      comments: numOrNull(s?.comments),
      shares: numOrNull(s?.shares),
      saves: numOrNull(s?.saves),
      avgWatchSeconds: numOrNull(s?.avg_watch_seconds),
      avgViewPct: numOrNull(s?.avg_view_pct),
      subscribersGained: numOrNull(s?.subscribers_gained),
      at: { 24: ages[24] ?? null, 168: ages[168] ?? null },
      index: index.get(key) ?? { 24: null, 168: null },
    };
  });
  return { videos, typical };
}

/** Average share of the video watched, 0 to 100: YouTube gives it, others need the length. */
export function watchedPct(v: Pick<OverviewVideo, "avgViewPct" | "avgWatchSeconds" | "seconds">): number | null {
  if (v.avgViewPct !== null) return Math.min(100, v.avgViewPct);
  if (v.avgWatchSeconds !== null && v.seconds) return Math.min(100, (v.avgWatchSeconds / v.seconds) * 100);
  return null;
}

/** A count per 1,000 views, or null under 100 views or where the platform has no such count. */
export function per1k(count: number | null, views: number | null): number | null {
  if (count === null || views === null || views < MIN_VIEWS_FOR_RATES) return null;
  return (count / views) * 1000;
}

export type HealthKey = "index" | "watched" | "shares" | "saves" | "follows";

export type HealthRow = {
  key: HealthKey;
  now: number | null;
  before: number | null;
  nNow: number;
  nBefore: number;
};

const DAY_MS = 86_400_000;

function measure(key: HealthKey, v: OverviewVideo, age: IndexAge): number | null {
  switch (key) {
    case "index":
      return v.index[age];
    case "watched":
      return watchedPct(v);
    case "shares":
      return per1k(v.shares, v.views);
    case "saves":
      return per1k(v.saves, v.views);
    case "follows":
      return per1k(v.subscribersGained, v.views);
  }
}

const inWindow = (v: OverviewVideo, from: number, to: number) => {
  const t = v.published_at ? Date.parse(v.published_at) : NaN;
  return t >= from && t < to;
};

/**
 * The middle video on each measure, for posts published in the last `days`
 * against the `days` before that. Medians, so one viral post can't carry a
 * month on its own.
 */
export function health(
  videos: OverviewVideo[],
  opts: { nowMs: number; days: number; age: IndexAge },
): HealthRow[] {
  const span = opts.days * DAY_MS;
  const now = videos.filter((v) => inWindow(v, opts.nowMs - span, opts.nowMs + DAY_MS));
  const before = videos.filter((v) => inWindow(v, opts.nowMs - 2 * span, opts.nowMs - span));
  return (["index", "watched", "shares", "saves", "follows"] as HealthKey[]).map((key) => {
    const a = now.map((v) => measure(key, v, opts.age)).filter((x): x is number => x !== null);
    const b = before.map((v) => measure(key, v, opts.age)).filter((x): x is number => x !== null);
    return { key, now: median(a), before: median(b), nNow: a.length, nBefore: b.length };
  });
}

export type StripRow = {
  platform: MarketingPlatform;
  dots: { key: string; title: string; index: number }[];
  median: number | null;
  posts: number;
};

/** Every video posted in the window with an index at `age`, one row per platform. */
export function strip(
  videos: OverviewVideo[],
  opts: { nowMs: number; days: number; age: IndexAge },
): StripRow[] {
  return (["youtube", "instagram", "tiktok", "facebook"] as const).map((platform) => {
    const mine = videos.filter(
      (v) => v.platform === platform && inWindow(v, opts.nowMs - opts.days * DAY_MS, opts.nowMs + DAY_MS),
    );
    const dots = mine
      .filter((v) => v.index[opts.age] !== null)
      .map((v) => ({ key: v.key, title: v.postName ?? v.title ?? "(untitled)", index: v.index[opts.age]! }));
    return { platform, dots, median: median(dots.map((d) => d.index)), posts: mine.length };
  });
}

/** One row of the posts table: a planner post with its platforms, or a lone video. */
export type OverviewRow = {
  id: string;
  postId: string | null;
  // Where its tags are saved: the post, or this one video.
  tagTarget: { postId: string | null; platform: MarketingPlatform; externalId: string };
  title: string;
  thumbnail: string | null;
  url: string | null;
  publishedAt: string | null;
  seconds: number | null;
  tags: SocialTags;
  auto: string[];
  videos: Partial<Record<MarketingPlatform, OverviewVideo>>;
  views: number | null;
  watched: number | null;
  shares1k: number | null;
  follows1k: number | null;
};

const SHORT_FORM_FIRST: MarketingPlatform[] = ["tiktok", "instagram", "facebook", "youtube"];

export function postRows(videos: OverviewVideo[]): OverviewRow[] {
  const groups = new Map<string, OverviewVideo[]>();
  for (const v of videos) {
    const id = v.postId ? `post:${v.postId}` : `video:${v.key}`;
    const list = groups.get(id);
    if (list) list.push(v);
    else groups.set(id, [v]);
  }

  const rows: OverviewRow[] = [];
  for (const [id, list] of groups) {
    const byPlatform: Partial<Record<MarketingPlatform, OverviewVideo>> = {};
    for (const v of list) byPlatform[v.platform] = v;
    const ordered = SHORT_FORM_FIRST.map((p) => byPlatform[p]).filter((v): v is OverviewVideo => !!v);
    const first = ordered[0];
    const publishedAt =
      list
        .map((v) => v.published_at)
        .filter((p): p is string => !!p)
        .sort()[0] ?? null;
    const seconds = list.find((v) => v.seconds !== null)?.seconds ?? null;
    const caption = ordered.find((v) => v.caption)?.caption ?? null;
    const views = list.some((v) => v.views !== null) ? list.reduce((s, v) => s + (v.views ?? 0), 0) : null;
    const mid = (f: (v: OverviewVideo) => number | null) =>
      median(list.map(f).filter((x): x is number => x !== null));
    rows.push({
      id,
      postId: first.postId,
      tagTarget: { postId: first.postId, platform: first.platform, externalId: first.external_id },
      title: first.postName ?? first.title ?? "(untitled)",
      thumbnail: ordered.find((v) => v.thumbnail_url)?.thumbnail_url ?? null,
      url: first.url,
      publishedAt,
      seconds,
      tags: first.tags,
      auto: autoTags({ publishedAt, seconds, caption }),
      videos: byPlatform,
      views,
      watched: mid(watchedPct),
      shares1k: mid((v) => per1k(v.shares, v.views)),
      follows1k: mid((v) => per1k(v.subscribersGained, v.views)),
    });
  }
  return rows.sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
}

/** The best index a row reached on any platform at `age`. */
export function bestIndex(row: OverviewRow, age: IndexAge): number | null {
  const all = Object.values(row.videos)
    .map((v) => v?.index[age] ?? null)
    .filter((x): x is number => x !== null);
  return all.length ? Math.max(...all) : null;
}

/** The five steps of the index's colour scale, shared by badges, dots and cells. */
export type IndexTone = "well-above" | "above" | "typical" | "below" | "well-below";

export function indexTone(x: number): IndexTone {
  if (x >= 1.5) return "well-above";
  if (x >= 1.1) return "above";
  if (x > 0.9) return "typical";
  if (x > 0.67) return "below";
  return "well-below";
}

/** 1.2x, 12x. */
export function formatIndex(x: number | null): string {
  if (x === null) return "-";
  return `${x >= 10 ? Math.round(x) : x.toFixed(1)}x`;
}
