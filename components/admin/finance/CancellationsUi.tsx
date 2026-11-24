// Charts and chips for /admin/finance/cancellations. Plain HTML rather than
// SVG, so text keeps its size at any width. Colours are the console's chart
// variables, so both themes follow: one colour per kind of cancellation,
// used the same way in every chart, tile and chip on the page.

import type { MonthEndings, ReasonCount } from "@/lib/admin/cancellations";
import type { AdminCancellation } from "@/lib/types/admin";
import { monthLabel } from "@/components/admin/finance/FinanceParts";

export const KIND: Record<
  AdminCancellation["kind"],
  { label: string; color: string }
> = {
  trial: { label: "Trial", color: "var(--viz-1)" },
  paying: { label: "Paying", color: "var(--viz-2)" },
  failed: { label: "Payment failed", color: "var(--viz-3)" },
};
export const SCHEDULED_COLOR = "var(--viz-4)";
const NEUTRAL = "var(--admin-chart-faint)";
const NO_ANSWER = "var(--admin-chart-column)";

export function Swatch({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      className="inline-block h-2 w-2 shrink-0 rounded-sm"
      style={{ background: color }}
    />
  );
}

export function KindChip({ kind }: { kind: AdminCancellation["kind"] }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-zinc-700">
      <Swatch color={KIND[kind].color} />
      {KIND[kind].label}
    </span>
  );
}

export function ReasonChip({ label }: { label: string }) {
  return (
    <span className="whitespace-nowrap rounded-full border border-[var(--admin-border)] px-2 text-[11px] leading-[18px] text-zinc-700">
      {label}
    </span>
  );
}

export function Legend({
  items,
}: {
  items: { label: string; color: string; count?: number }[];
}) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <Swatch color={i.color} />
          {i.label}
          {i.count !== undefined && (
            <span className="tabular-nums text-zinc-400">{i.count}</span>
          )}
        </span>
      ))}
    </div>
  );
}

/** "Ends in 3 days", amber when 2 days or fewer are left. */
export function EndsIn({ days, short = false }: { days: number; short?: boolean }) {
  const text =
    days === 0
      ? "Ends today"
      : `${short ? "" : "Ends in "}${days} day${days === 1 ? "" : "s"}`;
  return days <= 2 ? (
    <span className="whitespace-nowrap rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
      {text}
    </span>
  ) : (
    <span className="whitespace-nowrap">{text}</span>
  );
}

// Round axis steps: the smallest that fits the tallest column in five ticks.
function axisTop(max: number): { top: number; step: number } {
  const step = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000].find((s) => max / s <= 5) ?? 2000;
  return { top: Math.max(step, Math.ceil(max / step) * step), step };
}

const SERIES = [
  { key: "trial", label: "Trial ended unpaid", color: KIND.trial.color },
  { key: "paying", label: "Paying cancelled", color: KIND.paying.color },
  { key: "failed", label: "Payment failed", color: KIND.failed.color },
] as const;

/** Cancellations that ended, per month, stacked by kind. */
export function EndingsChart({ months }: { months: MonthEndings[] }) {
  const totals = months.map((m) => m.trial + m.paying + m.failed);
  const { top, step } = axisTop(Math.max(1, ...totals));
  const ticks = Array.from({ length: top / step + 1 }, (_, i) => i * step);

  return (
    <div className="flex h-48 flex-col" role="img" aria-label={`Cancellations by month: ${months.map((m, i) => `${monthLabel(m.month)} ${totals[i]}`).join(", ")}`}>
      <div className="relative ml-7 flex-1">
        {ticks.map((t) => (
          <div
            key={t}
            className="absolute inset-x-0 border-t"
            style={{
              bottom: `${(t / top) * 100}%`,
              borderColor: t === 0 ? "var(--admin-chart-faint)" : "var(--admin-chart-grid)",
            }}
          >
            <span className="absolute -left-7 w-5 -translate-y-1/2 text-right text-[10px] tabular-nums text-[var(--admin-chart-axis)]">
              {t}
            </span>
          </div>
        ))}
        <div className="absolute inset-0 flex items-end">
          {months.map((m, i) => (
            <div
              key={m.month}
              className="flex h-full flex-1 items-end justify-center"
              title={`${monthLabel(m.month, "year")}: ${totals[i]} (${SERIES.map((s) => `${s.label.toLowerCase()} ${m[s.key]}`).join(", ")})`}
            >
              <div
                className="relative flex w-3/5 max-w-10 flex-col-reverse gap-[2px]"
                style={{ height: `${(totals[i] / top) * 100}%` }}
              >
                {totals[i] > 0 && (
                  <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[11px] tabular-nums text-[var(--admin-chart-label)]">
                    {totals[i]}
                  </span>
                )}
                {SERIES.filter((s) => m[s.key] > 0).map((s) => (
                  <div
                    key={s.key}
                    className="min-h-[2px] last:rounded-t-[4px]"
                    style={{ flexGrow: m[s.key], flexBasis: 0, background: s.color }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="ml-7 flex pt-1.5">
        {months.map((m) => (
          <span key={m.month} className="flex-1 text-center text-[10px] text-[var(--admin-chart-axis)]">
            {monthLabel(m.month)}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * One bar per reason, stacked when there are parts (trial and paying), value
 * at the tip. Each row is a button when `onPick` is given, which opens that
 * reason's answers.
 */
export function ReasonBars({
  rows,
  colors,
  onPick,
}: {
  rows: ReasonCount[];
  // One per part; Stripe passes [trial, paying], the survey one neutral.
  colors?: string[];
  onPick?: (row: ReasonCount) => void;
}) {
  const max = Math.max(1, ...rows.map((r) => r.total));
  const palette = colors ?? [NEUTRAL];
  return (
    <ul className="space-y-0.5">
      {rows.map((r) => {
        const bar = (
          <>
            <span className={`text-sm ${r.key === "none" ? "text-zinc-500" : "text-zinc-700"}`}>
              {r.label}
            </span>
            {/* mr-8 keeps room for the value when the bar runs full width. */}
            <span className="relative mr-8 h-2.5 min-w-0">
              <span
                className="flex h-full min-w-[3px] gap-[2px]"
                style={{ width: `${(r.total / max) * 100}%` }}
              >
                {r.parts.map((v, i) =>
                  v > 0 ? (
                    <span
                      key={i}
                      className="h-full last:rounded-r-[3px]"
                      style={{
                        flexGrow: v,
                        flexBasis: 0,
                        background: r.key === "none" ? NO_ANSWER : palette[i] ?? NEUTRAL,
                      }}
                    />
                  ) : null,
                )}
              </span>
              <span
                className="absolute top-1/2 -translate-y-1/2 pl-2 text-xs tabular-nums text-zinc-500"
                style={{ left: `${(r.total / max) * 100}%` }}
              >
                {r.total}
              </span>
            </span>
          </>
        );
        const cls = "grid w-full grid-cols-[10rem_minmax(0,1fr)] items-center gap-3 rounded px-1.5 py-1 text-left";
        const title = r.parts.length > 1 ? `${r.label}: ${r.total} (trial ${r.parts[0]}, paying ${r.parts[1]})` : `${r.label}: ${r.total}`;
        return (
          <li key={r.key}>
            {onPick ? (
              <button
                type="button"
                onClick={() => onPick(r)}
                title={`${title}. Open these answers.`}
                className={`${cls} hover:bg-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400`}
              >
                {bar}
              </button>
            ) : (
              <div className={cls} title={title}>
                {bar}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Filter controls for the Feedback and People tabs
// ---------------------------------------------------------------------------

export const selectClass =
  "shrink-0 rounded-md border border-[var(--admin-border)] bg-white px-2 py-1 text-xs text-zinc-900 focus:border-zinc-400 focus:outline-none disabled:opacity-50";

export const searchClass =
  "min-w-48 shrink-0 rounded-md border border-[var(--admin-border)] bg-white px-3 py-1 text-xs outline-none focus:border-zinc-400";

export const buttonClass =
  "shrink-0 rounded-md border border-[var(--admin-border)] px-2.5 py-1 text-xs text-zinc-600 hover:text-zinc-900";

/** One row of filters. Swipes sideways on a phone, wraps from md. */
export function FilterBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-2 md:flex-wrap md:whitespace-normal">
      {children}
    </div>
  );
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { key: T; label: string; count?: number }[];
  onChange: (next: T) => void;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex shrink-0 overflow-hidden rounded-md border border-[var(--admin-border)]"
    >
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          aria-pressed={o.key === value}
          onClick={() => onChange(o.key)}
          className={`border-r border-[var(--admin-border)] px-2.5 py-1 text-xs last:border-r-0 ${
            o.key === value
              ? "bg-zinc-900 text-white"
              : "text-zinc-600 hover:text-zinc-900"
          }`}
        >
          {o.label}
          {o.count !== undefined && (
            <span className="ml-1.5 tabular-nums opacity-70">{o.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}
