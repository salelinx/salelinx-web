import { createServerClient } from "@/lib/supabase/server";
import {
  buildMarketingReport,
  daysBefore,
  type MarketingFollowerRow,
  type MarketingStatRow,
  type MarketingVideoRow,
} from "@/lib/admin/marketing";
import { selectAll } from "@/lib/social/data";
import { type MarketingAccount } from "@/components/admin/marketing/MarketingDashboard";
import { OriginalDashboard } from "@/components/admin/marketing/OriginalDashboard";

// The Stats page from before the Overview replaced it.

export const dynamic = "force-dynamic";

// Long enough to measure 30-day growth against a snapshot from before it.
const HISTORY_DAYS = 45;

export default async function Page({
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
  const today = new Date().toISOString().slice(0, 10);
  const since = daysBefore(today, HISTORY_DAYS);

  const [accountsRes, videosRes, statsRes, followersRes] = await Promise.all([
    supabase.rpc("admin_marketing_accounts"),
    selectAll<MarketingVideoRow>((from, to) =>
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
  ]);

  const report = buildMarketingReport({
    today,
    videos: videosRes.data,
    stats: statsRes.data,
    followers: (followersRes.data as MarketingFollowerRow[] | null) ?? [],
  });

  return (
    <OriginalDashboard
      report={report}
      accounts={(accountsRes.data as MarketingAccount[] | null) ?? []}
      notice={await searchParams}
      loadError={
        accountsRes.error?.message ?? videosRes.error ?? statsRes.error ?? followersRes.error?.message ?? null
      }
    />
  );
}
