// deno-lint-ignore-file no-explicit-any
// One step of posting a video to each platform. index.ts claims a target and
// calls the step for its platform; a step either finishes the post, says when
// to check again, or fails. Steps never write to the database themselves
// except through ctx.markSending(), which flags the moment a retry could post
// twice.

import {
  facebookNext,
  instagramNext,
  instagramTrialParams,
  tiktokChunks,
  tiktokNext,
  youtubeChunks,
  youtubeStatus,
  type Chunk,
  type InstagramOptions,
  type YouTubeOptions,
} from "./plan.ts";

export type Claimed = {
  post_id: string;
  platform: "youtube" | "instagram" | "tiktok" | "facebook";
  status: "pending" | "processing" | "inbox";
  title: string | null;
  caption: string | null;
  options: Record<string, unknown>;
  job: Record<string, any>;
  attempts: number;
  scheduled_at: string;
  media_path: string | null;
  media_bytes: number | null;
  media_type: string | null;
  cover_path: string | null;
  post_name: string;
  experiment_id: string | null;
  variant: string | null;
};

export type Media = {
  size: number;
  type: string;
  // Signed, so a platform that fetches the file itself (Instagram) can.
  url: string;
  range(chunk: Chunk): Promise<Uint8Array<ArrayBuffer>>;
};

export type Ctx = {
  token: string;
  accountId: string | null;
  handle: string | null;
  media: () => Promise<Media>;
  cover: () => Promise<Media | null>;
  markSending: () => Promise<void>;
  now: number;
};

export type Outcome =
  | {
      status: "processing" | "inbox";
      job: Record<string, unknown>;
      checkInSeconds: number;
    }
  | {
      status: "published";
      externalId: string | null;
      url: string | null;
      publishedAt: string;
      job: Record<string, unknown>;
    }
  | { status: "failed"; error: string; job?: Record<string, unknown> };

/** Worth trying again later: the network, a 429 or a 5xx, before anything irreversible. */
export class Transient extends Error {}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function errorText(body: any, res: Response): string {
  return (
    body?.error?.message ??
    body?.error_description ??
    body?.error?.code ??
    (typeof body?.error === "string" ? body.error : null) ??
    res.statusText ??
    String(res.status)
  );
}

/** JSON call that sorts failures into Transient and final. */
async function call(url: string, init: RequestInit = {}): Promise<any> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (err) {
    throw new Transient(`network: ${(err as Error).message}`);
  }
  const body = await res.json().catch(() => null);
  if (res.status === 429 || res.status >= 500)
    throw new Transient(`${res.status} ${errorText(body, res)}`);
  if (!res.ok) throw new Error(`${res.status} ${errorText(body, res)}`);
  // TikTok answers 200 with error.code other than "ok" for some failures.
  if (body?.error?.code && body.error.code !== "ok")
    throw new Error(`${body.error.code} ${body.error.message ?? ""}`.trim());
  return body;
}

// ---------------------------------------------------------------------------
// YouTube: one resumable upload, in 8 MiB pieces. Claimed an hour early and
// uploaded private with publishAt, so YouTube publishes it on time itself.
// ---------------------------------------------------------------------------

export async function stepYouTube(t: Claimed, ctx: Ctx): Promise<Outcome> {
  const media = await ctx.media();
  const opts = t.options as YouTubeOptions;
  const plan = youtubeStatus(opts, t.scheduled_at, ctx.now);
  await ctx.markSending();

  const init = await fetch(
    "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status" +
      (opts.notifySubscribers === false ? "&notifySubscribers=false" : ""),
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ctx.token}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Length": String(media.size),
        "X-Upload-Content-Type": media.type,
      },
      body: JSON.stringify({
        snippet: {
          title: (t.title || t.post_name).slice(0, 100),
          description: t.caption ?? "",
          tags: opts.tags ?? [],
          categoryId: opts.categoryId ?? "28",
        },
        status: {
          privacyStatus: plan.privacyStatus,
          ...(plan.publishAt ? { publishAt: plan.publishAt } : {}),
          selfDeclaredMadeForKids: opts.madeForKids ?? false,
        },
      }),
    },
  ).catch((err) => {
    throw new Transient(`network: ${err.message}`);
  });
  const session = init.headers.get("Location");
  if (!init.ok || !session) {
    const body = await init.json().catch(() => null);
    const msg = `${init.status} ${errorText(body, init)}`;
    if (init.status === 429 || init.status >= 500) throw new Transient(msg);
    throw new Error(`YouTube refused the upload: ${msg}`);
  }

  // The video only exists once the last piece lands, so a failure before
  // that is safe to retry; a lost answer to the last piece is not.
  const chunks = youtubeChunks(media.size);
  let video: any = null;
  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i];
    const last = i === chunks.length - 1;
    const bytes = await media.range(c);
    let res: Response;
    try {
      res = await fetch(session, {
        method: "PUT",
        redirect: "manual",
        headers: {
          "Content-Length": String(bytes.length),
          "Content-Range": `bytes ${c.start}-${c.end}/${media.size}`,
        },
        body: bytes,
      });
    } catch (err) {
      if (last)
        return {
          status: "failed",
          error: `The last piece of the upload got no answer (${(err as Error).message}). Check YouTube Studio before retrying: it may have posted.`,
        };
      throw new Transient(`network: ${(err as Error).message}`);
    }
    if (!last) {
      await res.body?.cancel();
      if (res.status !== 308) {
        if (res.status >= 500) throw new Transient(`upload ${res.status}`);
        throw new Error(`YouTube stopped the upload: ${res.status}`);
      }
      continue;
    }
    video = await res.json().catch(() => null);
    if (!res.ok || !video?.id) {
      return {
        status: "failed",
        error: `YouTube's answer to the last piece was ${res.status}. Check YouTube Studio before retrying: it may have posted.`,
      };
    }
  }

  const job: Record<string, unknown> = { publish_at: plan.publishAt ?? null };
  if (plan.privacyStatus === "public" && video.status?.privacyStatus === "private") {
    job.note =
      "YouTube kept it private. Uploads from an unaudited API project are locked to private; see docs/SOCIAL.md.";
  }

  const cover = await ctx.cover();
  if (cover) {
    try {
      const bytes = await cover.range({ start: 0, end: cover.size - 1 });
      await call(
        `https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${video.id}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${ctx.token}`, "Content-Type": cover.type },
          body: bytes,
        },
      );
    } catch (err) {
      // Custom thumbnails need a verified channel; the video is still up.
      job.note = `${job.note ? `${job.note} ` : ""}Thumbnail not set: ${(err as Error).message}`;
    }
  }

  return {
    status: "published",
    externalId: video.id,
    url: `https://www.youtube.com/watch?v=${video.id}`,
    publishedAt: plan.publishAt ?? new Date(ctx.now).toISOString(),
    job,
  };
}

// ---------------------------------------------------------------------------
// Instagram: a Reels container that Instagram fetches from a signed URL, then
// media_publish once it is FINISHED. Instagram has no publish time of its own,
// so this runs at the scheduled time.
// ---------------------------------------------------------------------------

// Through the Facebook Page the account is linked to, with the Page's token.
const IG = "https://graph.facebook.com/v24.0";

async function instagramPublish(
  t: Claimed,
  ctx: Ctx,
  account: string,
  containerId: string,
): Promise<Outcome> {
  await ctx.markSending();
  let mediaId: string;
  try {
    const body = await call(`${IG}/${account}/media_publish`, {
      method: "POST",
      body: new URLSearchParams({ creation_id: containerId, access_token: ctx.token }),
    });
    mediaId = String(body.id);
  } catch (err) {
    return {
      status: "failed",
      error: `Publishing failed (${(err as Error).message}). Check Instagram before retrying: it may have posted.`,
    };
  }
  let url: string | null = null;
  try {
    const m = await call(`${IG}/${mediaId}?fields=permalink&access_token=${ctx.token}`);
    url = m.permalink ?? null;
  } catch {
    // The post is live; the link fills in on the next stats sync.
  }
  return {
    status: "published",
    externalId: mediaId,
    url,
    publishedAt: new Date(ctx.now).toISOString(),
    job: { ...t.job },
  };
}

export async function stepInstagram(t: Claimed, ctx: Ctx): Promise<Outcome> {
  const account = ctx.accountId;
  if (!account) return { status: "failed", error: "Instagram isn't linked. Reconnect it." };
  const opts = t.options as InstagramOptions;
  let job = { ...t.job };

  if (t.status === "pending") {
    const media = await ctx.media();
    const cover = await ctx.cover();
    const form = new URLSearchParams({
      media_type: "REELS",
      video_url: media.url,
      caption: t.caption ?? "",
      access_token: ctx.token,
    });
    const trial = instagramTrialParams(opts);
    if (trial) form.set("trial_params", JSON.stringify(trial));
    else form.set("share_to_feed", String(opts.shareToFeed ?? true));
    if (cover) form.set("cover_url", cover.url);
    const body = await call(`${IG}/${account}/media`, { method: "POST", body: form });
    job = { container_id: String(body.id), container_at: new Date(ctx.now).toISOString() };
  }

  // Short Reels are often ready in under a minute, so wait a little here
  // before leaving it to the next run.
  for (let i = 0; i < 8; i++) {
    const c = await call(
      `${IG}/${job.container_id}?fields=status_code,status&access_token=${ctx.token}`,
    );
    const next = instagramNext(c.status_code, c.status, job.container_at, Date.now());
    if (next.kind === "publish") return instagramPublish(t, ctx, account, job.container_id);
    if (next.kind === "failed") return { status: "failed", error: next.error, job };
    if (next.kind === "published")
      return {
        status: "published",
        externalId: null,
        url: null,
        publishedAt: new Date(ctx.now).toISOString(),
        job: { ...job, note: "Instagram says this was already published. Check the account." },
      };
    if (i < 7) await sleep(6000);
  }
  return { status: "processing", job, checkInSeconds: 60 };
}

// ---------------------------------------------------------------------------
// Facebook: a Reel on our Page. start opens an upload, Meta fetches the file
// from a signed URL (file_url), finish publishes it, then the next checks
// follow it until Facebook says it is live. Posted at the scheduled time:
// Meta's own docs disagree on whether Reels can be scheduled ahead.
// ---------------------------------------------------------------------------

const FBG = "https://graph.facebook.com/v24.0";

export async function stepFacebook(t: Claimed, ctx: Ctx): Promise<Outcome> {
  const page = ctx.accountId;
  if (!page) return { status: "failed", error: "Facebook isn't linked to a Page. Reconnect it." };
  let job = { ...t.job };

  if (t.status === "pending") {
    const media = await ctx.media();
    const start = await call(`${FBG}/${page}/video_reels`, {
      method: "POST",
      body: new URLSearchParams({ upload_phase: "start", access_token: ctx.token }),
    });
    const videoId = String(start.video_id ?? "");
    if (!videoId) throw new Error("Facebook gave no upload id");
    const upload = await call(`https://rupload.facebook.com/video-upload/v24.0/${videoId}`, {
      method: "POST",
      headers: { Authorization: `OAuth ${ctx.token}`, file_url: media.url },
    });
    if (!upload?.success) throw new Error("Facebook didn't take the file");

    // Publishing has no idempotency key, so a lost answer here must not be
    // retried blind.
    await ctx.markSending();
    try {
      await call(`${FBG}/${page}/video_reels`, {
        method: "POST",
        body: new URLSearchParams({
          upload_phase: "finish",
          video_id: videoId,
          video_state: "PUBLISHED",
          description: t.caption ?? "",
          access_token: ctx.token,
        }),
      });
    } catch (err) {
      return {
        status: "failed",
        error: `Publishing failed (${(err as Error).message}). Check the Page before retrying: it may have posted.`,
      };
    }
    job = { video_id: videoId, finished_at: new Date(ctx.now).toISOString() };
  }

  const v = await call(
    `${FBG}/${job.video_id}?fields=status,permalink_url&access_token=${ctx.token}`,
  );
  const next = facebookNext(v.status, job.finished_at, ctx.now);
  if (next.kind === "failed") return { status: "failed", error: next.error, job };
  if (next.kind === "published") {
    const link = v.permalink_url
      ? String(v.permalink_url).startsWith("http")
        ? v.permalink_url
        : `https://www.facebook.com${v.permalink_url}`
      : `https://www.facebook.com/reel/${job.video_id}`;
    return {
      status: "published",
      externalId: String(job.video_id),
      url: link,
      publishedAt: new Date(ctx.now).toISOString(),
      job,
    };
  }
  return { status: "processing", job, checkInSeconds: next.kind === "wait" ? next.checkInSeconds : 60 };
}

// ---------------------------------------------------------------------------
// TikTok: uploaded to the app's inbox (video.upload), where someone taps Post.
// TikTok rules out audited direct posting for a tool that posts to your own
// accounts, and unaudited direct posts can only be private. The status check
// follows it until it is public, for its id.
// ---------------------------------------------------------------------------

const TT = "https://open.tiktokapis.com/v2";

export async function stepTikTok(t: Claimed, ctx: Ctx): Promise<Outcome> {
  const auth = {
    Authorization: `Bearer ${ctx.token}`,
    "Content-Type": "application/json; charset=UTF-8",
  };

  if (t.status === "pending") {
    const media = await ctx.media();
    const plan = tiktokChunks(media.size);
    await ctx.markSending();
    const init = await call(`${TT}/post/publish/inbox/video/init/`, {
      method: "POST",
      headers: auth,
      body: JSON.stringify({
        source_info: {
          source: "FILE_UPLOAD",
          video_size: media.size,
          chunk_size: plan.chunkSize,
          total_chunk_count: plan.count,
        },
      }),
    });
    const publishId = init.data?.publish_id;
    const uploadUrl = init.data?.upload_url;
    if (!publishId || !uploadUrl) throw new Error("TikTok gave no upload address");

    for (let i = 0; i < plan.chunks.length; i++) {
      const c = plan.chunks[i];
      const last = i === plan.chunks.length - 1;
      const bytes = await media.range(c);
      let res: Response;
      try {
        res = await fetch(uploadUrl, {
          method: "PUT",
          headers: {
            "Content-Type": media.type,
            "Content-Length": String(bytes.length),
            "Content-Range": `bytes ${c.start}-${c.end}/${media.size}`,
          },
          body: bytes,
        });
      } catch (err) {
        if (last)
          return {
            status: "failed",
            error: `The last piece got no answer (${(err as Error).message}). Check the TikTok inbox before retrying.`,
          };
        throw new Transient(`network: ${(err as Error).message}`);
      }
      await res.body?.cancel();
      if (!res.ok) {
        if (res.status >= 500 && !last) throw new Transient(`upload ${res.status}`);
        return { status: "failed", error: `TikTok refused the upload: ${res.status}` };
      }
    }
    return {
      status: "processing",
      job: { publish_id: publishId, uploaded_at: new Date(ctx.now).toISOString() },
      checkInSeconds: 60,
    };
  }

  const body = await call(`${TT}/post/publish/status/fetch/`, {
    method: "POST",
    headers: auth,
    body: JSON.stringify({ publish_id: t.job.publish_id }),
  });
  const next = tiktokNext(body.data ?? {}, t.job.uploaded_at, ctx.now);
  if (next.kind === "wait")
    return {
      status: next.status,
      job: { ...t.job, note: next.note ?? null },
      checkInSeconds: next.checkInSeconds,
    };
  if (next.kind === "failed") return { status: "failed", error: next.error, job: t.job };
  if (next.kind === "published") {
    const handle = ctx.handle ?? "";
    return {
      status: "published",
      externalId: next.externalId,
      url: next.externalId && handle ? `https://www.tiktok.com/${handle}/video/${next.externalId}` : null,
      publishedAt: new Date(ctx.now).toISOString(),
      job: { ...t.job, note: next.note ?? null },
    };
  }
  return { status: "processing", job: t.job, checkInSeconds: 120 };
}
