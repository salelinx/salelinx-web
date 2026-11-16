// deno-lint-ignore-file
// marketing-sync: saves today's numbers for every video on SaleLinx's YouTube,
// Instagram, TikTok and Facebook Page, plus each account's followers, for
// /admin/marketing.
// One row per video per day, so a second run in a day overwrites that day.
//
// Called by the hourly dashboard Cron job with the x-marketing-cron-secret
// header (MARKETING_SECRET), or by an admin's "Sync now" with their JWT (same
// getUser + AAL2 + admin_users gate as the other admin functions).
//
// YouTube reads public stats with YOUTUBE_API_KEY for YOUTUBE_CHANNEL_HANDLE,
// plus watch time and the rest from YouTube Analytics once YouTube is
// connected. Instagram and TikTok use the logins marketing-oauth stored,
// renewed before they expire (_shared/marketing-login.ts); a platform that was
// never connected is skipped.
//
// Every run also saves a timestamped snapshot of each video under 8 days old
// (marketing_video_hourly, 052_social.sql), which is what experiments compare
// at the same age.

import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  corsHeaders as sharedCorsHeaders,
  timingSafeEqual,
} from "../_shared/security.ts";
import { requireAdmin } from "../_shared/admin-gate.ts";
import { freshLogin } from "../_shared/marketing-login.ts";
import {
  fetchYouTubeAnalytics,
  syncFacebook,
  syncInstagram,
  syncTikTok,
  syncYouTube,
} from "./platforms.ts";
import type { Platform, SyncedAccount } from "./parse.ts";

const corsHeaders = sharedCorsHeaders();
const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const DAY_MS = 86400000;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Videos younger than this get a snapshot on every run, enough to read views
// at 7 days old.
const HOURLY_FOR_MS = 8 * DAY_MS;

async function save(platform: Platform, account: SyncedAccount, day: string) {
  const now = new Date().toISOString();
  const { error: accErr } = await admin.from("marketing_accounts").upsert({
    platform,
    handle: account.handle,
    external_id: account.externalId,
    synced_at: now,
    last_error: null,
  });
  if (accErr) throw new Error(`accounts: ${accErr.message}`);

  for (let i = 0; i < account.videos.length; i += 200) {
    const batch = account.videos.slice(i, i + 200);
    const { error: vErr } = await admin.from("marketing_videos").upsert(
      batch.map((v) => ({
        platform,
        external_id: v.externalId,
        title: v.title,
        url: v.url,
        thumbnail_url: v.thumbnailUrl,
        published_at: v.publishedAt,
      })),
    );
    if (vErr) throw new Error(`videos: ${vErr.message}`);
    const { error: sErr } = await admin.from("marketing_video_stats").upsert(
      batch.map((v) => ({
        platform,
        external_id: v.externalId,
        day,
        views: v.views,
        likes: v.likes,
        comments: v.comments,
        shares: v.shares,
        reach: v.reach ?? null,
        saves: v.saves ?? null,
        watch_seconds: v.watchSeconds ?? null,
        avg_watch_seconds: v.avgWatchSeconds ?? null,
        avg_view_pct: v.avgViewPct ?? null,
        subscribers_gained: v.subscribersGained ?? null,
      })),
    );
    if (sErr) throw new Error(`stats: ${sErr.message}`);

    const young = batch.filter(
      (v) => v.publishedAt && Date.now() - Date.parse(v.publishedAt) < HOURLY_FOR_MS,
    );
    if (young.length) {
      const { error: hErr } = await admin.from("marketing_video_hourly").upsert(
        young.map((v) => ({
          platform,
          external_id: v.externalId,
          captured_at: now,
          views: v.views,
          likes: v.likes,
          comments: v.comments,
          shares: v.shares,
        })),
      );
      if (hErr) throw new Error(`hourly: ${hErr.message}`);
    }
  }

  if (account.followers !== null) {
    const { error: fErr } = await admin
      .from("marketing_account_stats")
      .upsert({ platform, day, followers: account.followers });
    if (fErr) throw new Error(`followers: ${fErr.message}`);
  }
}

async function recordError(platform: Platform, message: string) {
  await admin
    .from("marketing_accounts")
    .upsert({ platform, last_error: message.slice(0, 500) });
}

async function syncPlatform(platform: Platform, day: string): Promise<string> {
  try {
    if (platform === "youtube") {
      const key = Deno.env.get("YOUTUBE_API_KEY");
      if (!key) return "skipped: YOUTUBE_API_KEY not set";
      const handle = Deno.env.get("YOUTUBE_CHANNEL_HANDLE") ?? "@salelinx";
      const account = await syncYouTube(key, handle);
      let note = "";
      // Analytics is extra: without the login, or if it fails, the public
      // numbers are still saved.
      try {
        const login = await freshLogin(admin, "youtube");
        if (login) {
          const analytics = await fetchYouTubeAnalytics(login.token);
          for (const v of account.videos) {
            const a = analytics.get(v.externalId);
            if (a) Object.assign(v, a);
          }
        }
      } catch (err) {
        note = ` (analytics failed: ${(err as Error).message})`;
        console.error("[marketing-sync] youtube analytics failed:", (err as Error).message);
      }
      await save(platform, account, day);
      return `ok${note}`;
    }

    const login = await freshLogin(admin, platform);
    if (!login) return "skipped: not connected";
    const account =
      platform === "instagram"
        ? await syncInstagram(login.token, login.externalId ?? "")
        : platform === "facebook"
          ? await syncFacebook(login.token, login.externalId ?? "me")
          : await syncTikTok(login.token);
    await save(platform, account, day);
    return "ok";
  } catch (err) {
    const message = (err as Error).message;
    console.error(`[marketing-sync] ${platform} failed:`, message);
    await recordError(platform, message);
    return `error: ${message}`;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST")
    return new Response("Method not allowed", {
      status: 405,
      headers: corsHeaders,
    });

  const secret = Deno.env.get("MARKETING_SECRET");
  const presented = req.headers.get("x-marketing-cron-secret");
  const fromCron =
    !!secret && !!presented && (await timingSafeEqual(presented, secret));
  if (!fromCron) {
    const gate = await requireAdmin(req, admin, corsHeaders);
    if (gate instanceof Response) return gate;
  }

  const day = new Date().toISOString().slice(0, 10);
  const results: Record<string, string> = {};
  for (const platform of ["youtube", "instagram", "tiktok", "facebook"] as const) {
    results[platform] = await syncPlatform(platform, day);
  }
  return json({ day, results });
});
