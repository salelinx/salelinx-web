import { createServerClient } from "@/lib/supabase/server";
import { weeklyBrief } from "@/lib/social/brief";
import { loadInsights } from "@/lib/social/load";
import { Experiments } from "@/components/admin/social/Experiments";

export const dynamic = "force-dynamic";

export default async function AdminExperimentsPage() {
  const supabase = await createServerClient();
  const insights = await loadInsights(supabase);
  const brief = weeklyBrief(insights.data.videos, insights.data.nowMs);
  if (!insights.error) {
    // Read by the planner and Trend Remix.
    const { error } = await supabase.rpc("admin_save_social_brief", { p_brief: brief });
    if (error) console.error("[social] brief save failed:", error.message);
  }
  return <Experiments brief={brief} loadError={insights.error} />;
}
