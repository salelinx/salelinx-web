import Link from "next/link";
import { AdminRefreshButton } from "@/components/admin/AdminRefreshButton";
import { canonicalSource, SourceName } from "@/components/admin/SignupSource";
import { monthLabel } from "@/lib/admin/adoption";
import {
  countFunnel,
  FUNNEL_PERIODS,
  FUNNEL_STEPS,
  groupFunnel,
  medianDaysToPay,
  PAID_STEP,
  type FunnelCounts,
  type FunnelGroup,
  type FunnelPeriod,
} from "@/lib/admin/funnel";
import type {
  BeforeSignup,
  Outside as OutsideResult,
} from "@/lib/admin/before-signup";
import type { AdminFunnelAccount } from "@/lib/types/admin";

// /admin/analytics/funnel - how far accounts get, from signup to paying. Server
// component; the period and source filters are plain links, so a filtered
// view is a URL that can be shared with whoever is helping with marketing.
//
//   - Tiles: signups, everyone who paid, running trials, median days to the
//     first payment.
//   - Steps: each funnel step (an account counts only if it did every step
//     before it, see lib/admin/funnel.ts) with the people lost since the step
//     before, and how many paid outside the steps.
//   - Before signup: Google search, social video, website and Chrome Web
//     Store totals for the same dates (lib/admin/before-signup.ts).
//   - Tables by source (click one to filter the rest), device, signup month
//     and campaign, each step as a count and a share of that row's signups.

type Props = {
  // Already narrowed to the period by the page.
  accounts: AdminFunnelAccount[];
  period: FunnelPeriod;
  source: string | null;
  error: string | null;
  // Null only when the page could not confirm an admin session.
  before: BeforeSignup | null;
};

const num = (n: number) => n.toLocaleString("en-US");

function pct(n: number, of: number): string {
  if (of === 0) return "-";
  const v = (n / of) * 100;
  return v > 0 && v < 1 ? "<1%" : `${Math.round(v)}%`;
}

function funnelHref(days: string, source: string | null): string {
  const q = new URLSearchParams({ days });
  if (source) q.set("source", source);
  return `/admin/analytics/funnel?${q}`;
}

const DEVICE_LABELS: Record<string, string> = {
  phone: "Phone",
  tablet: "Tablet",
  computer: "Computer",
  unknown: "Unknown",
};

const LINK =
  "text-zinc-900 underline underline-offset-2 hover:text-blue-700";

export function FunnelDashboard({
  accounts,
  period,
  source: sourceParam,
  error,
  before,
}: Props) {
  // Sources are grouped under one name per source (ig is Instagram), so an
  // older ?source=ig link still lands on the Instagram row.
  const sourceOf = (a: AdminFunnelAccount) => canonicalSource(a.source ?? "unknown");
  const source = sourceParam ? canonicalSource(sourceParam) : null;
  const scoped = source
    ? accounts.filter((a) => sourceOf(a) === source)
    : accounts;
  const totals = countFunnel(scoped);
  const medianDays = medianDaysToPay(scoped);
  const signups = totals.steps[0];
  const paid = totals.paidTotal;

  // The source table always lists every source, so it doubles as the filter.
  const bySource = groupFunnel(accounts, sourceOf);
  const byDevice = groupFunnel(scoped, (a) => a.device);
  const byMonth = groupFunnel(scoped, (a) => a.signed_up_at.slice(0, 7)).sort(
    (x, y) => y.key.localeCompare(x.key),
  );
  const byCampaign = groupFunnel(
    scoped.filter((a) => a.campaign),
    (a) => a.campaign,
  );

  return (
    <div className="flex h-full flex-col">
      <header className="flex min-h-12 shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-2">
        <h1 className="text-sm font-semibold">
          Funnel
          <span className="ml-2 font-normal text-zinc-400">
            {period.days === null
              ? "everyone who signed up"
              : `signed up in the last ${period.label}`}
          </span>
        </h1>
        <div className="flex overflow-hidden rounded-md border border-[var(--admin-border)] text-xs">
          {FUNNEL_PERIODS.map((p) => (
            <Link
              key={p.key}
              href={funnelHref(p.key, source)}
              className={
                "px-2.5 py-1.5 " +
                (p.key === period.key
                  ? "bg-zinc-900 text-white"
                  : "bg-white text-zinc-600 hover:bg-zinc-50")
              }
            >
              {p.label}
            </Link>
          ))}
        </div>
        {source && (
          <span className="inline-flex items-center gap-3 rounded-md border border-[var(--admin-border)] px-2.5 py-1 text-xs text-zinc-700">
            <SourceName source={source} />
            <Link href={funnelHref(period.key, null)} className={LINK}>
              All sources
            </Link>
          </span>
        )}
        <div className="ml-auto">
          <AdminRefreshButton />
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="mx-auto max-w-7xl space-y-3 p-4">
          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              Could not load the funnel: {error}
            </p>
          )}

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile label="Signups" value={num(signups)} />
            <Tile
              label="Paid"
              value={num(paid)}
              hint={signups ? `${pct(paid, signups)} of signups` : undefined}
            />
            <Tile
              label="In a trial now"
              value={num(totals.inTrial)}
              hint="not billed yet, so may still pay"
            />
            <Tile
              label="Signup to first payment"
              value={
                medianDays === null
                  ? "-"
                  : `${medianDays} day${medianDays === 1 ? "" : "s"}`
              }
              hint="median, of those who paid"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            <Panel
              title="Steps"
              hint="each counts accounts that did that step and every one before it"
              className="lg:col-span-2"
            >
              <Steps counts={totals} />
            </Panel>
            <Panel title="Before signup" hint="same dates, every source">
              <BeforeSignupBox before={before} signups={accounts.length} />
            </Panel>
          </div>

          <GroupTable
            title="By source"
            column="Source"
            hint="click a source to filter the rest of the page"
            rows={bySource}
            label={(k) => <SourceName source={k} />}
            href={(k) => funnelHref(period.key, k)}
            selected={source}
          />
          <GroupTable
            title="By device"
            column="Device"
            hint="phones cannot install the extension, so phone signups must come back on a computer"
            rows={byDevice}
            label={(k) => DEVICE_LABELS[k] ?? k}
          />
          <GroupTable
            title="By signup month"
            column="Month"
            hint="recent months have had less time to pay"
            rows={byMonth}
            label={(k) => monthLabel(k)}
          />
          {byCampaign.length > 0 && (
            <GroupTable
              title="By campaign"
              column="Campaign"
              hint="the utm_campaign of the link they came from"
              rows={byCampaign}
              label={(k) => k}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function Panel({
  title,
  hint,
  className = "",
  flush = false,
  children,
}: {
  title: string;
  hint?: string;
  className?: string;
  // No body padding, for a table that runs edge to edge.
  flush?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`flex flex-col rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] ${className}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b border-[var(--admin-border)] px-4 py-2.5">
        <h2 className="text-sm font-semibold">{title}</h2>
        {hint && <span className="text-xs text-zinc-400">{hint}</span>}
      </div>
      <div className={flush ? "flex-1" : "flex-1 px-4 py-3"}>{children}</div>
    </section>
  );
}

function Tile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-3">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-zinc-400">{hint}</div>}
    </div>
  );
}

function Steps({ counts }: { counts: FunnelCounts }) {
  const top = counts.steps[0];
  if (top === 0)
    return <p className="text-sm text-zinc-500">No signups in this window.</p>;
  const paidOutside = counts.paidTotal - counts.steps[PAID_STEP];
  return (
    <>
      <ol className="space-y-3">
        {FUNNEL_STEPS.map((s, i) => {
          const n = counts.steps[i];
          const prev = i === 0 ? n : counts.steps[i - 1];
          const lost = prev - n;
          return (
            <li key={s.key}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-zinc-900">{s.label}</span>
                <span className="font-mono text-xs tabular-nums text-zinc-700">
                  {num(n)}
                  <span className="ml-1.5 text-zinc-400">{pct(n, top)}</span>
                </span>
              </div>
              <div
                className="mt-1 h-2 w-full overflow-hidden rounded-full bg-blue-100"
                aria-hidden
              >
                <div
                  className="h-full rounded-full bg-blue-600"
                  style={{ width: `${(n / top) * 100}%` }}
                />
              </div>
              {lost > 0 && (
                <p className="mt-0.5 text-right text-[11px] text-zinc-400">
                  {num(lost)} dropped off here, {pct(lost, prev)} of the step
                  before
                </p>
              )}
            </li>
          );
        })}
      </ol>
      {paidOutside > 0 && (
        <p className="mt-4 border-t border-[var(--admin-border)] pt-3 text-xs text-zinc-500">
          {num(paidOutside)} more {paidOutside === 1 ? "account" : "accounts"}{" "}
          paid without a record of every step before it (most often no
          extension install or use on record), so{" "}
          {paidOutside === 1 ? "it is" : "they are"} not in the steps above.
          All paid: {num(counts.paidTotal)}.
        </p>
      )}
    </>
  );
}

// Totals from before anyone has an account (lib/admin/before-signup.ts). They
// count views and visits rather than people, so they sit beside the steps
// instead of on top of them.
function BeforeSignupBox({
  before,
  signups,
}: {
  before: BeforeSignup | null;
  // Every signup in the window, whatever the source filter says.
  signups: number;
}) {
  return (
    <div className="space-y-4 text-sm text-zinc-700">
      <Outside
        title="Google search"
        href="/admin/search"
        result={before?.search}
        figures={(v) => [
          [v.clicks, "clicks"],
          [v.impressions, "impressions"],
        ]}
      />
      <Outside
        title="Social videos"
        href="/admin/marketing/insights"
        result={before?.social}
        figures={(v) => [
          [v.views, "views"],
          [v.followers, "followers gained"],
        ]}
      />
      <Outside
        title="Website"
        result={before?.website}
        figures={(v) => [
          [v.visitors, "visitors"],
          [v.pageviews, "page views"],
        ]}
        extra={(v) =>
          v.visitors ? `Signups were ${pct(signups, v.visitors)} of visitors.` : null
        }
      />
      <Outside
        title="Chrome Web Store"
        result={before?.store}
        figures={(v) => [
          [v.pageViews, "listing views"],
          [v.installs, "installs"],
          [v.impressions, "impressions"],
          [v.uninstalls, "uninstalls"],
        ]}
      />
      <p className="border-t border-[var(--admin-border)] pt-3 text-xs text-zinc-500">
        These count views and visits from every source, not people, so they
        do not follow the source filter. An unknown source in the tables below
        means the account signed up before we recorded sources, signed up
        inside the extension, or turned down cookies in the UK or Europe.
        Admin accounts and deleted accounts are not counted.
      </p>
    </div>
  );
}

function Outside<T>({
  title,
  href,
  result,
  figures,
  extra,
}: {
  title: string;
  href?: string;
  result: OutsideResult<T> | undefined;
  figures: (v: T) => [number | null, string][];
  extra?: (v: T) => string | null;
}) {
  return (
    <section>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-xs font-medium text-zinc-500">{title}</h3>
        {href && (
          <Link href={href} className={`text-xs ${LINK}`}>
            Details
          </Link>
        )}
      </div>
      {!result ? (
        <p className="mt-1 text-xs text-zinc-400">Not loaded.</p>
      ) : result.state === "off" ? (
        <p className="mt-1 text-xs text-zinc-400">
          Not set up here. Needs {result.setup}.
        </p>
      ) : result.state === "error" ? (
        <p className="mt-1 break-words text-xs text-red-700" title={result.message}>
          Could not load:{" "}
          {result.message.length > 160
            ? `${result.message.slice(0, 160)}...`
            : result.message}
        </p>
      ) : (
        <>
          <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1">
            {figures(result.value).map(([n, label]) => (
              <div key={label}>
                <span className="text-lg font-semibold tabular-nums text-zinc-900">
                  {n === null ? "-" : num(n)}
                </span>{" "}
                <span className="text-xs text-zinc-500">{label}</span>
              </div>
            ))}
          </div>
          {(result.note || extra?.(result.value)) && (
            <p className="mt-0.5 text-[11px] text-zinc-400">
              {[result.note, extra?.(result.value)].filter(Boolean).join(". ")}
            </p>
          )}
        </>
      )}
    </section>
  );
}

function GroupTable({
  title,
  column,
  hint,
  rows,
  label,
  href,
  selected = null,
}: {
  title: string;
  column: string;
  hint?: string;
  rows: FunnelGroup[];
  label: (key: string) => React.ReactNode;
  // Rows link here when set; the selected row links back to everything.
  href?: (key: string | null) => string;
  selected?: string | null;
}) {
  return (
    <Panel title={title} hint={hint} flush>
      {rows.length === 0 ? (
        <p className="px-4 py-3 text-sm text-zinc-500">
          No signups in this window.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--admin-border)] text-xs text-zinc-500">
                <th className="px-4 py-2 text-left font-medium">{column}</th>
                {FUNNEL_STEPS.map((s) => (
                  <th
                    key={s.key}
                    className="px-3 py-2 text-right font-medium"
                    title={s.label}
                  >
                    {s.short}
                  </th>
                ))}
                <th
                  className="border-l border-[var(--admin-border)] px-4 py-2 text-right font-medium"
                  title="Everyone who paid, including those who skipped a step before Paid"
                >
                  All paid
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const isSelected = selected === r.key;
                return (
                  <tr
                    key={r.key}
                    className={`border-b border-[var(--admin-border)] last:border-0 ${
                      isSelected ? "bg-blue-50" : ""
                    }`}
                  >
                    <td className="whitespace-nowrap px-4 py-2 align-top">
                      {href ? (
                        <Link
                          href={href(isSelected ? null : r.key)}
                          className="hover:underline"
                        >
                          {label(r.key)}
                        </Link>
                      ) : (
                        label(r.key)
                      )}
                    </td>
                    {r.steps.map((n, i) => (
                      <td
                        key={FUNNEL_STEPS[i].key}
                        className="px-3 py-2 text-right align-top tabular-nums"
                      >
                        {num(n)}
                        {i > 0 && (
                          <div className="text-[11px] text-zinc-400">
                            {pct(n, r.steps[0])}
                          </div>
                        )}
                      </td>
                    ))}
                    <td className="border-l border-[var(--admin-border)] px-4 py-2 text-right align-top font-medium tabular-nums">
                      {num(r.paidTotal)}
                      <div className="text-[11px] font-normal text-zinc-400">
                        {pct(r.paidTotal, r.steps[0])}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
