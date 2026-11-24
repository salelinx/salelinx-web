"use client";

// The Overview tab of /admin/finance/cancellations: figures, endings by month,
// reasons, who is about to leave, and the uninstall survey. Every figure and
// list here opens its full list in Feedback or People through `onOpen`.

import {
  daysUntil,
  endingsByMonth,
  reasonLabel,
  stripeReason,
  stripeReasonCounts,
  summarise,
  surveyReasonCounts,
  type FeedbackItem,
  type Tab,
  type View,
} from "@/lib/admin/cancellations";
import type {
  AdminCancellationStats,
  AdminUninstallFeedback,
} from "@/lib/types/admin";
import { UserEmailLink } from "@/components/admin/UserEmailLink";
import {
  Box,
  day,
  money,
  RowTitle,
  Stat,
} from "@/components/admin/finance/FinanceParts";
import {
  EndingsChart,
  EndsIn,
  KIND,
  KindChip,
  Legend,
  ReasonBars,
  ReasonChip,
  SCHEDULED_COLOR,
} from "@/components/admin/finance/CancellationsUi";

const LEAVING_SOON = 5;
const LATEST_COMMENTS = 3;

function LinkButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-xs text-blue-600 underline-offset-2 hover:underline"
    >
      {children}
    </button>
  );
}

export function CancellationsOverview({
  stats,
  survey,
  surveyError,
  items,
  start,
  now,
  periodLabel,
  onOpen,
}: {
  stats: AdminCancellationStats;
  survey: AdminUninstallFeedback[];
  surveyError: string | null;
  items: FeedbackItem[];
  start: string | null;
  now: number;
  periodLabel: string;
  onOpen: (tab: Tab, filters?: Partial<View>) => void;
}) {
  const cur = stats.currency;
  const sum = summarise(stats.rows, stats.trials_finished, start);
  const months = endingsByMonth(stats.rows, start, now);
  const reasons = stripeReasonCounts(stats.rows, start);
  const answers = reasons.reduce((n, r) => n + r.total, 0);
  const surveyInPeriod = survey.filter((s) => start === null || s.created_at >= start);
  const surveyReasons = surveyReasonCounts(survey, start);
  const soon = stats.rows
    .filter((r) => r.state === "scheduled")
    .sort((a, b) => (a.ends_at < b.ends_at ? -1 : 1));
  const comments = items.filter(
    (x) => x.comment && (start === null || x.counted_at === null || x.counted_at >= start),
  );

  return (
    <div className="space-y-3">
      <RowTitle>{periodLabel}</RowTitle>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          label="Trials ended unpaid"
          value={String(sum.trialsEnded)}
          hint={
            sum.trialsEndedShare === null
              ? "No trials finished"
              : `${sum.trialsEndedShare}% of ${sum.trialsFinished} finished trials`
          }
          dot={KIND.trial.color}
          note="Trials cancelled before their first payment. The share is of every trial that finished in the period, paid or not."
          onClick={() => onOpen("people", { status: "ended", kind: "trial" })}
        />
        <Stat
          label="Paying customers cancelled"
          value={String(sum.paying.count)}
          hint={sum.paying.count ? `${money(sum.paying.mrr, cur)} of MRR` : undefined}
          dot={KIND.paying.color}
          note="Subscriptions that ended after the customer chose to cancel, having paid. MRR is each one's last full-price payment as Stripe settled it, per month."
          onClick={() => onOpen("people", { status: "ended", kind: "paying" })}
        />
        <Stat
          label="Payment failed"
          value={String(sum.failed.count)}
          hint={sum.failed.count ? `${money(sum.failed.mrr, cur)} of MRR` : undefined}
          dot={KIND.failed.color}
          note="Subscriptions Stripe ended because payment kept failing or was disputed. Nobody chose to leave, so there is no reason."
          onClick={() => onOpen("people", { kind: "failed" })}
        />
        <Stat
          label="Set to cancel now"
          value={String(sum.scheduled.count)}
          hint={`${sum.scheduled.trials} trial${sum.scheduled.trials === 1 ? "" : "s"}, ${sum.scheduled.paying} paying`}
          dot={SCHEDULED_COLOR}
          note="Still running but set to end, at the end of the trial or billing period. They can still change their mind, so this counts in every period."
          onClick={() => onOpen("people", { status: "scheduled" })}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Box title="Endings by month" hint="By the month they ended">
          {months.length ? (
            <div className="space-y-3">
              <Legend
                items={[
                  { label: "Trial ended unpaid", color: KIND.trial.color, count: sum.trialsEnded },
                  { label: "Paying cancelled", color: KIND.paying.color, count: sum.paying.count },
                  { label: "Payment failed", color: KIND.failed.color, count: sum.failed.count },
                ]}
              />
              <EndingsChart months={months} />
            </div>
          ) : (
            <p className="text-sm text-zinc-500">Nothing ended in this period.</p>
          )}
        </Box>
        <Box title="Why they cancelled" hint="Click a reason to read its answers">
          {reasons.length ? (
            <div className="space-y-3">
              <Legend
                items={[
                  { label: "Trial", color: KIND.trial.color, count: reasons.reduce((n, r) => n + r.parts[0], 0) },
                  { label: "Paying", color: KIND.paying.color, count: reasons.reduce((n, r) => n + r.parts[1], 0) },
                ]}
              />
              <ReasonBars
                rows={reasons}
                colors={[KIND.trial.color, KIND.paying.color]}
                onPick={(r) => onOpen("feedback", { source: "stripe", reason: r.key, commented: false })}
              />
              <LinkButton onClick={() => onOpen("feedback", { source: "stripe", commented: false })}>
                See all {answers} Stripe answers
              </LinkButton>
            </div>
          ) : (
            <p className="text-sm text-zinc-500">No cancellations in this period.</p>
          )}
        </Box>
      </div>

      <RowTitle>Leaving soon</RowTitle>
      <Box title="Set to cancel" hint="Soonest first" flush>
        {soon.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="text-left text-xs text-zinc-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Customer</th>
                  <th className="px-2 py-2 font-medium">Kind</th>
                  <th className="px-2 py-2 font-medium">Reason</th>
                  <th className="px-2 py-2 font-medium">Decided on</th>
                  <th className="px-4 py-2 text-right font-medium">Ends</th>
                </tr>
              </thead>
              <tbody>
                {soon.slice(0, LEAVING_SOON).map((r) => (
                  <tr key={r.id} className="border-t border-[var(--admin-border)]">
                    <td className="px-4 py-2">
                      <UserEmailLink userId={r.user_id} email={r.email} />
                    </td>
                    <td className="px-2 py-2">
                      <KindChip kind={r.kind} />
                    </td>
                    <td className="px-2 py-2 text-zinc-700">{reasonLabel(stripeReason(r.reason))}</td>
                    <td className="px-2 py-2 text-zinc-500">Day {r.day}</td>
                    <td className="px-4 py-2 text-right">
                      <EndsIn days={daysUntil(r.ends_at, now)} short />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {soon.length > LEAVING_SOON && (
              <div className="border-t border-[var(--admin-border)] px-4 py-2">
                <LinkButton onClick={() => onOpen("people", { status: "scheduled" })}>
                  Show all {soon.length}
                </LinkButton>
              </div>
            )}
          </div>
        ) : (
          <p className="px-4 py-3 text-sm text-zinc-500">Nobody is set to cancel.</p>
        )}
      </Box>

      <RowTitle>Uninstalls and comments</RowTitle>
      <div className="grid gap-3 lg:grid-cols-2">
        <Box
          title="Uninstall survey"
          hint={`${surveyInPeriod.length} answer${surveyInPeriod.length === 1 ? "" : "s"}, anonymous`}
        >
          {surveyError ? (
            <p className="text-sm text-red-600">{surveyError}</p>
          ) : surveyReasons.length ? (
            <div className="space-y-3">
              <ReasonBars
                rows={surveyReasons}
                onPick={(r) => onOpen("feedback", { source: "survey", reason: r.key, commented: false })}
              />
              <LinkButton onClick={() => onOpen("feedback", { source: "survey", commented: false })}>
                See all {surveyInPeriod.length} answers
              </LinkButton>
            </div>
          ) : (
            <p className="text-sm text-zinc-500">
              No uninstall answers in this period. Only people who fill in the
              survey after uninstalling are counted.
            </p>
          )}
        </Box>
        <Box title="Latest comments" hint="Both sources">
          {comments.length ? (
            <div className="space-y-3">
              <ul className="divide-y divide-[var(--admin-border)]">
                {comments.slice(0, LATEST_COMMENTS).map((c) => (
                  <li key={`${c.source}-${c.id}`} className="space-y-1 py-2 first:pt-0">
                    <p className="text-sm text-zinc-800 [overflow-wrap:anywhere]">{c.comment}</p>
                    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-400">
                      <ReasonChip label={reasonLabel(c.reason)} />
                      {c.source === "stripe" ? (
                        <>
                          {c.kind && <KindChip kind={c.kind} />}
                          <UserEmailLink userId={c.user_id} email={c.email} className="text-zinc-600" />
                        </>
                      ) : (
                        <span>Uninstall survey{c.version ? `, ${c.version}` : ""}</span>
                      )}
                      <span>{day(c.at)}</span>
                    </p>
                  </li>
                ))}
              </ul>
              <LinkButton onClick={() => onOpen("feedback")}>
                See all {comments.length} comments
              </LinkButton>
            </div>
          ) : (
            <p className="text-sm text-zinc-500">No written comments in this period.</p>
          )}
        </Box>
      </div>
    </div>
  );
}
