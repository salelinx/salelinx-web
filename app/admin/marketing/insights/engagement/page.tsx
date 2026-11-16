import { createServerClient } from "@/lib/supabase/server";
import { loadInsights } from "@/lib/social/load";
import { InsightsEngagement } from "@/components/admin/insights/InsightsEngagement";

// /admin/marketing/insights/engagement - Engagement: rates per platform, the
// engagement mix, every post's rate, the rolling rate and watch figures.
// Read through lib/social/load.ts; see docs/SOCIAL.md "Stats pages".

export const dynamic = "force-dynamic";

export default async function Page() {
  const load = await loadInsights(await createServerClient());
  return <InsightsEngagement load={load} />;
}
