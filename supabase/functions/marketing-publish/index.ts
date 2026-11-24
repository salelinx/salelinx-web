// marketing-publish: posts the planner's scheduled videos (/admin/marketing/planner,
// 052_social.sql) to YouTube, Instagram, TikTok and our Facebook Page.
//
// Called every 5 minutes by a dashboard Cron job with the
// x-marketing-cron-secret header (MARKETING_SECRET, shared with marketing-sync),
// or by an admin's Post now with their JWT (getUser + AAL2 + admin_users).
// Either way it only does what is due: social_claim_targets() picks the work
// and locks it, so a Cron run and a Post now never post the same thing.
//
// Each claimed platform gets one step (platforms.ts): an upload, a container
// check, a TikTok status check. Its result is saved here. A post that went live
// is added to marketing_videos at once, so it shows on the Stats tab and joins
// its experiment without waiting for the next sync.
//
// Logs carry post ids and platform errors only: the content is ours, but
// captions still have no business in logs.

import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  corsHeaders as sharedCorsHeaders,
  timingSafeEqual,
} from "../_shared/security.ts";
import { requireAdmin } from "../_shared/admin-gate.ts";
import {
  canPost,
  freshLogin,
  type FreshLogin,
  type LoginKey,
  type MarketingPlatform,
} from "../_shared/marketing-login.ts";
import { PUBLIC_BUCKET } from "../_shared/tiktok-business.ts";
import {
  facebookMayBeLive,
  findFailedReel,
  publicCopyPath,
  retryIn,
  titleFrom,
  type Chunk,
  type PageReel,
} from "./plan.ts";
import {
  FBG,
  facebookPublished,
  stepFacebook,
  stepInstagram,
  stepTikTok,
  stepTikTokBusiness,
  stepYouTube,
  Transient,
  type Claimed,
  type Ctx,
  type Media,
  type Outcome,
} from "./platforms.ts";

const corsHeaders = sharedCorsHeaders();
const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const BUCKET = "social-media";
// Per run. Uploads are the slow part, and the function has a wall-clock limit.
const CLAIM_LIMIT = 4;
// Longer than a run can last, so a lock only outlives a run that died.
const LOCK_MINUTES = 10;
// No new upload starts after this; what is left is released for the next run.
const START_BUDGET_MS = 60_000;

const NAMES: Record<MarketingPlatform, string> = {
  youtube: "YouTube",
  instagram: "Instagram",
  tiktok: "TikTok",
  facebook: "Facebook",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** A file in the bucket, read by byte range through a signed URL. */
async function openMedia(path: string, type: string | null): Promise<Media> {
  const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(path, 2 * 3600);
  if (error || !data?.signedUrl) throw new Error(`file missing from storage: ${path}`);
  const url = data.signedUrl;

  const probe = await fetch(url, { headers: { Range: "bytes=0-0" } });
  await probe.body?.cancel();
  // 206 names the size in Content-Range; a server ignoring the range sends
  // the whole file with its Content-Length.
  const total = Number(
    probe.status === 206
      ? probe.headers.get("Content-Range")?.split("/")[1]
      : probe.headers.get("Content-Length"),
  );
  if (!probe.ok || !Number.isFinite(total) || total <= 0)
    throw new Transient(`couldn't read the file's size (${probe.status})`);

  return {
    size: total,
    type: type || probe.headers.get("Content-Type") || "video/mp4",
    url,
    async range(c: Chunk) {
      const res = await fetch(url, { headers: { Range: `bytes=${c.start}-${c.end}` } });
      if (res.status !== 206 && res.status !== 200)
        throw new Transient(`storage read ${res.status}`);
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (bytes.length !== c.end - c.start + 1)
        throw new Transient(`storage read was ${bytes.length} bytes, wanted ${c.end - c.start + 1}`);
      return bytes;
    },
  };
}

const coverType = (path: string) => (path.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg");

/**
 * A public copy of the video for TikTok to fetch (060's social-public bucket),
 * copied inside Storage, so nothing passes through this function. Named by
 * the post, so a retry replaces it.
 */
async function publicCopy(t: Claimed): Promise<{ url: string; path: string }> {
  const path = publicCopyPath(t.post_id, t.media_path!);
  await admin.storage.from(PUBLIC_BUCKET).remove([path]);
  const { error } = await admin.storage
    .from(BUCKET)
    .copy(t.media_path!, path, { destinationBucket: PUBLIC_BUCKET });
  if (error) throw new Transient(`couldn't make TikTok's copy of the video: ${error.message}`);
  return { url: admin.storage.from(PUBLIC_BUCKET).getPublicUrl(path).data.publicUrl, path };
}

async function dropPublicCopy(path: string | undefined) {
  if (!path) return;
  const { error } = await admin.storage.from(PUBLIC_BUCKET).remove([path]);
  if (error) console.error("[marketing-publish] remove TikTok copy:", error.message);
}

/**
 * Which TikTok route a target takes. Anything already on its way keeps its
 * route; a new post goes through TikTok API for Business when the posting
 * login can post, and to the app's inbox otherwise.
 */
function tiktokRoute(t: Claimed, businessReady: boolean): "business" | "inbox" {
  if (t.job.share_id) return "business";
  if (t.job.publish_id || t.job.studio_at || t.status !== "pending") return "inbox";
  return businessReady ? "business" : "inbox";
}

async function updateTarget(t: Claimed, fields: Record<string, unknown>) {
  const { error } = await admin
    .from("social_post_targets")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("post_id", t.post_id)
    .eq("platform", t.platform);
  if (error) console.error(`[marketing-publish] save ${t.post_id}/${t.platform}:`, error.message);
}

/** Puts a live post in the stats tables and its experiment straight away. */
async function linkVideo(t: Claimed, externalId: string, url: string | null, publishedAt: string) {
  const { error } = await admin.from("marketing_videos").upsert(
    {
      platform: t.platform,
      external_id: externalId,
      title: t.platform === "youtube" ? (t.title || t.post_name) : titleFrom(t.caption, t.post_name),
      url,
      published_at: publishedAt,
    },
    { onConflict: "platform,external_id", ignoreDuplicates: true },
  );
  if (error) {
    console.error(`[marketing-publish] link ${t.post_id}/${t.platform}:`, error.message);
    return;
  }
  if (t.experiment_id && t.variant) {
    // ignoreDuplicates: if an admin already placed it, keep their variant.
    await admin.from("social_experiment_videos").upsert(
      {
        experiment_id: t.experiment_id,
        platform: t.platform,
        external_id: externalId,
        variant: t.variant,
      },
      { onConflict: "experiment_id,platform,external_id", ignoreDuplicates: true },
    );
  }
}

async function save(t: Claimed, outcome: Outcome) {
  if (outcome.status === "failed") {
    await updateTarget(t, {
      status: "failed",
      error: outcome.error.slice(0, 1000),
      ...(outcome.job ? { job: outcome.job } : {}),
      next_attempt_at: null,
      locked_until: null,
    });
  } else if (outcome.status === "published") {
    await updateTarget(t, {
      status: "published",
      job: outcome.job,
      external_id: outcome.externalId,
      url: outcome.url,
      published_at: outcome.publishedAt,
      next_attempt_at: null,
      locked_until: null,
      error: null,
    });
    if (outcome.externalId) await linkVideo(t, outcome.externalId, outcome.url, outcome.publishedAt);
  } else {
    // processing or inbox: check again later.
    await updateTarget(t, {
      status: outcome.status,
      job: outcome.job,
      next_attempt_at: new Date(Date.now() + outcome.checkInSeconds * 1000).toISOString(),
      locked_until: null,
      error: null,
    });
  }
}

/** A transient failure: try again later, or give up after a few goes. */
async function backOff(t: Claimed, message: string) {
  // A status check that hiccups just checks again; it has nothing to lose.
  if (t.status !== "pending") {
    await updateTarget(t, {
      status: t.status,
      next_attempt_at: new Date(Date.now() + 5 * 60_000).toISOString(),
      locked_until: null,
    });
    return;
  }
  const wait = retryIn(t.attempts);
  if (wait === null) {
    await save(t, { status: "failed", error: `Gave up after ${t.attempts + 1} tries: ${message}` });
    return;
  }
  await updateTarget(t, {
    status: "pending",
    attempts: t.attempts + 1,
    next_attempt_at: new Date(Date.now() + wait * 1000).toISOString(),
    locked_until: null,
    error: `Will try again: ${message}`.slice(0, 1000),
  });
}

async function runOne(t: Claimed, logins: Map<LoginKey, FreshLogin | null>): Promise<string> {
  const load = async (key: LoginKey) => {
    if (!logins.has(key)) {
      logins.set(key, await freshLogin(admin, key).catch((err) => {
        console.error(`[marketing-publish] ${key} login:`, err.message);
        return null;
      }));
    }
    return logins.get(key) ?? null;
  };

  // TikTok posts publicly through its posting login when that is connected.
  let key: LoginKey = t.platform;
  if (t.platform === "tiktok") {
    const business = await load("tiktok_business");
    const ready = !!business && canPost("tiktok_business", business.scopes);
    if (tiktokRoute(t, ready) === "business") key = "tiktok_business";
  }
  const login = await load(key);
  const name = key === "tiktok_business" ? "TikTok posting" : NAMES[t.platform];
  const where = key === "tiktok_business" ? "with the TikTok button in the planner" : "on the Stats tab";
  if (!login) {
    await save(t, {
      status: "failed",
      error: `${name} isn't connected, or its login could not be renewed. Connect it ${where}.`,
    });
    return "failed: not connected";
  }
  if (!canPost(key, login.scopes)) {
    await save(t, {
      status: "failed",
      error: `${name}'s login can't post. Reconnect it ${where}, then Retry.`,
    });
    return "failed: no posting scope";
  }
  if (t.status === "pending" && !t.media_path) {
    await save(t, { status: "failed", error: "The post has no video." });
    return "failed: no video";
  }

  const ctx: Ctx = {
    token: login.token,
    accountId: login.externalId,
    handle: login.handle,
    now: Date.now(),
    media: () => openMedia(t.media_path!, t.media_type),
    cover: () => (t.cover_path ? openMedia(t.cover_path, coverType(t.cover_path)) : Promise.resolve(null)),
    publicCopy: () => publicCopy(t),
    dropPublicCopy,
    markSending: () =>
      updateTarget(t, { status: "sending", attempts: t.attempts + 1, error: null }),
  };

  try {
    const outcome =
      t.platform === "youtube"
        ? await stepYouTube(t, ctx)
        : t.platform === "instagram"
          ? await stepInstagram(t, ctx)
          : t.platform === "facebook"
            ? await stepFacebook(t, ctx)
            : key === "tiktok_business"
              ? await stepTikTokBusiness(t, ctx)
              : await stepTikTok(t, ctx);
    await save(t, outcome);
    return outcome.status;
  } catch (err) {
    const message = (err as Error).message;
    console.error(`[marketing-publish] ${t.post_id}/${t.platform}:`, message);
    if (err instanceof Transient) {
      await backOff(t, message);
      return `retry: ${message}`;
    }
    await save(t, { status: "failed", error: message });
    return `failed: ${message}`;
  }
}

// How long a failed Facebook post is still looked for on the Page.
const RECHECK_DAYS = 7;

/**
 * Failed is final for posting, not for looking. A Facebook post that failed
 * after its publish call (a lost answer, or a refused read of the new Reel)
 * may be live, so each run looks for it in the Page's Reels list and marks it
 * published if it is there. This only reads from Facebook, so it can never
 * post twice; Retry stays the admin's call.
 */
async function recheckFailedFacebook(
  logins: Map<LoginKey, FreshLogin | null>,
): Promise<{ post_id: string; platform: string; result: string }[]> {
  const since = new Date(Date.now() - RECHECK_DAYS * 86_400_000).toISOString();
  const { data, error } = await admin
    .from("social_post_targets")
    .select(
      "post_id, title, caption, options, job, attempts, error, updated_at, " +
        "social_posts(name, scheduled_at, experiment_id, variant)",
    )
    .eq("platform", "facebook")
    .eq("status", "failed")
    .gte("updated_at", since)
    .limit(20);
  if (error) throw new Error(`failed targets: ${error.message}`);
  // deno-lint-ignore no-explicit-any
  const failed = ((data ?? []) as any[]).filter((r) => facebookMayBeLive(r.error));
  if (!failed.length) return [];

  if (!logins.has("facebook")) {
    logins.set("facebook", await freshLogin(admin, "facebook").catch(() => null));
  }
  const login = logins.get("facebook");
  if (!login?.externalId) return [];
  const res = await fetch(
    `${FBG}/${login.externalId}/video_reels?fields=id,description,permalink_url,created_time&limit=50&access_token=${login.token}`,
  ).catch(() => null);
  const list = res?.ok ? await res.json().catch(() => null) : null;
  const reels: PageReel[] = list?.data ?? [];
  if (!reels.length) return [];

  const { data: credited } = await admin
    .from("social_post_targets")
    .select("external_id")
    .eq("platform", "facebook")
    .not("external_id", "is", null);
  const taken = new Set((credited ?? []).map((r) => String(r.external_id)));

  const results: { post_id: string; platform: string; result: string }[] = [];
  for (const r of failed) {
    const reel = findFailedReel(
      { error: r.error, job: r.job, caption: r.caption, failedAt: r.updated_at },
      reels,
      taken,
      String(login.externalId),
    );
    if (!reel) continue;
    taken.add(String(reel.id));
    const outcome = facebookPublished(
      { ...r.job, video_id: String(reel.id), note: "Found on the Page after it had failed." },
      reel.permalink_url,
      reel.created_time,
      Date.now(),
    );
    // Only while it is still failed: an admin's Retry in the meantime wins.
    const { data: saved, error: saveError } = await admin
      .from("social_post_targets")
      .update({
        status: "published",
        job: outcome.job,
        external_id: outcome.externalId,
        url: outcome.url,
        published_at: outcome.publishedAt,
        error: null,
        next_attempt_at: null,
        locked_until: null,
        updated_at: new Date().toISOString(),
      })
      .eq("post_id", r.post_id)
      .eq("platform", "facebook")
      .eq("status", "failed")
      .select("post_id");
    if (saveError || !saved?.length) continue;
    const post = r.social_posts ?? {};
    const t = {
      post_id: r.post_id,
      platform: "facebook",
      status: "processing",
      title: r.title,
      caption: r.caption,
      options: r.options ?? {},
      job: outcome.job,
      attempts: r.attempts ?? 0,
      scheduled_at: post.scheduled_at,
      media_path: null,
      media_bytes: null,
      media_type: null,
      cover_path: null,
      post_name: post.name ?? "",
      experiment_id: post.experiment_id ?? null,
      variant: post.variant ?? null,
    } as Claimed;
    await linkVideo(t, outcome.externalId!, outcome.url, outcome.publishedAt);
    results.push({ post_id: r.post_id, platform: "facebook", result: "published: found on the Page" });
  }
  return results;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST")
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  const secret = Deno.env.get("MARKETING_SECRET");
  const presented = req.headers.get("x-marketing-cron-secret");
  const fromCron = !!secret && !!presented && (await timingSafeEqual(presented, secret));
  if (!fromCron) {
    const gate = await requireAdmin(req, admin, corsHeaders);
    if (gate instanceof Response) return gate;
  }

  const started = Date.now();
  const { data, error } = await admin.rpc("social_claim_targets", {
    p_limit: CLAIM_LIMIT,
    p_lock_minutes: LOCK_MINUTES,
  });
  if (error) {
    console.error("[marketing-publish] claim:", error.message);
    return json({ error: "claim_failed" }, 500);
  }

  const logins = new Map<LoginKey, FreshLogin | null>();
  const results: { post_id: string; platform: string; result: string }[] = [];
  for (const t of (data ?? []) as Claimed[]) {
    if (t.status === "pending" && Date.now() - started > START_BUDGET_MS) {
      await updateTarget(t, { locked_until: null });
      results.push({ post_id: t.post_id, platform: t.platform, result: "deferred" });
      continue;
    }
    results.push({ post_id: t.post_id, platform: t.platform, result: await runOne(t, logins) });
  }
  if (Date.now() - started < START_BUDGET_MS) {
    results.push(
      ...(await recheckFailedFacebook(logins).catch((err) => {
        console.error("[marketing-publish] recheck:", (err as Error).message);
        return [];
      })),
    );
  }
  return json({ results });
});
