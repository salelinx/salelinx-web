import { resolveAdoptionWindow } from "@/lib/admin/adoption";
import { loadAdoptionReport } from "@/lib/admin/adoption-data";
import { USAGE_EPOCH, currentPeriodKeys, hourKey } from "@/lib/admin/period";
import { usageRangeBounds } from "@/lib/admin/usage-range";
import { AdminFeatureAdoption } from "@/components/admin/usage/AdminFeatureAdoption";
import { AdoptionPicker } from "@/components/admin/usage/AdoptionPicker";

// /admin/usage/features - which extension features people actually use,
// aggregated across users. The sibling /admin/usage answers the per-user
// question; this one answers the per-feature question: distinct users per
// feature, share of a chosen base, change against the previous window, and a
// per-plan matrix. Window and base come from the URL (see lib/admin/adoption.ts
// resolveAdoptionWindow):
//   ?range=5m..72h        exact trailing window from usage_events
//   ?months=1|3|6|all&to= month runs from the month buckets (the original)
//   ?from=&to= (hour keys) custom UTC hour range from the hour buckets
//   ?base=active|paid|all the denominator
//
// Read-only. Period keys are computed server-side so the read stays bounded.

type SearchParams = Promise<{
  months?: string;
  to?: string;
  base?: string;
  range?: string;
  from?: string;
}>;

export default async function AdminFeatureAdoptionPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const now = new Date();
  const window = resolveAdoptionWindow(await searchParams, now);
  const report = await loadAdoptionReport(window);
  const bounds = usageRangeBounds(now);

  // Seed the custom hour inputs with the current hour range, or the last 24
  // hours when the view is not an hour range.
  const seedFrom =
    window.kind === "hours"
      ? window.months[0]
      : hourKey(new Date(now.getTime() - 23 * 3_600_000));
  const seedTo =
    window.kind === "hours" ? window.months[window.months.length - 1] : bounds.hourMax;

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
          from={seedFrom < bounds.hourMin ? bounds.hourMin : seedFrom}
          to={seedTo}
          bounds={bounds}
        />
      }
    />
  );
}
