import { createServerClient } from "@/lib/supabase/server";
import { loadInsights } from "@/lib/social/load";
import { InsightsGrowth } from "@/components/admin/insights/InsightsGrowth";

// /admin/marketing/insights/growth - Growth: followers per platform over
// time, net change, views per follower and lifetime views.
// Read through lib/social/load.ts; see docs/SOCIAL.md "Stats pages".

export const dynamic = "force-dynamic";

export default async function Page() {
  const load = await loadInsights(await createServerClient());
  return <InsightsGrowth load={load} />;
}
