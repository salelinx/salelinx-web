import { createServerClient } from "@/lib/supabase/server";
import { loadInsights } from "@/lib/social/load";
import { InsightsTotals } from "@/components/admin/insights/InsightsTotals";

// /admin/marketing/insights - Totals: the period's totals against the one
// before, views per day by platform, the platform split, where views came
// from and the posts that gained most.
// Read through lib/social/load.ts; see docs/SOCIAL.md "Stats pages".

export const dynamic = "force-dynamic";

export default async function Page() {
  const load = await loadInsights(await createServerClient());
  return <InsightsTotals load={load} />;
}
