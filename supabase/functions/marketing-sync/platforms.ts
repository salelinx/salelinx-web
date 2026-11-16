// Reads each platform's account and videos. YouTube's public stats need only an
// API key; Instagram, TikTok and YouTube Analytics use the logins
// marketing-oauth stored (renewed by _shared/marketing-login.ts).

import {
  parseFacebookReels,
  parseInstagramInsights,
  parseInstagramMedia,
  parseTikTokVideos,
  parseYouTubeAnalytics,
  parseYouTubeVideos,
  type SyncedAccount,
  type YouTubeAnalytics,
} from "./parse.ts";

// Caps per sync, far above today's volume, so a big account can't run the
// function past its time limit or spend the day's quota.
const MAX_VIDEOS = 500;
const MAX_INSIGHTS = 100;

// deno-lint-ignore no-explicit-any
async function getJson(url: string, init?: RequestInit): Promise<any> {
  const res = await fetch(url, init);
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const msg =
      body?.error?.message ??
      body?.error_description ??
      body?.error?.code ??
      res.statusText;
    throw new Error(`${res.status} ${msg}`);
  }
  return body;
}

export async function syncYouTube(
  apiKey: string,
  handle: string,
): Promise<SyncedAccount> {
  const base = "https://www.googleapis.com/youtube/v3";
  const at = handle.startsWith("@") ? handle : `@${handle}`;
  const channels = await getJson(
    `${base}/channels?part=id,statistics,contentDetails&forHandle=${encodeURIComponent(at)}&key=${apiKey}`,
  );
  const channel = channels.items?.[0];
  if (!channel) throw new Error(`No YouTube channel ${at}`);
  const uploads = channel.contentDetails?.relatedPlaylists?.uploads;

  const ids: string[] = [];
  let pageToken = "";
  while (uploads && ids.length < MAX_VIDEOS) {
    const page = await getJson(
      `${base}/playlistItems?part=contentDetails&maxResults=50&playlistId=${uploads}&key=${apiKey}` +
        (pageToken ? `&pageToken=${pageToken}` : ""),
    );
    for (const item of page.items ?? []) ids.push(item.contentDetails.videoId);
    pageToken = page.nextPageToken ?? "";
    if (!pageToken) break;
  }

  const videos = [];
  for (let i = 0; i < ids.length; i += 50) {
    const batch = await getJson(
      `${base}/videos?part=snippet,statistics&id=${ids.slice(i, i + 50).join(",")}&key=${apiKey}`,
    );
    videos.push(...parseYouTubeVideos(batch.items ?? []));
  }
  return {
    handle: at,
    externalId: channel.id,
    followers: channel.statistics?.hiddenSubscriberCount
      ? null
      : Number(channel.statistics?.subscriberCount ?? 0),
    videos,
  };
}

/**
 * Lifetime watch time, view percentage, subscribers gained and shares for the
 * channel's 200 most viewed videos, from YouTube Analytics with the YouTube
 * login (yt-analytics.readonly). Analytics runs two or three days behind the
 * public counts.
 */
export async function fetchYouTubeAnalytics(
  token: string,
): Promise<Map<string, YouTubeAnalytics>> {
  const today = new Date().toISOString().slice(0, 10);
  const body = await getJson(
    "https://youtubeanalytics.googleapis.com/v2/reports?" +
      new URLSearchParams({
        ids: "channel==MINE",
        startDate: "2020-01-01",
        endDate: today,
        metrics:
          "views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,subscribersGained,shares",
        dimensions: "video",
        sort: "-views",
        maxResults: "200",
      }),
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return parseYouTubeAnalytics(body);
}

/**
 * Our Instagram account through the Facebook Page it is linked to: the Page's
 * token and the Instagram account id marketing-oauth saved, on the Graph API.
 */
export async function syncInstagram(token: string, igUserId: string): Promise<SyncedAccount> {
  const base = "https://graph.facebook.com/v24.0";
  const me = await getJson(
    `${base}/${igUserId}?fields=id,username,followers_count&access_token=${token}`,
  );

  // deno-lint-ignore no-explicit-any
  const media: any[] = [];
  let next: string | null =
    `${base}/${igUserId}/media?fields=id,caption,media_type,media_product_type,permalink,thumbnail_url,media_url,timestamp,like_count,comments_count&limit=50&access_token=${token}`;
  while (next && media.length < MAX_VIDEOS) {
    const page = await getJson(next);
    media.push(...(page.data ?? []));
    next = page.paging?.next ?? null;
  }

  // One call per post, so only the newest get insights; older ones keep their
  // likes and comments. Reels also have watch time, which asking for on any
  // other kind of post fails the whole call, hence the fallback.
  const insights = new Map<string, Record<string, number>>();
  const baseMetrics = "views,shares,reach,saved";
  const reelsMetrics = `${baseMetrics},ig_reels_avg_watch_time,ig_reels_video_view_total_time`;
  for (const m of media.slice(0, MAX_INSIGHTS)) {
    const asks =
      m.media_product_type === "REELS"
        ? [reelsMetrics, baseMetrics]
        : [baseMetrics, "views,shares"];
    for (const metric of asks) {
      try {
        const body = await getJson(
          `${base}/${m.id}/insights?metric=${metric}&access_token=${token}`,
        );
        insights.set(m.id, parseInstagramInsights(body));
        break;
      } catch {
        // Some media types lack some metrics, or have no insights at all; the
        // post is still listed.
      }
    }
  }

  return {
    handle: me.username ? `@${me.username}` : null,
    externalId: me.user_id ? String(me.user_id) : (me.id ?? null),
    followers: me.followers_count ?? null,
    videos: parseInstagramMedia(media, insights),
  };
}

/**
 * Our Facebook Page with its Page token: followers, and every Reel with likes
 * and comments, plus plays, reach and watch time from the newest ones'
 * video_insights. If the likes and comments summaries are refused, the Reels
 * are still listed without them.
 */
export async function syncFacebook(
  token: string,
  pageId: string,
): Promise<SyncedAccount> {
  const base = "https://graph.facebook.com/v24.0";
  const page = await getJson(
    `${base}/${pageId}?fields=id,name,username,followers_count,fan_count&access_token=${token}`,
  );

  const full =
    "id,description,created_time,permalink_url,picture,likes.summary(true).limit(0),comments.summary(true).limit(0)";
  const basic = "id,description,created_time,permalink_url,picture";
  // deno-lint-ignore no-explicit-any
  const items: any[] = [];
  for (const fields of [full, basic]) {
    items.length = 0;
    try {
      let next: string | null =
        `${base}/${pageId}/video_reels?fields=${fields}&limit=50&access_token=${token}`;
      while (next && items.length < MAX_VIDEOS) {
        const p = await getJson(next);
        items.push(...(p.data ?? []));
        next = p.paging?.next ?? null;
      }
      break;
    } catch (err) {
      if (fields === basic) throw err;
    }
  }

  const insights = new Map<string, Record<string, number>>();
  for (const v of items.slice(0, MAX_INSIGHTS)) {
    for (const metric of [
      "fb_reels_total_plays,post_impressions_unique,post_video_avg_time_watched,post_video_view_time",
      "blue_reels_play_count",
    ]) {
      try {
        const body = await getJson(
          `${base}/${v.id}/video_insights?metric=${metric}&access_token=${token}`,
        );
        insights.set(String(v.id), parseInstagramInsights(body));
        break;
      } catch {
        // Older or still-processing Reels may have none; the Reel is still listed.
      }
    }
  }

  return {
    handle: page.username ? `@${page.username}` : (page.name ?? null),
    externalId: String(page.id),
    followers: page.followers_count ?? page.fan_count ?? null,
    videos: parseFacebookReels(items, insights),
  };
}

export async function syncTikTok(token: string): Promise<SyncedAccount> {
  const auth = { Authorization: `Bearer ${token}` };
  const user = await getJson(
    "https://open.tiktokapis.com/v2/user/info/?fields=open_id,username,follower_count",
    { headers: auth },
  );
  const u = user.data?.user ?? {};

  // deno-lint-ignore no-explicit-any
  const videos: any[] = [];
  let cursor: number | undefined;
  while (videos.length < MAX_VIDEOS) {
    const page = await getJson(
      "https://open.tiktokapis.com/v2/video/list/?fields=id,title,video_description,create_time,cover_image_url,share_url,view_count,like_count,comment_count,share_count",
      {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({ max_count: 20, ...(cursor ? { cursor } : {}) }),
      },
    );
    videos.push(...(page.data?.videos ?? []));
    if (!page.data?.has_more) break;
    cursor = page.data.cursor;
  }

  return {
    handle: u.username ? `@${u.username}` : null,
    externalId: u.open_id ?? null,
    followers: u.follower_count ?? null,
    videos: parseTikTokVideos(videos),
  };
}
