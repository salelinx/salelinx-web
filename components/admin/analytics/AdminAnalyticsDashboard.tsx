import Link from "next/link";
import type { AdoptionReport, FeatureAdoption } from "@/lib/admin/adoption";

// /admin/analytics - the Analytics landing page: a grid of self-contained
// boxes, each answering one question at a glance and linking to the module
// that has the detail. Server component, no interactivity; every box gets its
// numbers from a loader the page has already run.
//
// Boxes so far:
//   - Top features: the three most used features this month, by distinct
//     users, with actions and the change against last month.
//
// Adding a box: write a component that takes plain data, load that data in
// app/admin/analytics/page.tsx (in the same Promise.all), and drop it into
// the grid below. Keep boxes the same shape (title row + body + footer link)
// so the grid reads as one object.

type Props = {
  adoption: AdoptionReport;
};

const num = (n: number) => n.toLocaleString("en-US");

export function AdminAnalyticsDashboard({ adoption }: Props) {
  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-12 shrink-0 items-center border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-4">
        <h1 className="text-sm font-semibold">
          Analytics
          <span className="ml-2 font-normal text-zinc-400">
            {adoption.window.label}
          </span>
        </h1>
      </header>

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="mx-auto max-w-7xl p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            <TopFeaturesBox adoption={adoption} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Boxes
// ---------------------------------------------------------------------------

function Box({
  title,
  hint,
  href,
  linkLabel,
  children,
}: {
  title: string;
  hint?: string;
  href: string;
  linkLabel: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
      <div className="flex items-baseline justify-between gap-2 border-b border-[var(--admin-border)] px-4 py-2.5">
        <h2 className="text-sm font-semibold">{title}</h2>
        {hint && <span className="text-xs text-zinc-400">{hint}</span>}
      </div>
      <div className="flex-1 px-4 py-3">{children}</div>
      <div className="border-t border-[var(--admin-border)] px-4 py-2">
        <Link
          href={href}
          className="text-xs text-zinc-500 underline-offset-2 hover:text-zinc-900 hover:underline"
        >
          {linkLabel}
        </Link>
      </div>
    </section>
  );
}

// The three most used features this month, ranked by distinct users (never
// by actions: one bulk run would put "Listing edits" on top forever). The bar
// is the share of active users, so the three read against each other and
// against everyone who ran the extension.
function TopFeaturesBox({ adoption }: { adoption: AdoptionReport }) {
  const top = adoption.features.filter((f) => f.users > 0).slice(0, 3);
  const compare = adoption.window.compareLabel;

  return (
    <Box
      title="Top features"
      hint={
        adoption.activeUsers === 0
          ? undefined
          : `${num(adoption.activeUsers)} active ${adoption.activeUsers === 1 ? "user" : "users"}`
      }
      href="/admin/usage/features"
      linkLabel="All 28 features"
    >
      {top.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No extension activity recorded yet this month.
        </p>
      ) : (
        <ol className="space-y-3">
          {top.map((f, i) => (
            <TopFeatureRow
              key={f.feature}
              rank={i + 1}
              feature={f}
              compareLabel={compare}
            />
          ))}
        </ol>
      )}
    </Box>
  );
}

function TopFeatureRow({
  rank,
  feature,
  compareLabel,
}: {
  rank: number;
  feature: FeatureAdoption;
  compareLabel: string | null;
}) {
  const share = Math.max(0, Math.min(100, feature.adoption ?? 0));
  const delta =
    feature.compareUsers === null ? null : feature.users - feature.compareUsers;

  return (
    <li className="flex items-start gap-3">
      <span
        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-zinc-900 font-mono text-[11px] font-medium text-white"
        aria-label={`Rank ${rank}`}
      >
        {rank}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-sm text-zinc-900">{feature.label}</span>
          <span className="shrink-0 font-mono text-sm tabular-nums text-zinc-900">
            {num(feature.users)}
            <span className="ml-1 text-xs text-zinc-400">
              {feature.users === 1 ? "user" : "users"}
            </span>
          </span>
        </div>
        <div
          className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-blue-100"
          aria-hidden
        >
          <div
            className="h-full rounded-full bg-blue-600"
            style={{ width: `${share}%` }}
          />
        </div>
        <p className="mt-1 flex flex-wrap items-baseline gap-x-1.5 text-xs text-zinc-500">
          <span>{feature.adoption === null ? "-" : `${Math.round(feature.adoption)}%`} of active</span>
          <span aria-hidden>&middot;</span>
          <span>{num(feature.actions)} actions</span>
          {delta !== null && compareLabel && (
            <>
              <span aria-hidden>&middot;</span>
              <span
                className={
                  delta > 0
                    ? "font-medium text-emerald-700"
                    : delta < 0
                      ? "font-medium text-red-600"
                      : "text-zinc-400"
                }
              >
                {delta > 0 ? "+" : delta < 0 ? "-" : ""}
                {num(Math.abs(delta))}
              </span>
              <span>vs {compareLabel}</span>
            </>
          )}
        </p>
      </div>
    </li>
  );
}
