import { CancellationsDashboard } from "@/components/admin/finance/CancellationsDashboard";
import { parseView } from "@/lib/admin/cancellations";

// /admin/finance/cancellations - why people leave: Stripe cancellations with
// their reasons and comments, and the anonymous uninstall survey. The numbers
// load client-side (admin-cancellation-stats and uninstall_feedback); the page
// only reads the URL so a filtered link opens on the right tab. The admin
// layout gates the route as for every other admin page.

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminCancellationsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return <CancellationsDashboard initialView={parseView(await searchParams)} />;
}
