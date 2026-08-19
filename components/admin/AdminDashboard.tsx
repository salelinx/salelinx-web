import Link from "next/link";
import type { AdminAuditRow } from "@/lib/types/admin";
import type { FeatureStatus } from "@/lib/admin/feature-status";
import { FeatureStatusGrid } from "@/components/admin/health/FeatureStatusGrid";
import { AdminSection } from "@/components/admin/AdminSection";

// The /admin home dashboard. Pure presentation (server component): summary
// cards that link into each live module, plus a recent-activity list from the
// audit log. No interactivity beyond links.

type Props = {
  openTickets: number;
  needsReply: number;
  totalSubscriptions: number;
  activeSubscriptions: number;
  tierCounts: Record<string, number>;
  recentAudit: AdminAuditRow[];
  actorEmails: Record<string, string>;
  features: FeatureStatus[];
  healthReporting: boolean;
};

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function AdminDashboard({
  openTickets,
  needsReply,
  totalSubscriptions,
  activeSubscriptions,
  tierCounts,
  recentAudit,
  actorEmails,
  features,
  healthReporting,
}: Props) {
  const tierEntries = Object.entries(tierCounts).sort((a, b) =>
    a[0].localeCompare(b[0]),
  );
  // Shown in the collapsed header, so a breakage is visible without opening it.
  const healthBroken = features.filter((f) => f.status === "broken").length;
  const healthDegraded = features.filter((f) => f.status === "warn").length;

  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-12 shrink-0 items-center border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-4">
        <h1 className="text-sm font-semibold">Overview</h1>
      </header>

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              href="/admin/support"
              label="Open tickets"
              value={openTickets}
              hint={
                needsReply > 0
                  ? `${needsReply} awaiting your reply`
                  : "All caught up"
              }
              accent={needsReply > 0}
            />
            <StatCard
              href="/admin/subscriptions"
              label="Active subscriptions"
              value={activeSubscriptions}
              hint={`${totalSubscriptions} total`}
            />
            <Card href="/admin/subscriptions" label="By tier">
              {tierEntries.length === 0 ? (
                <p className="text-sm text-zinc-500">No subscriptions yet.</p>
              ) : (
                <ul className="space-y-1">
                  {tierEntries.map(([tier, count]) => (
                    <li
                      key={tier}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="capitalize text-zinc-700">{tier}</span>
                      <span className="font-mono text-zinc-900">{count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <NavCard
              href="/admin/users"
              label="Users"
              hint="Browse the roster"
            />
            <NavCard
              href="/admin/usage"
              label="Usage"
              hint="Consumption this period"
            />
            <NavCard
              href="/admin/audit"
              label="Audit log"
              hint="Admin actions"
            />
          </div>

          <section className="mt-6 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
            <div className="flex items-center justify-between border-b border-[var(--admin-border)] px-4 py-2.5">
              <h2 className="text-sm font-semibold">Recent admin activity</h2>
              <Link
                href="/admin/audit"
                className="text-xs text-zinc-500 underline-offset-2 hover:text-zinc-900 hover:underline"
              >
                View all
              </Link>
            </div>
            {recentAudit.length === 0 ? (
              <p className="px-4 py-6 text-sm text-zinc-500">
                No admin actions recorded yet.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--admin-border)]">
                {recentAudit.map((a) => (
                  <li
                    key={a.id}
                    className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-4 py-2 text-sm"
                  >
                    <span className="font-mono text-xs text-zinc-700">
                      {a.action}
                    </span>
                    {a.target_id && (
                      <span className="font-mono text-xs text-zinc-400">
                        {a.target_table ? `${a.target_table}:` : ""}
                        {a.target_id}
                      </span>
                    )}
                    <span className="ml-auto text-xs text-zinc-500">
                      {(a.actor_id ? actorEmails[a.actor_id] : null) ??
                        a.actor_id ??
                        "Deleted admin"}{" "}
                      | {formatWhen(a.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Below the summaries and collapsed by default: the grid is tall,
              and this page is read top-down for tickets and subscriptions. The
              detail lives at /admin/health; this is a glance, not the module. */}
          {healthReporting && (
            <div className="mt-6 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
              <AdminSection
                storageKey="overview-health"
                title="Marketplace feature status"
                defaultOpen={false}
                summary={
                  healthBroken > 0
                    ? `${healthBroken} broken`
                    : healthDegraded > 0
                      ? `${healthDegraded} degraded`
                      : "All operational"
                }
              >
                <FeatureStatusGrid features={features} />
                {/* Link lives INSIDE the panel, not in the header: the header
                    is a <button>, and nesting an anchor in it is invalid and
                    swallows the click. */}
                <div className="px-4 pb-3">
                  <Link
                    href="/admin/health"
                    className="text-xs text-zinc-500 underline-offset-2 hover:text-zinc-900 hover:underline"
                  >
                    Open endpoint health
                  </Link>
                </div>
              </AdminSection>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  href,
  label,
  value,
  hint,
  accent,
}: {
  href: string;
  label: string;
  value: number;
  hint: string;
  accent?: boolean;
}) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 transition-colors hover:border-zinc-300"
    >
      <p className="text-xs font-medium text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      <p
        className={
          accent
            ? "mt-1 text-xs font-medium text-amber-700"
            : "mt-1 text-xs text-zinc-500"
        }
      >
        {hint}
      </p>
    </Link>
  );
}

function Card({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 transition-colors hover:border-zinc-300"
    >
      <p className="mb-2 text-xs font-medium text-zinc-500">{label}</p>
      {children}
    </Link>
  );
}

function NavCard({
  href,
  label,
  hint,
}: {
  href: string;
  label: string;
  hint: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-3 transition-colors hover:border-zinc-300"
    >
      <div>
        <p className="text-sm font-medium text-zinc-900">{label}</p>
        <p className="text-xs text-zinc-500">{hint}</p>
      </div>
      <span aria-hidden className="text-zinc-400">
        &rarr;
      </span>
    </Link>
  );
}
