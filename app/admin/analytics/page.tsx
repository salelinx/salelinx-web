import { resolveAdoptionWindow } from "@/lib/admin/adoption";
import {
  loadAdoptionReport,
  loadUserEmails,
} from "@/lib/admin/adoption-data";
import { AdminAnalyticsDashboard } from "@/components/admin/analytics/AdminAnalyticsDashboard";

// /admin/analytics - landing page for the Analytics group: a grid of boxes,
// each a one-glance answer that links into the module with the detail. Fixed
// to the current month (with last month as the comparison) so every box on
// the page agrees on the window; the modules themselves carry the pickers.
//
// Read-only. Loaders here are the same is_admin()-gated reads the modules use.

const TOP_USERS = 3;

export default async function AdminAnalyticsPage() {
  const now = new Date();
  const [adoption] = await Promise.all([
    loadAdoptionReport(resolveAdoptionWindow({}, now)),
  ]);

  // Only the users a box will actually name get their email resolved.
  const topUsers = adoption.users.slice(0, TOP_USERS);
  const emails = await loadUserEmails(topUsers.map((u) => u.user_id));

  return <AdminAnalyticsDashboard adoption={adoption} emails={emails} />;
}
