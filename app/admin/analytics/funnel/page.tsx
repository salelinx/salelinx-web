import { createServerClient } from "@/lib/supabase/server";
import { inPeriod, parseFunnelPeriod } from "@/lib/admin/funnel";
import { loadBeforeSignup } from "@/lib/admin/before-signup";
import { FunnelDashboard } from "@/components/admin/analytics/FunnelDashboard";
import type { AdminFunnelAccount } from "@/lib/types/admin";

// /admin/analytics/funnel - how far accounts get, from signup to paying,
// split by where they came from, their device and the month they joined.
// One read of admin_funnel_accounts() (migration 065, is_admin()-gated, no
// emails), folded by lib/admin/funnel.ts, plus the before-signup totals
// (search, social, website, store) from lib/admin/before-signup.ts.
//
// ?days= picks the signup window (30, 90, 365, all); ?source= narrows every
// box except the source table and the before-signup totals to one source.

export const dynamic = "force-dynamic";

export default async function AdminFunnelPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string; source?: string }>;
}) {
  const params = await searchParams;
  const period = parseFunnelPeriod(params.days);
  const supabase = await createServerClient();
  // The before-signup totals hold server-only keys, so check is_admin()
  // here too rather than rely on the layout, which renders in parallel.
  const { data: admin } = await supabase.rpc("is_admin");
  const now = new Date();
  const [{ data, error }, before] = await Promise.all([
    supabase.rpc("admin_funnel_accounts"),
    admin === true ? loadBeforeSignup(supabase, period.days, now) : null,
  ]);

  return (
    <FunnelDashboard
      accounts={inPeriod((data as AdminFunnelAccount[] | null) ?? [], period, now)}
      period={period}
      source={params.source ?? null}
      error={error ? error.message : null}
      before={before}
    />
  );
}
