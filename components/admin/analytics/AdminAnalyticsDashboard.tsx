import Link from "next/link";
import type {
  AdoptionReport,
  FeatureAdoption,
  UserActivity,
} from "@/lib/admin/adoption";
import type { Mover } from "@/lib/admin/adoption";
import { shortMonthLabel } from "@/lib/admin/adoption";
import type { ChurnEntry, ChurnWatch, FunnelStage } from "@/lib/admin/retention";
import type { FeatureStatus } from "@/lib/admin/feature-status";
import { ColumnChart } from "@/components/admin/analytics/ColumnChart";

// /admin/analytics - the Analytics landing page: a grid of self-contained
// boxes, each answering one question at a glance and linking to the module
// that has the detail. Server component, no interactivity; every box gets its
// numbers from a loader the page has already run.
//
// Boxes so far:
//   - Top features: the three most used features this month, by distinct
//     users, with actions and the change against last month.
//   - Top users: the three most active accounts this month by total actions,
//     with tier, features touched and their most-used feature.
//   - Active users: six-month column chart of distinct users with any
//     activity, with this month's delta and the three-month average.
//   - Movers: biggest gains and drops in users per feature vs last month.
//   - Churn watch: paying users who asked to cancel, and paying users with
//     no activity for 30+ days.
//   - Signup funnel: accounts, linked a shop, ran an action, paying.
//   - Health: broken / degraded marketplace features from endpoint telemetry.
//
// Adding a box: write a component that takes plain data, load that data in
// app/admin/analytics/page.tsx (in the same Promise.all), and drop it into
// the grid below. Keep boxes the same shape (title row + body + footer link)
// so the grid reads as one object.

type Props = {
  adoption: AdoptionReport;
  movers: { gains: Mover[]; drops: Mover[] };
  funnel: FunnelStage[];
  churn: ChurnWatch;
  quietDays: number;
  // Earliest month the usage read covers, for "no activity since".
  activitySinceLabel: string;
  health: { features: FeatureStatus[]; reporting: boolean };
  // Emails for the users a box names (resolved by the page for just those
  // ids). A user missing here renders as their id.
  emails: Record<string, string>;
};

const num = (n: number) => n.toLocaleString("en-US");
const compact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function AdminAnalyticsDashboard({
  adoption,
  movers,
  funnel,
  churn,
  quietDays,
  activitySinceLabel,
  health,
  emails,
}: Props) {
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
            <TopUsersBox
              users={adoption.users.slice(0, 3)}
              totalActions={adoption.totalActions}
              emails={emails}
            />
            <ActiveUsersBox adoption={adoption} />
            <MoversBox
              movers={movers}
              compareLabel={adoption.window.compareLabel}
            />
            <ChurnBox
              churn={churn}
              quietDays={quietDays}
              sinceLabel={activitySinceLabel}
              emails={emails}
            />
            <FunnelBox stages={funnel} />
            <HealthBox
              features={health.features}
              reporting={health.reporting}
            />
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

// The three most active accounts this month by total actions. Ranked by
// actions on purpose (that is what "total usage" means), with the feature
// count and top feature alongside so a single bulk run reads as what it is:
// one user, one feature, a lot of clicks. The bar is each user's share of all
// actions this month.
function TopUsersBox({
  users,
  totalActions,
  emails,
}: {
  users: UserActivity[];
  totalActions: number;
  emails: Record<string, string>;
}) {
  return (
    <Box
      title="Top users"
      hint={totalActions === 0 ? undefined : `${compact.format(totalActions)} actions in total`}
      href="/admin/usage"
      linkLabel="Usage by user"
    >
      {users.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No extension activity recorded yet this month.
        </p>
      ) : (
        <ol className="space-y-3">
          {users.map((u, i) => (
            <TopUserRow
              key={u.user_id}
              rank={i + 1}
              user={u}
              email={emails[u.user_id] ?? null}
              share={totalActions === 0 ? 0 : (u.actions / totalActions) * 100}
            />
          ))}
        </ol>
      )}
    </Box>
  );
}

function TopUserRow({
  rank,
  user,
  email,
  share,
}: {
  rank: number;
  user: UserActivity;
  email: string | null;
  share: number;
}) {
  const width = Math.max(0, Math.min(100, share));
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
          <span className="flex min-w-0 items-baseline gap-2">
            {email ? (
              <span className="truncate text-sm text-zinc-900">{email}</span>
            ) : (
              <span className="truncate font-mono text-xs text-zinc-500">
                {user.user_id}
              </span>
            )}
            <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] capitalize text-zinc-600">
              {user.tier_id}
            </span>
          </span>
          <span className="shrink-0 font-mono text-sm tabular-nums text-zinc-900">
            {num(user.actions)}
            <span className="ml-1 text-xs text-zinc-400">actions</span>
          </span>
        </div>
        <div
          className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-blue-100"
          aria-hidden
        >
          <div
            className="h-full rounded-full bg-blue-600"
            style={{ width: `${width}%` }}
          />
        </div>
        <p className="mt-1 flex flex-wrap items-baseline gap-x-1.5 text-xs text-zinc-500">
          <span>{Math.round(share)}% of all actions</span>
          <span aria-hidden>&middot;</span>
          <span>
            {user.featuresUsed} {user.featuresUsed === 1 ? "feature" : "features"}
          </span>
          <span aria-hidden>&middot;</span>
          <span>
            mostly {user.topFeature} ({num(user.topFeatureActions)})
          </span>
        </p>
      </div>
    </li>
  );
}

// Distinct users with any extension activity, per month over the trend
// window. The current month is partial (month to date) and carries the
// accent; the rest are context. Compared against last month and against the
// average of the three months before this one, so a single soft month does
// not read as a trend on its own.
function ActiveUsersBox({ adoption }: { adoption: AdoptionReport }) {
  const months = adoption.window.trendMonths;
  const values = adoption.monthlyActiveUsers;
  const labels = months.map(shortMonthLabel);
  const current = values[values.length - 1] ?? 0;
  const previous = values.length >= 2 ? values[values.length - 2] : null;
  const delta = previous === null ? null : current - previous;
  const priorThree = values.slice(-4, -1);
  const avg =
    priorThree.length === 0
      ? null
      : priorThree.reduce((a, b) => a + b, 0) / priorThree.length;
  const floor = adoption.unmeasuredMonths.length > 0;

  return (
    <Box
      title="Active users"
      hint="month to date"
      href="/admin/usage/features"
      linkLabel="Feature adoption"
    >
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold">{num(current)}</span>
        {delta !== null && (
          <span
            className={
              "text-xs font-medium " +
              (delta > 0
                ? "text-emerald-700"
                : delta < 0
                  ? "text-red-600"
                  : "text-zinc-400")
            }
          >
            {delta > 0 ? "+" : delta < 0 ? "-" : ""}
            {num(Math.abs(delta))} vs {labels[labels.length - 2]}
          </span>
        )}
        {avg !== null && (
          <span className="text-xs text-zinc-500">
            {num(Math.round(avg))} avg prior 3
          </span>
        )}
      </div>
      <div className="mt-2">
        <ColumnChart values={values} labels={labels} name="Active users" />
      </div>
      {floor && (
        <p className="mt-1 text-[11px] text-zinc-400">
          Before Sep 2026 only crosslist, relist, refresh, follow and unfollow
          counted as activity.
        </p>
      )}
    </Box>
  );
}

// Biggest changes in users per feature against last month. A sudden drop is
// the earliest sign a feature broke; a sudden rise is a release landing.
function MoversBox({
  movers,
  compareLabel,
}: {
  movers: { gains: Mover[]; drops: Mover[] };
  compareLabel: string | null;
}) {
  const empty = movers.gains.length === 0 && movers.drops.length === 0;
  return (
    <Box
      title="Movers"
      hint={compareLabel ? `users vs ${compareLabel}` : undefined}
      href="/admin/usage/features"
      linkLabel="Feature adoption"
    >
      {!compareLabel ? (
        <p className="text-sm text-zinc-500">
          Nothing to compare against yet.
        </p>
      ) : empty ? (
        <p className="text-sm text-zinc-500">
          No feature changed its user count.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <MoverList title="Gaining" items={movers.gains} up />
          <MoverList title="Dropping" items={movers.drops} up={false} />
        </div>
      )}
    </Box>
  );
}

function MoverList({
  title,
  items,
  up,
}: {
  title: string;
  items: Mover[];
  up: boolean;
}) {
  return (
    <div>
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
        {title}
      </p>
      {items.length === 0 ? (
        <p className="text-xs text-zinc-400">None</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((m) => (
            <li key={m.feature} className="text-sm">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-zinc-900">{m.label}</span>
                <span
                  className={
                    "shrink-0 font-mono text-xs font-medium tabular-nums " +
                    (up ? "text-emerald-700" : "text-red-600")
                  }
                >
                  {up ? "+" : "-"}
                  {num(Math.abs(m.delta))}
                </span>
              </div>
              <p className="font-mono text-[11px] tabular-nums text-zinc-400">
                {num(m.compareUsers)} to {num(m.users)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Paying users about to leave (asked Stripe to cancel at period end) and
// paying users who have gone quiet. The quiet list is the one to act on: they
// are still paying and have not decided yet.
function ChurnBox({
  churn,
  quietDays,
  sinceLabel,
  emails,
}: {
  churn: ChurnWatch;
  quietDays: number;
  sinceLabel: string;
  emails: Record<string, string>;
}) {
  const atRisk = churn.cancelling.length + churn.quiet.length;
  return (
    <Box
      title="Churn watch"
      hint={
        churn.payingUsers === 0
          ? undefined
          : `${num(atRisk)} of ${num(churn.payingUsers)} paying`
      }
      href="/admin/subscriptions"
      linkLabel="Subscriptions"
    >
      {churn.payingUsers === 0 ? (
        <p className="text-sm text-zinc-500">No paying users yet.</p>
      ) : atRisk === 0 ? (
        <p className="text-sm text-zinc-500">
          Nobody cancelling, and every paying user was active in the last{" "}
          {quietDays} days.
        </p>
      ) : (
        <div className="space-y-3">
          <ChurnList
            title={`Cancelling (${num(churn.cancelling.length)})`}
            items={churn.cancelling.slice(0, 3)}
            emails={emails}
            describe={(e) =>
              e.days === null
                ? "period end unknown"
                : e.days === 0
                  ? "ends today"
                  : `${num(e.days)} ${e.days === 1 ? "day" : "days"} left`
            }
          />
          <ChurnList
            title={`Quiet ${quietDays}+ days (${num(churn.quiet.length)})`}
            items={churn.quiet.slice(0, 3)}
            emails={emails}
            describe={(e) =>
              e.days === null
                ? `nothing since ${sinceLabel}`
                : `${num(e.days)} days silent`
            }
          />
        </div>
      )}
    </Box>
  );
}

function ChurnList({
  title,
  items,
  emails,
  describe,
}: {
  title: string;
  items: ChurnEntry[];
  emails: Record<string, string>;
  describe: (e: ChurnEntry) => string;
}) {
  return (
    <div>
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
        {title}
      </p>
      {items.length === 0 ? (
        <p className="text-xs text-zinc-400">None</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((e) => (
            <li
              key={e.user_id}
              className="flex items-baseline justify-between gap-2 text-sm"
            >
              <span className="flex min-w-0 items-baseline gap-2">
                {emails[e.user_id] ? (
                  <span className="truncate text-zinc-900">
                    {emails[e.user_id]}
                  </span>
                ) : (
                  <span className="truncate font-mono text-xs text-zinc-500">
                    {e.user_id}
                  </span>
                )}
                <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] capitalize text-zinc-600">
                  {e.tier_id}
                </span>
              </span>
              <span className="shrink-0 text-xs text-zinc-500">
                {describe(e)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Where accounts get to. Each stage is a share of ALL accounts, so the bars
// nest inside each other visually even though the states are not a strict
// sequence.
function FunnelBox({ stages }: { stages: FunnelStage[] }) {
  const accounts = stages[0]?.count ?? 0;
  return (
    <Box
      title="Signup funnel"
      hint="all time"
      href="/admin/users"
      linkLabel="Users"
    >
      {accounts === 0 ? (
        <p className="text-sm text-zinc-500">No accounts yet.</p>
      ) : (
        <ol className="space-y-2.5">
          {stages.map((s) => (
            <li key={s.key}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="text-zinc-900">{s.label}</span>
                <span className="font-mono text-xs tabular-nums text-zinc-700">
                  {num(s.count)}
                  <span className="ml-1.5 text-zinc-400">
                    {s.share === null ? "" : `${Math.round(s.share)}%`}
                  </span>
                </span>
              </div>
              <div
                className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-blue-100"
                aria-hidden
              >
                <div
                  className="h-full rounded-full bg-blue-600"
                  style={{
                    width: `${Math.max(0, Math.min(100, s.share ?? 0))}%`,
                  }}
                />
              </div>
            </li>
          ))}
        </ol>
      )}
    </Box>
  );
}

// Marketplace feature health from passive telemetry, as computed for
// /admin/health. Sits next to the usage numbers because a usage drop with a
// broken endpoint beside it explains itself. Semantic colors only, with the
// word alongside: never color alone.
function HealthBox({
  features,
  reporting,
}: {
  features: FeatureStatus[];
  reporting: boolean;
}) {
  const broken = features.filter((f) => f.status === "broken");
  const warn = features.filter((f) => f.status === "warn");
  const ok = features.filter((f) => f.status === "ok").length;
  const unknown = features.filter((f) => f.status === "unknown").length;
  const flagged = [...broken, ...warn].slice(0, 4);
  return (
    <Box
      title="Marketplace health"
      hint="last 24h"
      href="/admin/health"
      linkLabel="Endpoint health"
    >
      {!reporting ? (
        <p className="text-sm text-zinc-500">
          No telemetry received yet, so nothing can be called healthy.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <Count label="broken" n={broken.length} tone="red" />
            <Count label="degraded" n={warn.length} tone="amber" />
            <Count label="operational" n={ok} tone="emerald" />
            <Count label="no data" n={unknown} tone="zinc" />
          </div>
          {flagged.length > 0 && (
            <ul className="mt-3 space-y-1">
              {flagged.map((f) => (
                <li
                  key={f.key}
                  className="flex items-baseline justify-between gap-2 text-sm"
                >
                  <span className="truncate text-zinc-900">
                    {f.label}
                    <span className="ml-1.5 text-xs capitalize text-zinc-400">
                      {f.platform}
                    </span>
                  </span>
                  <span
                    className={
                      "shrink-0 text-xs font-medium " +
                      (f.status === "broken" ? "text-red-600" : "text-amber-700")
                    }
                  >
                    {f.status === "broken" ? "broken" : "degraded"}
                    {f.failureRate !== null &&
                      ` (${Math.round(f.failureRate)}% failing)`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Box>
  );
}

function Count({
  label,
  n,
  tone,
}: {
  label: string;
  n: number;
  tone: "red" | "amber" | "emerald" | "zinc";
}) {
  const color =
    n === 0
      ? "text-zinc-400"
      : tone === "red"
        ? "text-red-600"
        : tone === "amber"
          ? "text-amber-700"
          : tone === "emerald"
            ? "text-emerald-700"
            : "text-zinc-600";
  return (
    <span className={"font-mono tabular-nums " + color}>
      {num(n)}
      <span className="ml-1 font-sans text-xs">{label}</span>
    </span>
  );
}
