import { FinanceDashboard } from "@/components/admin/finance/FinanceDashboard";

// /admin/finance - revenue, MRR and customer counts. The numbers come from
// Stripe through admin-finance-stats, loaded client-side; the admin layout
// gates the route as for every other admin page.

export default function AdminFinancePage() {
  return <FinanceDashboard />;
}
