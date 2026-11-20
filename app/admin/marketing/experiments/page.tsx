import { createServerClient } from "@/lib/supabase/server";
import type { MarketingVideoRow } from "@/lib/admin/marketing";
import { ruleMembers, ruleProgress, ruleWarnings, weeklyBrief } from "@/lib/social/brief";
import { DIMENSIONS } from "@/lib/social/compare";
import { curvesFor, loadHourly, selectAll } from "@/lib/social/data";
import { loadInsights } from "@/lib/social/load";
import { TAG_GROUPS } from "@/lib/social/tags";
import type { ExperimentVideoRow, SocialExperimentRow } from "@/lib/social/types";
import { Experiments, type RuleDimension } from "@/components/admin/social/Experiments";

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
  const [experimentsRes, membersRes, videosRes, insights] = await Promise.all([
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
    loadInsights(supabase),
  ]);

  const experiments = (experimentsRes.data as SocialExperimentRow[] | null) ?? [];
  const stats = insights.data.videos;
  const rules = experiments.filter((e) => e.dimension);
  const members = [
    ...((membersRes.data as ExperimentVideoRow[] | null) ?? []),
    ...rules.flatMap((e) => ruleMembers(e, stats)),
  ];
  const hourly = await loadHourly(supabase, members);
  const memberVideos = videosRes.data.filter((v) =>
    members.some((m) => m.platform === v.platform && m.external_id === v.external_id),
  );

  const brief = weeklyBrief(stats, experiments, insights.data.nowMs);
  if (!insights.error) {
    // Read by the planner and Trend Remix; before migration 061 this fails and nothing reads it.
    const { error } = await supabase.rpc("admin_save_social_brief", { p_brief: brief });
    if (error) console.error("[social] brief save failed:", error.message);
  }

  const dimensions: RuleDimension[] = DIMENSIONS.filter((d) => d.key !== "platform" && d.key !== "source").map((d) => {
    const tagged = TAG_GROUPS.find((g) => g.key === d.key || g.key === `${d.key}s`)?.options ?? [];
    const seen = stats.flatMap((v) => d.values(v));
    return { key: d.key, label: d.label, values: [...new Set([...(d.order ?? []), ...tagged, ...seen])] };
  });

  const loadError =
    experimentsRes.error?.message ?? membersRes.error?.message ?? videosRes.error ?? hourly.error ?? insights.error;

  return (
    <Experiments
      experiments={experiments}
      members={members}
      videos={videosRes.data}
      curves={curvesFor(memberVideos, hourly.rows)}
      selectedId={(await searchParams).id ?? null}
      loadError={loadError}
      dimensions={dimensions}
      rules={Object.fromEntries(
        rules.map((e) => [e.id, { progress: ruleProgress(e, stats), warnings: ruleWarnings(e, stats) }]),
      )}
      brief={brief}
    />
  );
}
