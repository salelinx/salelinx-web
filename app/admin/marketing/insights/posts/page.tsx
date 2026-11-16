import { createServerClient } from "@/lib/supabase/server";
import { loadInsights } from "@/lib/social/load";
import { InsightsPosts } from "@/components/admin/insights/InsightsPosts";

// /admin/marketing/insights/posts - Posts: every video with every figure we
// hold, sortable, filterable and downloadable as CSV.
// Read through lib/social/load.ts; see docs/SOCIAL.md "Stats pages".

export const dynamic = "force-dynamic";

export default async function Page() {
  const load = await loadInsights(await createServerClient());
  return <InsightsPosts load={load} />;
}
