import { createServerClient } from "@/lib/supabase/server";
import { loadInsights } from "@/lib/social/load";
import { InsightsLifecycle } from "@/components/admin/insights/InsightsLifecycle";

// /admin/marketing/insights/lifecycle - Lifecycle: how a first week of views
// builds up, half-life, how early a post can be judged, and the back
// catalogue.
// Read through lib/social/load.ts; see docs/SOCIAL.md "Stats pages".

export const dynamic = "force-dynamic";

export default async function Page() {
  const load = await loadInsights(await createServerClient());
  return <InsightsLifecycle load={load} />;
}
