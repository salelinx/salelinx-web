import { createServerClient } from "@/lib/supabase/server";
import {
  buildMarketingReport,
  daysBefore,
  type MarketingFollowerRow,
  type MarketingStatRow,
} from "@/lib/admin/marketing";
import { selectAll, videoKey } from "@/lib/social/data";
import {
  assembleVideos,
  type AgePointRow,
  type PostForOverview,
  type VideoRowWithTags,
} from "@/lib/social/overview";
import {
  MarketingDashboard,
  type MarketingAccount,
} from "@/components/admin/marketing/MarketingDashboard";

// /admin/marketing - the Stats overview: every post against our typical one
// on the same platform at the same age, the period's health, and every video
// with its tags. Reads under the is_admin() policies of 042_marketing.sql,
// 052_social.sql and 054_social_tags.sql; the accounts come through
// admin_marketing_accounts(), which leaves the login tokens out. See
// docs/SOCIAL.md "Stats".

export const dynamic = "force-dynamic";

// Two 30-day periods side by side, plus the days before them that 30-day
// growth is measured from.
const HISTORY_DAYS = 60;

export default async function AdminMarketingPage({
  searchParams,
}: {
  searchParams: Promise<{
    connected?: string;
    error?: string;
    platform?: string;
    seen?: string;
    ig?: string;
    diag?: string;
  }>;
}) {
  const supabase = await createServerClient();
  // One clock for the whole page, passed down so the server and browser renders agree.
  const now = new Date();
  const nowMs = now.getTime();
  const today = now.toISOString().slice(0, 10);
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
    supabase.from("marketing_account_stats").select("*").gte("day", since),
    // 054's view: the snapshots either side of each age, per video.
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
        .select("*, targets:social_post_targets(platform, external_id, caption)")
        .order("created_at")
        .range(from, to),
    ),
  ]);

  const stats = statsRes.data;
  const report = buildMarketingReport({
    today,
    videos: videosRes.data,
    stats,
    followers: (followersRes.data as MarketingFollowerRow[] | null) ?? [],
  });

  // Each video's newest daily snapshot (stats are oldest first).
  const latest = new Map<string, MarketingStatRow>();
  for (const s of stats) latest.set(videoKey(s.platform, s.external_id), s);

  const { videos, typical } = assembleVideos({
    videos: videosRes.data,
    latest,
    agePoints: agesRes.data,
    posts: postsRes.data,
  });

  const loadError =
    accountsRes.error?.message ??
    videosRes.error ??
    statsRes.error ??
    followersRes.error?.message ??
    postsRes.error ??
    null;

  return (
    <MarketingDashboard
      report={report}
      accounts={(accountsRes.data as MarketingAccount[] | null) ?? []}
      videos={videos}
      typical={typical}
      nowMs={nowMs}
      notice={await searchParams}
      loadError={loadError}
      indexError={agesRes.error}
    />
  );
}
