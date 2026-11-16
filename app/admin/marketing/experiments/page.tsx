import { createServerClient } from "@/lib/supabase/server";
import type { MarketingVideoRow } from "@/lib/admin/marketing";
import { curvesFor, loadHourly, selectAll } from "@/lib/social/data";
import type { ExperimentVideoRow, SocialExperimentRow } from "@/lib/social/types";
import { Experiments } from "@/components/admin/social/Experiments";

// /admin/marketing/experiments - A/B tests across our own videos
// (052_social.sql). Each member's views at 1h to 7d come from its hourly
// snapshots (lib/social/experiments.ts), worked out here so the page gets
// only the curves, not every snapshot. See docs/SOCIAL.md.

export const dynamic = "force-dynamic";

export default async function AdminExperimentsPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const supabase = await createServerClient();
  const [experimentsRes, membersRes, videosRes] = await Promise.all([
    supabase.from("social_experiments").select("*").order("created_at", { ascending: false }),
    supabase.from("social_experiment_videos").select("*"),
    selectAll<MarketingVideoRow>((from, to) =>
      supabase
        .from("marketing_videos")
        .select("platform, external_id, title, url, thumbnail_url, published_at")
        .order("published_at", { ascending: false, nullsFirst: false })
        .order("external_id")
        .range(from, to),
    ),
  ]);

  const members = (membersRes.data as ExperimentVideoRow[] | null) ?? [];
  const hourly = await loadHourly(supabase, members);
  const memberVideos = videosRes.data.filter((v) =>
    members.some((m) => m.platform === v.platform && m.external_id === v.external_id),
  );

  const loadError =
    experimentsRes.error?.message ?? membersRes.error?.message ?? videosRes.error ?? hourly.error;

  return (
    <Experiments
      experiments={(experimentsRes.data as SocialExperimentRow[] | null) ?? []}
      members={members}
      videos={videosRes.data}
      curves={curvesFor(memberVideos, hourly.rows)}
      selectedId={(await searchParams).id ?? null}
      loadError={loadError}
    />
  );
}
