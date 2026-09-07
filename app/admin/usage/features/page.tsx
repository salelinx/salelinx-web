import { resolveAdoptionWindow } from "@/lib/admin/adoption";
import { loadAdoptionReport } from "@/lib/admin/adoption-data";
import { USAGE_EPOCH, currentPeriodKeys } from "@/lib/admin/period";
import { AdminFeatureAdoption } from "@/components/admin/usage/AdminFeatureAdoption";
import { AdoptionPicker } from "@/components/admin/usage/AdoptionPicker";

// /admin/usage/features - which extension features people actually use,
// aggregated across users. The sibling /admin/usage answers the per-user
// question; this one answers the per-feature question: distinct users per
// feature, share of a chosen base, change against the previous window, and a
// per-plan matrix. Window and base come from the URL (?months=, ?to=, ?base=;
// see lib/admin/adoption.ts). Month granularity, because the activity
// counters are month buckets.
//
// Read-only. Period keys are computed server-side so the read stays bounded.

type SearchParams = Promise<{ months?: string; to?: string; base?: string }>;

export default async function AdminFeatureAdoptionPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const now = new Date();
  const window = resolveAdoptionWindow(await searchParams, now);
  const report = await loadAdoptionReport(window);

  return (
    <AdminFeatureAdoption
      report={report}
      toolbar={
        <AdoptionPicker
          preset={window.preset}
          anchor={window.anchor}
          base={window.base}
          min={USAGE_EPOCH.slice(0, 7)}
          max={currentPeriodKeys(now).month}
        />
      }
    />
  );
}
