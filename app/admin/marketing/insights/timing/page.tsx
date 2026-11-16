import { createServerClient } from "@/lib/supabase/server";
import { loadInsights } from "@/lib/social/load";
import { InsightsTiming } from "@/components/admin/insights/InsightsTiming";

// /admin/marketing/insights/timing - Timing: day, time of day, hour and
// posting gap against typical, and when we post.
// Read through lib/social/load.ts; see docs/SOCIAL.md "Stats pages".

export const dynamic = "force-dynamic";

export default async function Page() {
  const load = await loadInsights(await createServerClient());
  return <InsightsTiming load={load} />;
}
