import { createServerClient } from "@/lib/supabase/server";
import {
  buildMarketingReport,
  daysBefore,
  type MarketingFollowerRow,
  type MarketingStatRow,
  type MarketingVideoRow,
} from "@/lib/admin/marketing";
import {
  MarketingDashboard,
  type MarketingAccount,
} from "@/components/admin/marketing/MarketingDashboard";

// /admin/marketing - views and followers across SaleLinx's YouTube, Instagram
// and TikTok, from the daily snapshots marketing-sync writes (042_marketing.sql).
// The stats tables are admin-readable under RLS; the accounts come through
// admin_marketing_accounts(), which leaves the login tokens out.

export const dynamic = "force-dynamic";

// Long enough to measure 30-day growth against a snapshot from before it.
const HISTORY_DAYS = 45;

// PostgREST returns at most 1,000 rows per request.
const PAGE = 1000;

async function selectAll<E>(
  page: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: unknown[] | null; error: E | null }>,
) {
  const data: unknown[] = [];
  for (let from = 0; ; from += PAGE) {
    const res = await page(from, from + PAGE - 1);
    if (res.error) return { data, error: res.error };
    data.push(...(res.data ?? []));
    if ((res.data?.length ?? 0) < PAGE) return { data, error: null };
  }
}

export default async function AdminMarketingPage({
  searchParams,
}: {
  searchParams: Promise<{
    connected?: string;
    error?: string;
    platform?: string;
  }>;
}) {
  const supabase = await createServerClient();
  const today = new Date().toISOString().slice(0, 10);
  const since = daysBefore(today, HISTORY_DAYS);

  const [accountsRes, videosRes, statsRes, followersRes] = await Promise.all([
    supabase.rpc("admin_marketing_accounts"),
    selectAll((from, to) =>
      supabase
        .from("marketing_videos")
        .select("*")
        .order("platform")
        .order("external_id")
        .range(from, to),
    ),
    selectAll((from, to) =>
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
    videos: (videosRes.data as MarketingVideoRow[] | null) ?? [],
    stats: (statsRes.data as MarketingStatRow[] | null) ?? [],
    followers: (followersRes.data as MarketingFollowerRow[] | null) ?? [],
  });
  const loadError = [accountsRes, videosRes, statsRes, followersRes].find(
    (r) => r.error,
  )?.error;

  return (
    <MarketingDashboard
      report={report}
      accounts={(accountsRes.data as MarketingAccount[] | null) ?? []}
      notice={await searchParams}
      loadError={loadError ? loadError.message : null}
    />
  );
}
