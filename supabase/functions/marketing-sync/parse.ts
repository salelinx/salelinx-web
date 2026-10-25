// Turns each platform's API answer into one shape, kept free of fetch and Deno
// so vitest can run it.

export type Platform = "youtube" | "instagram" | "tiktok";

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
