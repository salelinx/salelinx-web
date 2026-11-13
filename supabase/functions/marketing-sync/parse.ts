// Turns each platform's API answer into one shape, kept free of fetch and Deno
// so vitest can run it.

export type Platform = "youtube" | "instagram" | "tiktok" | "facebook";

export type SyncedVideo = {
  externalId: string;
  title: string | null;
  url: string | null;
  thumbnailUrl: string | null;
  publishedAt: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  // Lifetime figures only some platforms give (052_social.sql); null elsewhere.
  reach?: number | null;
  saves?: number | null;
  watchSeconds?: number | null;
  avgWatchSeconds?: number | null;
  avgViewPct?: number | null;
  subscribersGained?: number | null;
};

/** What YouTube Analytics adds per video, keyed by video id. */
export type YouTubeAnalytics = {
  shares: number | null;
  watchSeconds: number | null;
  avgWatchSeconds: number | null;
  avgViewPct: number | null;
  subscribersGained: number | null;
};

export type SyncedAccount = {
  handle: string | null;
  externalId: string | null;
  followers: number | null;
  videos: SyncedVideo[];
};

// deno-lint-ignore no-explicit-any
type Json = any;

/** A count from an API that may send it as a string, or not at all (hidden likes). */
export function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Milliseconds as seconds to one decimal, for averages (a NUMERIC column). */
const ms = (v: unknown): number | null => {
  const n = num(v);
  return n === null ? null : Math.round(n / 100) / 10;
};

/** Milliseconds as whole seconds, for totals: watch_seconds is a BIGINT. */
const wholeSeconds = (v: unknown): number | null => {
  const n = num(v);
  return n === null ? null : Math.round(n / 1000);
};

const firstLine = (text: unknown): string | null => {
  const line = String(text ?? "")
    .split("\n")[0]
    .trim();
  return line ? line.slice(0, 200) : null;
};

/** videos.list items (part=snippet,statistics). YouTube has no share count. */
export function parseYouTubeVideos(items: Json[]): SyncedVideo[] {
  return items.map((v) => ({
    externalId: v.id,
    title: v.snippet?.title ?? null,
    url: `https://www.youtube.com/watch?v=${v.id}`,
    thumbnailUrl:
      v.snippet?.thumbnails?.medium?.url ??
      v.snippet?.thumbnails?.default?.url ??
      null,
    publishedAt: v.snippet?.publishedAt ?? null,
    views: num(v.statistics?.viewCount),
    likes: num(v.statistics?.likeCount),
    comments: num(v.statistics?.commentCount),
    shares: null,
  }));
}

/** /me/media items, with each one's insights (metric name to value) where they were read. */
export function parseInstagramMedia(
  media: Json[],
  insights: Map<string, Record<string, number>>,
): SyncedVideo[] {
  return media.map((m) => {
    const ins = insights.get(m.id) ?? {};
    return {
      externalId: m.id,
      title: firstLine(m.caption),
      url: m.permalink ?? null,
      // A video's media_url is the file; its thumbnail_url is the still.
      thumbnailUrl:
        m.thumbnail_url ??
        (m.media_type === "IMAGE" ? m.media_url : null) ??
        null,
      publishedAt: m.timestamp ?? null,
      views: num(ins.views),
      likes: num(m.like_count),
      comments: num(m.comments_count),
      shares: num(ins.shares),
      reach: num(ins.reach),
      saves: num(ins.saved),
      // Reels only, and in milliseconds.
      watchSeconds: wholeSeconds(ins.ig_reels_video_view_total_time),
      avgWatchSeconds: ms(ins.ig_reels_avg_watch_time),
    };
  });
}

/** One media's insights answer: data[] of { name, values: [{ value }] } or { total_value: { value } }. */
export function parseInstagramInsights(body: Json): Record<string, number> {
  const out: Record<string, number> = {};
  for (const metric of body?.data ?? []) {
    const value = metric.total_value?.value ?? metric.values?.[0]?.value;
    const n = num(value);
    if (metric.name && n !== null) out[metric.name] = n;
  }
  return out;
}

/**
 * A YouTube Analytics reports answer with dimensions=video: columnHeaders name
 * each column, rows are [videoId, ...metrics]. estimatedMinutesWatched is in
 * minutes, averageViewDuration in seconds, averageViewPercentage 0-100.
 */
export function parseYouTubeAnalytics(body: Json): Map<string, YouTubeAnalytics> {
  const cols: string[] = (body?.columnHeaders ?? []).map((c: Json) => c.name);
  const at = (row: Json[], name: string) => {
    const i = cols.indexOf(name);
    return i < 0 ? null : num(row[i]);
  };
  const out = new Map<string, YouTubeAnalytics>();
  for (const row of body?.rows ?? []) {
    const id = row[cols.indexOf("video")];
    if (!id) continue;
    const minutes = at(row, "estimatedMinutesWatched");
    out.set(String(id), {
      shares: at(row, "shares"),
      watchSeconds: minutes === null ? null : Math.round(minutes * 60),
      avgWatchSeconds: at(row, "averageViewDuration"),
      avgViewPct: at(row, "averageViewPercentage"),
      subscribersGained: at(row, "subscribersGained"),
    });
  }
  return out;
}

/** Facebook's time format, which writes the offset without a colon (+0000). */
function fbTime(t: unknown): string | null {
  if (!t) return null;
  const d = new Date(String(t).replace(/([+-]\d\d)(\d\d)$/, "$1:$2"));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * A Page's /video_reels items (likes and comments as summaries), with each
 * one's video_insights by metric name. Plays are fb_reels_total_plays, or the
 * older blue_reels_play_count; times are in milliseconds. Facebook gives no
 * share count for a Reel here.
 */
export function parseFacebookReels(
  items: Json[],
  insights: Map<string, Record<string, number>>,
): SyncedVideo[] {
  return items.map((v) => {
    const id = String(v.id);
    const ins = insights.get(id) ?? {};
    const link = v.permalink_url
      ? String(v.permalink_url).startsWith("http")
        ? v.permalink_url
        : `https://www.facebook.com${v.permalink_url}`
      : `https://www.facebook.com/reel/${id}`;
    return {
      externalId: id,
      title: firstLine(v.description ?? v.title),
      url: link,
      thumbnailUrl: v.picture ?? null,
      publishedAt: fbTime(v.created_time),
      views: num(ins.fb_reels_total_plays ?? ins.blue_reels_play_count),
      likes: num(v.likes?.summary?.total_count),
      comments: num(v.comments?.summary?.total_count),
      shares: null,
      reach: num(ins.post_impressions_unique),
      watchSeconds: wholeSeconds(ins.post_video_view_time),
      avgWatchSeconds: ms(ins.post_video_avg_time_watched),
    };
  });
}

/** video/list videos. */
export function parseTikTokVideos(videos: Json[]): SyncedVideo[] {
  return videos.map((v) => ({
    externalId: String(v.id),
    title: firstLine(v.title || v.video_description),
    url: v.share_url ?? null,
    thumbnailUrl: v.cover_image_url ?? null,
    publishedAt: v.create_time
      ? new Date(v.create_time * 1000).toISOString()
      : null,
    views: num(v.view_count),
    likes: num(v.like_count),
    comments: num(v.comment_count),
    shares: num(v.share_count),
  }));
}
