import { resolveAdoptionWindow } from "@/lib/admin/adoption";
import { loadAdoptionReport } from "@/lib/admin/adoption-data";
import { AdminAnalyticsDashboard } from "@/components/admin/analytics/AdminAnalyticsDashboard";

// /admin/analytics - landing page for the Analytics group: a grid of boxes,
// each a one-glance answer that links into the module with the detail. Fixed
// to the current month (with last month as the comparison) so every box on
// the page agrees on the window; the modules themselves carry the pickers.
//
// Read-only. Loaders here are the same is_admin()-gated reads the modules use.

export default async function AdminAnalyticsPage() {
  const now = new Date();
  const [adoption] = await Promise.all([
    loadAdoptionReport(resolveAdoptionWindow({}, now)),
  ]);

  return <AdminAnalyticsDashboard adoption={adoption} />;
}
