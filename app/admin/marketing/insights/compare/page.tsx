import { createServerClient } from "@/lib/supabase/server";
import { loadInsights } from "@/lib/social/load";
import { InsightsCompare } from "@/components/admin/insights/InsightsCompare";

// /admin/marketing/insights/compare - Compare: posts grouped by one thing
// (platform, length, timing, caption, a tag) on one measure, with a
// permutation-test verdict.
// Read through lib/social/load.ts; see docs/SOCIAL.md "Stats pages".

export const dynamic = "force-dynamic";

export default async function Page() {
  const load = await loadInsights(await createServerClient());
  return <InsightsCompare load={load} />;
}
