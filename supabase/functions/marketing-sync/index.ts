// deno-lint-ignore-file
// marketing-sync: saves today's numbers for every video on SaleLinx's YouTube,
// Instagram and TikTok, plus each account's followers, for /admin/marketing.
// One row per video per day, so a second run in a day overwrites that day.
//
// Called by the hourly dashboard Cron job with the x-marketing-cron-secret
// header (MARKETING_SECRET), or by an admin's "Sync now" with their JWT (same
// getUser + AAL2 + admin_users gate as the other admin functions).
//
// YouTube reads public stats with YOUTUBE_API_KEY for YOUTUBE_CHANNEL_HANDLE.
// Instagram and TikTok use the logins marketing-oauth stored, renewed here
// before they expire; a platform that was never connected is skipped.

import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  corsHeaders as sharedCorsHeaders,
  timingSafeEqual,
} from "../_shared/security.ts";
import { requireAdmin } from "../_shared/admin-gate.ts";
import {
  refreshInstagram,
  refreshTikTok,
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

type AccountRow = {
  access_token: string | null;
  access_expires_at: string | null;
  refresh_token: string | null;
};

async function loadLogin(platform: Platform): Promise<AccountRow | null> {
  const { data } = await admin
    .from("marketing_accounts")
    .select("access_token, access_expires_at, refresh_token")
    .eq("platform", platform)
    .maybeSingle();
  return data?.access_token ? (data as AccountRow) : null;
}

async function save(
  platform: Platform,
  account: SyncedAccount,
  day: string,
  tokens: Record<string, unknown>,
) {
  const now = new Date().toISOString();
  const { error: accErr } = await admin.from("marketing_accounts").upsert({
    platform,
    handle: account.handle,
    external_id: account.externalId,
    synced_at: now,
    last_error: null,
    ...tokens,
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
      })),
    );
    if (sErr) throw new Error(`stats: ${sErr.message}`);
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
      await save(platform, await syncYouTube(key, handle), day, {});
      return "ok";
    }

    const login = await loadLogin(platform);
    if (!login) return "skipped: not connected";
    const expires = login.access_expires_at
      ? Date.parse(login.access_expires_at)
      : 0;
    const tokens: Record<string, unknown> = {};
    let token = login.access_token!;

    if (platform === "instagram") {
      // Renewed a week ahead, so a few missed days of Cron can't let it lapse.
      if (expires - Date.now() < 7 * DAY_MS) {
        const next = await refreshInstagram({
          accessToken: token,
          accessExpiresAt: login.access_expires_at,
        });
        token = next.accessToken;
        Object.assign(tokens, {
          access_token: token,
          access_expires_at: next.accessExpiresAt,
        });
      }
      await save(platform, await syncInstagram(token), day, tokens);
    } else {
      if (expires - Date.now() < 60 * 60 * 1000) {
        const next = await refreshTikTok(
          {
            accessToken: token,
            accessExpiresAt: login.access_expires_at,
            refreshToken: login.refresh_token,
          },
          Deno.env.get("TIKTOK_CLIENT_KEY") ?? "",
          Deno.env.get("TIKTOK_CLIENT_SECRET") ?? "",
        );
        token = next.accessToken;
        Object.assign(tokens, {
          access_token: token,
          access_expires_at: next.accessExpiresAt,
          refresh_token: next.refreshToken,
          refresh_expires_at: next.refreshExpiresAt,
        });
      }
      await save(platform, await syncTikTok(token), day, tokens);
    }
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
  for (const platform of ["youtube", "instagram", "tiktok"] as const) {
    results[platform] = await syncPlatform(platform, day);
  }
  return json({ day, results });
});
