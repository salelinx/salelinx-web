// Reads each platform's account and videos. YouTube needs only an API key;
// Instagram and TikTok use the login stored by marketing-oauth, renewed here
// before it runs out.

import {
  parseInstagramInsights,
  parseInstagramMedia,
  parseTikTokVideos,
  parseYouTubeVideos,
  type SyncedAccount,
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

export type Login = {
  accessToken: string;
  accessExpiresAt: string | null;
  refreshToken?: string | null;
};

/** A long-lived Instagram token lasts 60 days; refreshing gives another 60. */
export async function refreshInstagram(login: Login): Promise<Login> {
  const body = await getJson(
    `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${login.accessToken}`,
  );
  return {
    accessToken: body.access_token,
    accessExpiresAt: new Date(
      Date.now() + body.expires_in * 1000,
    ).toISOString(),
  };
}

export async function syncInstagram(token: string): Promise<SyncedAccount> {
  const base = "https://graph.instagram.com";
  const me = await getJson(
    `${base}/me?fields=user_id,username,followers_count&access_token=${token}`,
  );

  // deno-lint-ignore no-explicit-any
  const media: any[] = [];
  let next: string | null =
    `${base}/me/media?fields=id,caption,media_type,media_product_type,permalink,thumbnail_url,media_url,timestamp,like_count,comments_count&limit=50&access_token=${token}`;
  while (next && media.length < MAX_VIDEOS) {
    const page = await getJson(next);
    media.push(...(page.data ?? []));
    next = page.paging?.next ?? null;
  }

  // One call per post, so only the newest get insights; older ones keep their likes and comments.
  const insights = new Map<string, Record<string, number>>();
  for (const m of media.slice(0, MAX_INSIGHTS)) {
    try {
      const body = await getJson(
        `${base}/${m.id}/insights?metric=views,shares&access_token=${token}`,
      );
      insights.set(m.id, parseInstagramInsights(body));
    } catch {
      // Some media types have no insights; the post is still listed.
    }
  }

  return {
    handle: me.username ? `@${me.username}` : null,
    externalId: me.user_id ? String(me.user_id) : (me.id ?? null),
    followers: me.followers_count ?? null,
    videos: parseInstagramMedia(media, insights),
  };
}

/** A TikTok access token lasts a day; the refresh token a year, renewed on each use. */
export async function refreshTikTok(
  login: Login,
  clientKey: string,
  clientSecret: string,
): Promise<Login & { refreshExpiresAt: string | null }> {
  const body = await getJson("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: login.refreshToken ?? "",
    }),
  });
  if (!body.access_token)
    throw new Error(body.error_description ?? "TikTok refresh failed");
  return {
    accessToken: body.access_token,
    accessExpiresAt: new Date(
      Date.now() + body.expires_in * 1000,
    ).toISOString(),
    refreshToken: body.refresh_token,
    refreshExpiresAt: new Date(
      Date.now() + body.refresh_expires_in * 1000,
    ).toISOString(),
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
