import { featureMovers, foldAdoption, monthLabel, resolveAdoptionWindow } from "@/lib/admin/adoption";
import { loadAnalyticsSource, loadUserEmails } from "@/lib/admin/adoption-data";
import { churnWatch, signupFunnel } from "@/lib/admin/retention";
import { loadHealthRows } from "@/lib/admin/health-data";
import { AdminAnalyticsDashboard } from "@/components/admin/analytics/AdminAnalyticsDashboard";

// /admin/analytics - landing page for the Analytics group: a grid of boxes,
// each a one-glance answer that links into the module with the detail. Fixed
// to the current month (with last month as the comparison) so every box on
// the page agrees on the window; the modules themselves carry the pickers.
//
// One raw read feeds every usage-derived box (adoption, movers, funnel,
// churn); endpoint health has its own loader. Read-only, and every read is
// the same is_admin()-gated path the modules use.

// Always fresh: a churn list or a broken-endpoint count that is minutes stale
// is worse than a slower page.
export const dynamic = "force-dynamic";

const TOP_N = 3;
const QUIET_DAYS = 30;

export default async function AdminAnalyticsPage() {
  const now = new Date();
  const window = resolveAdoptionWindow({}, now);

  const [source, health] = await Promise.all([
    loadAnalyticsSource(window, { withSubscriptions: true }),
    loadHealthRows(24),
  ]);

  const adoption = foldAdoption(source);
  const movers = featureMovers(adoption.features, TOP_N);
  const funnel = signupFunnel(source.users, source.rows);
  const churn = churnWatch({
    users: source.users,
    subscriptions: source.subscriptions,
    rows: source.rows,
    now,
    quietDays: QUIET_DAYS,
  });

  // Only the users a box will actually name get their email resolved.
  const named = [
    ...adoption.users.slice(0, TOP_N),
    ...churn.cancelling.slice(0, TOP_N),
    ...churn.quiet.slice(0, TOP_N),
  ].map((u) => u.user_id);
  const emails = await loadUserEmails(named);

  return (
    <AdminAnalyticsDashboard
      adoption={adoption}
      movers={movers}
      funnel={funnel}
      churn={churn}
      quietDays={QUIET_DAYS}
      activitySinceLabel={monthLabel(window.trendMonths[0])}
      health={{ features: health.features, reporting: health.reporting }}
      emails={emails}
    />
  );
}
