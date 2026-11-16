"use client";

// Small pieces shared by the Stats pages: cards with a table view,
// stat tiles, the platform key, a video's thumbnail and title, the verdict
// badge and CSV download. Colours come from the console's variables
// (app/admin/admin.css), so everything follows the light/dark switch.

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { PlatformLogo } from "@/components/admin/marketing/PlatformLogo";
import { changeClass } from "@/components/admin/social/IndexBadge";
import { Sparkline } from "@/components/admin/usage/Sparkline";
import type { MarketingPlatform } from "@/lib/admin/marketing";
import { VERDICT_LABELS, type Verdict } from "@/lib/social/compare";
import type { InsightVideo } from "@/lib/social/insights";
import { PLATFORM_NAMES, SOCIAL_PLATFORMS } from "@/lib/social/types";

/**
 * A platform keeps its colour on every chart in the section: the console's
 * categorical slots in a fixed order, not the brand colours, since YouTube's
 * and TikTok's reds can't be told apart. Checked for colour blindness in both
 * themes; green and amber are under 3:1 on the light surface, so every chart
 * also has labels, a key and a table view.
 */
export const PLATFORM_COLOR: Record<MarketingPlatform, string> = {
  youtube: "var(--viz-1)",
  instagram: "var(--viz-2)",
  tiktok: "var(--viz-3)",
  facebook: "var(--viz-4)",
};

export const platformsFor = (p: MarketingPlatform | "all"): MarketingPlatform[] =>
  p === "all" ? SOCIAL_PLATFORMS : [p];

export const videoHref = (v: Pick<InsightVideo, "platform" | "external_id">) =>
  `/admin/marketing/videos/${v.platform}/${encodeURIComponent(v.external_id)}`;

export const chipClass = (on: boolean) =>
  `flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs ${
    on ? "border-zinc-900 bg-zinc-900 text-white" : "border-[var(--admin-border)] text-zinc-500 hover:text-zinc-900"
  }`;

export const selectClass =
  "rounded-md border border-[var(--admin-border)] bg-white px-2 py-1 text-xs text-zinc-900 focus:border-zinc-400 focus:outline-none";

export type TableView = { head: string[]; rows: (string | number)[][] };

/** A section of a page. With `table`, a Table button swaps the chart for its numbers. */
export function Card({
  title,
  sub,
  actions,
  table,
  children,
  className = "",
  flush = false,
}: {
  title: ReactNode;
  sub?: ReactNode;
  actions?: ReactNode;
  table?: TableView;
  children: ReactNode;
  className?: string;
  // No padding round the body, for full-width tables.
  flush?: boolean;
}) {
  const [asTable, setAsTable] = useState(false);
  return (
    <section className={`min-w-0 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] ${className}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[var(--admin-border)] px-4 py-2.5">
        <h2 className="text-sm font-semibold">{title}</h2>
        {sub && <span className="text-xs text-zinc-400">{sub}</span>}
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {actions}
          {table && (
            <button type="button" aria-pressed={asTable} onClick={() => setAsTable(!asTable)} className={chipClass(asTable)}>
              Table
            </button>
          )}
        </div>
      </div>
      {table && asTable ? (
        <div className="max-h-96 overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-[var(--admin-surface)] text-zinc-500">
              <tr>
                {table.head.map((h, i) => (
                  <th key={h} className={`px-4 py-2 font-medium ${i === 0 ? "text-left" : "text-right"}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((r, i) => (
                <tr key={i} className="border-t border-[var(--admin-border)]">
                  {r.map((c, j) => (
                    <td key={j} className={`px-4 py-1.5 tabular-nums ${j === 0 ? "text-left text-zinc-700" : "text-right"}`}>
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={flush ? "" : "p-4"}>{children}</div>
      )}
    </section>
  );
}

/** A signed change, blue up and orange down, as on Stats. */
export function Delta({ value, text, note }: { value: number | null; text: string; note?: string }) {
  return (
    <span className="text-xs">
      {text && <span className={`font-medium tabular-nums ${changeClass(value)}`}>{text} </span>}
      {note && <span className="text-zinc-400">{note}</span>}
    </span>
  );
}

export function StatTile({
  label,
  value,
  hint,
  delta,
  spark,
  sparkLabels,
}: {
  label: string;
  value: string;
  hint?: string;
  delta?: ReactNode;
  spark?: number[];
  sparkLabels?: string[];
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3.5 py-3">
      <p className="truncate text-xs text-zinc-500" title={hint}>
        {label}
        {hint && <span className="ml-1 text-zinc-300">?</span>}
      </p>
      <div className="flex items-end justify-between gap-2">
        <p className="text-2xl font-semibold tracking-tight text-zinc-900">{value}</p>
        {spark && spark.length > 1 && <Sparkline values={spark} labels={sparkLabels} name={label} width={72} height={24} />}
      </div>
      {delta}
    </div>
  );
}

/** Which colour is which platform, for charts with more than one. */
export function PlatformKey({ platforms }: { platforms: MarketingPlatform[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600">
      {platforms.map((p) => (
        <li key={p} className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: PLATFORM_COLOR[p] }} />
          <PlatformLogo platform={p} size={13} />
          {PLATFORM_NAMES[p]}
        </li>
      ))}
    </ul>
  );
}

export function Thumb({ src, size = "sm" }: { src: string | null; size?: "sm" | "md" }) {
  const cls = size === "md" ? "h-14 w-10" : "h-10 w-7";
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className={`${cls} shrink-0 rounded object-cover`} />
  ) : (
    <div className={`${cls} shrink-0 rounded bg-zinc-100`} />
  );
}

/** Thumbnail, platform and title, linking to the video's page. */
export function VideoCell({ v, sub }: { v: InsightVideo; sub?: ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <Thumb src={v.thumbnail} />
      <div className="min-w-0">
        <Link href={videoHref(v)} className="line-clamp-1 text-zinc-900 hover:underline" title={v.title}>
          {v.title}
        </Link>
        <p className="flex items-center gap-1.5 text-xs text-zinc-500">
          <PlatformLogo platform={v.platform} size={12} />
          {sub}
        </p>
      </div>
    </div>
  );
}

const VERDICT_CLASS: Record<Verdict, string> = {
  real: "bg-blue-600 text-white",
  leaning: "bg-blue-100 text-blue-800",
  none: "bg-zinc-100 text-zinc-600",
  few: "border border-dashed border-zinc-300 text-zinc-400",
};

export function VerdictBadge({ verdict, p }: { verdict: Verdict; p: number | null }) {
  const chance = p === null ? null : Math.max(1, Math.round(p * 100));
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-medium ${VERDICT_CLASS[verdict]}`}
      title={
        chance === null
          ? "Needs at least 3 posts on each side"
          : `A gap this size turns up by chance ${chance}% of the time with these posts`
      }
    >
      {VERDICT_LABELS[verdict]}
    </span>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-zinc-500">{children}</p>;
}

/** A CSV of whatever the table shows, built in the browser. */
export function downloadCsv(name: string, head: string[], rows: (string | number | null)[][]) {
  const cell = (c: string | number | null) => {
    const s = c === null ? "" : String(c);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const text = [head, ...rows].map((r) => r.map(cell).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
