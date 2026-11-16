// The loader behind every /admin/marketing/insights page: the same tables as
// Stats, read with the admin's own session under the is_admin() policies of
// 042_marketing.sql, 052_social.sql and 054_social_tags.sql, then folded into
// InsightsData by lib/social/insights.ts. The accounts come through
// admin_marketing_accounts(), which leaves the login tokens out.

import type { createServerClient } from "@/lib/supabase/server";
import { daysBefore, type MarketingFollowerRow, type MarketingStatRow } from "@/lib/admin/marketing";
import { selectAll } from "./data";
import { assembleInsights, HISTORY_DAYS, type InsightsData } from "./insights";
import type { AgePointRow, PostForOverview, VideoRowWithTags } from "./overview";
import type { SocialAccount } from "./types";

type Client = Awaited<ReturnType<typeof createServerClient>>;

export type InsightsLoad = {
  data: InsightsData;
  accounts: Pick<SocialAccount, "platform" | "handle" | "synced_at" | "last_error">[];
  error: string | null;
};

export async function loadInsights(supabase: Client): Promise<InsightsLoad> {
  // One clock for the whole page, so the server and browser renders agree.
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  // The day before the first one shown, which its gains are measured from.
  const since = daysBefore(today, HISTORY_DAYS);

  const [accountsRes, videosRes, statsRes, followersRes, agesRes, postsRes] = await Promise.all([
    supabase.rpc("admin_marketing_accounts"),
    selectAll<VideoRowWithTags>((from, to) =>
      supabase.from("marketing_videos").select("*").order("platform").order("external_id").range(from, to),
    ),
    selectAll<MarketingStatRow>((from, to) =>
      supabase
        .from("marketing_video_stats")
        .select("*")
        .gte("day", since)
        .order("day")
        .order("platform")
        .order("external_id")
        .range(from, to),
    ),
    selectAll<MarketingFollowerRow>((from, to) =>
      supabase
        .from("marketing_account_stats")
        .select("platform, day, followers")
        .gte("day", since)
        .order("day")
        .order("platform")
        .range(from, to),
    ),
    selectAll<AgePointRow>((from, to) =>
      supabase
        .from("marketing_video_age_points")
        .select("*")
        .order("platform")
        .order("external_id")
        .order("age_hours")
        .range(from, to),
    ),
    selectAll<PostForOverview>((from, to) =>
      supabase
        .from("social_posts")
        .select("id, name, tags, media_seconds, targets:social_post_targets(platform, external_id, caption)")
        .order("created_at")
        .range(from, to),
    ),
  ]);

  const data = assembleInsights({
    today,
    nowMs: now.getTime(),
    videos: videosRes.data,
    stats: statsRes.data,
    agePoints: agesRes.data,
    posts: postsRes.data,
    followers: followersRes.data,
  });

  const accounts = ((accountsRes.data as SocialAccount[] | null) ?? []).map((a) => ({
    platform: a.platform,
    handle: a.handle,
    synced_at: a.synced_at,
    last_error: a.last_error,
  }));

  return {
    data,
    accounts,
    error:
      accountsRes.error?.message ??
      videosRes.error ??
      statsRes.error ??
      followersRes.error ??
      agesRes.error ??
      postsRes.error ??
      null,
  };
}
