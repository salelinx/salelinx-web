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
import { publicCopyPath, retryIn, titleFrom, type Chunk } from "./plan.ts";
import {
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
  return json({ results });
});
