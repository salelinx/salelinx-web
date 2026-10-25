// /admin/marketing arithmetic: growth from the daily snapshots marketing-sync
// writes. Pure, so tests can run it without a database.

export type MarketingPlatform = "youtube" | "instagram" | "tiktok";

export const MARKETING_PLATFORMS: MarketingPlatform[] = [
  "youtube",
  "instagram",
  "tiktok",
];

export type MarketingVideoRow = {
  platform: MarketingPlatform;
  external_id: string;
  title: string | null;
  url: string | null;
  thumbnail_url: string | null;
  published_at: string | null;
};

export type MarketingStatRow = {
  platform: MarketingPlatform;
  external_id: string;
  day: string;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
};

export type MarketingFollowerRow = {
  platform: MarketingPlatform;
  day: string;
  followers: number | null;
};

export type MarketingVideo = MarketingVideoRow & {
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  // Views gained in the last day / 7 days; null until there is a snapshot from before then.
  gained1: number | null;
  gained7: number | null;
};

export type MarketingPlatformSummary = {
  platform: MarketingPlatform;
  followers: number | null;
  followersGained30: number | null;
  videos: number;
  views: number;
  gained7: number;
  gained30: number;
  // Some videos have no snapshot old enough, so the gains are a floor.
  partial7: boolean;
  partial30: boolean;
};

export type MarketingReport = {
  platforms: MarketingPlatformSummary[];
  daily: { day: string; views: number }[];
  videos: MarketingVideo[];
  firstDay: string | null;
};

/** "YYYY-MM-DD" `n` days before `day`. */
export function daysBefore(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

const key = (platform: string, id: string) => `${platform}:${id}`;

/** Likes, comments and shares per view. Under 100 views one like swings it too far to rank on. */
export function engagementRate(
  v: Pick<MarketingVideo, "views" | "likes" | "comments" | "shares">,
): number | null {
  if (!v.views || v.views < 100) return null;
  return ((v.likes ?? 0) + (v.comments ?? 0) + (v.shares ?? 0)) / v.views;
}

/** A video's views gained since `from`: today's less the last snapshot on or before `from`. */
function gainedSince(
  snaps: MarketingStatRow[],
  from: string,
  publishedAt: string | null,
): number | null {
  const latest = snaps[snaps.length - 1];
  if (!latest || latest.views === null) return null;
  let base: MarketingStatRow | undefined;
  for (const s of snaps) if (s.day <= from) base = s;
  if (base && base.views !== null)
    return Math.max(0, latest.views - base.views);
  // Posted inside the window: every view it has came in it.
  if (publishedAt && publishedAt.slice(0, 10) > from) return latest.views;
  return null;
}

export function buildMarketingReport(input: {
  videos: MarketingVideoRow[];
  stats: MarketingStatRow[];
  followers: MarketingFollowerRow[];
  today: string;
  days?: number;
}): MarketingReport {
  const { videos, stats, followers, today } = input;
  const days = input.days ?? 30;

  const byVideo = new Map<string, MarketingStatRow[]>();
  for (const s of [...stats].sort((a, b) => a.day.localeCompare(b.day))) {
    const k = key(s.platform, s.external_id);
    byVideo.set(k, [...(byVideo.get(k) ?? []), s]);
  }

  const from1 = daysBefore(today, 1);
  const from7 = daysBefore(today, 7);
  const from30 = daysBefore(today, 30);
  const rows: MarketingVideo[] = videos.map((v) => {
    const snaps = byVideo.get(key(v.platform, v.external_id)) ?? [];
    const latest = snaps[snaps.length - 1];
    return {
      ...v,
      views: latest?.views ?? null,
      likes: latest?.likes ?? null,
      comments: latest?.comments ?? null,
      shares: latest?.shares ?? null,
      gained1: gainedSince(snaps, from1, v.published_at),
      gained7: gainedSince(snaps, from7, v.published_at),
    };
  });

  const platforms = MARKETING_PLATFORMS.map((platform) => {
    const mine = videos.filter((v) => v.platform === platform);
    let gained7 = 0;
    let gained30 = 0;
    let partial7 = false;
    let partial30 = false;
    let views = 0;
    for (const v of mine) {
      const snaps = byVideo.get(key(platform, v.external_id)) ?? [];
      views += snaps[snaps.length - 1]?.views ?? 0;
      const g7 = gainedSince(snaps, from7, v.published_at);
      const g30 = gainedSince(snaps, from30, v.published_at);
      if (g7 === null) partial7 = true;
      else gained7 += g7;
      if (g30 === null) partial30 = true;
      else gained30 += g30;
    }
    const counts = followers
      .filter((f) => f.platform === platform && f.followers !== null)
      .sort((a, b) => a.day.localeCompare(b.day));
    const now = counts[counts.length - 1];
    const then = [...counts].reverse().find((f) => f.day <= from30);
    return {
      platform,
      followers: now?.followers ?? null,
      followersGained30: now && then ? now.followers! - then.followers! : null,
      videos: mine.length,
      views,
      gained7,
      gained30,
      partial7,
      partial30,
    };
  });

  // Views gained each day across everything: each video's day-on-day change,
  // counted only where the day before was snapshotted too.
  const daily = Array.from({ length: days }, (_, i) => {
    const day = daysBefore(today, days - 1 - i);
    let total = 0;
    for (const snaps of byVideo.values()) {
      const at = snaps.find((s) => s.day === day);
      const prev = snaps.find((s) => s.day === daysBefore(day, 1));
      if (at?.views != null && prev?.views != null)
        total += Math.max(0, at.views - prev.views);
    }
    return { day, views: total };
  });

  const firstDay = stats.length
    ? stats.reduce((m, s) => (s.day < m ? s.day : m), stats[0].day)
    : null;
  return { platforms, daily, videos: rows, firstDay };
}
