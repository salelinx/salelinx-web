import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import type { MarketingStatRow, MarketingVideoRow } from "@/lib/admin/marketing";
import { curvesFor, loadHourly, videoKey } from "@/lib/social/data";
import { AGES_H, median, medianCurve } from "@/lib/social/experiments";
import { SOCIAL_PLATFORMS, type SocialPlatform } from "@/lib/social/types";
import { VideoDetail } from "@/components/admin/social/VideoDetail";

// /admin/marketing/videos/<platform>/<id> - one video's numbers: every
// lifetime figure its platform gives, views gained per day, and its first
// week against the typical one of our recent videos on the same platform.

export const dynamic = "force-dynamic";

// How many recent videos make "typical".
const BENCHMARK_VIDEOS = 30;

export default async function AdminVideoPage({
  params,
}: {
  params: Promise<{ platform: string; id: string }>;
}) {
  const { platform: rawPlatform, id: rawId } = await params;
  if (!SOCIAL_PLATFORMS.includes(rawPlatform as SocialPlatform)) notFound();
  const platform = rawPlatform as SocialPlatform;
  const id = decodeURIComponent(rawId);
  const supabase = await createServerClient();

  const [videoRes, statsRes, recentRes, membershipRes] = await Promise.all([
    supabase.from("marketing_videos").select("*").eq("platform", platform).eq("external_id", id).maybeSingle(),
    supabase
      .from("marketing_video_stats")
      .select("*")
      .eq("platform", platform)
      .eq("external_id", id)
      .order("day"),
    supabase
      .from("marketing_videos")
      .select("platform, external_id, published_at")
      .eq("platform", platform)
      .neq("external_id", id)
      .not("published_at", "is", null)
      .order("published_at", { ascending: false })
      .limit(BENCHMARK_VIDEOS),
    supabase
      .from("social_experiment_videos")
      .select("variant, experiment:social_experiments(id, name)")
      .eq("platform", platform)
      .eq("external_id", id),
  ]);
  const video = videoRes.data as MarketingVideoRow | null;
  if (!video) notFound();

  const recent = (recentRes.data as Pick<MarketingVideoRow, "platform" | "external_id" | "published_at">[] | null) ?? [];
  const hourly = await loadHourly(supabase, [video, ...recent]);
  const curves = curvesFor([video, ...recent], hourly.rows);
  const mine = curves[videoKey(platform, id)];
  const others = recent.map((v) => curves[videoKey(v.platform, v.external_id)]).filter((c) => c.curve.length > 1);

  const stats = (statsRes.data as MarketingStatRow[] | null) ?? [];
  // Views gained each day: a day's snapshot less the one before it.
  const daily = stats.slice(1).map((s, i) => ({
    day: s.day,
    views: s.views !== null && stats[i].views !== null ? Math.max(0, s.views - stats[i].views!) : 0,
  }));

  const memberships = ((membershipRes.data ?? []) as unknown as {
    variant: string;
    experiment: { id: string; name: string } | null;
  }[])
    .filter((m) => m.experiment)
    .map((m) => ({ id: m.experiment!.id, name: m.experiment!.name, variant: m.variant }));

  const loadError =
    videoRes.error?.message ?? statsRes.error?.message ?? recentRes.error?.message ?? membershipRes.error?.message ?? hourly.error;

  return (
    <VideoDetail
      video={video}
      latest={stats[stats.length - 1] ?? null}
      daily={daily.slice(-30)}
      curve={mine}
      benchmark={{
        curve: medianCurve(others.map((c) => c.curve), 168),
        ages: Object.fromEntries(
          AGES_H.map((h) => [h, median(others.map((c) => c.ages[h]).filter((v): v is number => v !== null))]),
        ),
        videos: others.length,
      }}
      experiments={memberships}
      loadError={loadError}
    />
  );
}
