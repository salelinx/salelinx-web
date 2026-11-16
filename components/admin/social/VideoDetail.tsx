"use client";

// One video's page under Stats: what its platform reports, how its first
// week compares with our typical recent video there, and views per day.

import { useState } from "react";
import Link from "next/link";
import { PlatformLogo } from "@/components/admin/marketing/PlatformLogo";
import { ColumnChart } from "@/components/admin/analytics/ColumnChart";
import { engagementRate, type MarketingStatRow, type MarketingVideoRow } from "@/lib/admin/marketing";
import { AGES_H, type VideoCurve } from "@/lib/social/experiments";
import { PLATFORM_NAMES } from "@/lib/social/types";
import { ViewsCurveChart } from "./ViewsCurveChart";
import { LocalTime } from "./LocalTime";

const count = (n: number | null | undefined) =>
  n === null || n === undefined ? null : Math.round(n).toLocaleString("en-GB");

function duration(seconds: number | null | undefined): string | null {
  if (seconds === null || seconds === undefined) return null;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

const ageLabel = (h: number) => (h < 24 ? `${h} hour${h === 1 ? "" : "s"}` : `${h / 24} day${h === 24 ? "" : "s"}`);

export function VideoDetail({
  video,
  latest,
  daily,
  curve,
  benchmark,
  experiments,
  loadError,
}: {
  video: MarketingVideoRow;
  latest: MarketingStatRow | null;
  daily: { day: string; views: number }[];
  curve: VideoCurve;
  benchmark: { curve: { h: number; views: number }[]; ages: Record<string, number | null>; videos: number };
  experiments: { id: string; name: string; variant: string }[];
  loadError: string | null;
}) {
  const [maxHours, setMaxHours] = useState(72);
  const name = PLATFORM_NAMES[video.platform];

  const engagement = latest ? engagementRate(latest) : null;
  const tiles: [string, string | null, string?][] = [
    ["Views", count(latest?.views)],
    ["Likes", count(latest?.likes)],
    ["Comments", count(latest?.comments)],
    ["Shares", count(latest?.shares)],
    ["Engagement", engagement === null ? null : `${(engagement * 100).toFixed(1)}%`, "Likes, comments and shares per view"],
    ["Reach", count(latest?.reach), "Accounts that saw it at least once (Instagram)"],
    ["Saves", count(latest?.saves)],
    ["Avg watch", duration(latest?.avg_watch_seconds)],
    ["Viewed", latest?.avg_view_pct == null ? null : `${Math.round(latest.avg_view_pct)}%`, "Average share of the video watched (YouTube Analytics)"],
    ["Watch time", duration(latest?.watch_seconds)],
    ["Subscribers", count(latest?.subscribers_gained), "Subscribers gained from this video (YouTube Analytics)"],
  ];

  return (
    <div className="flex h-full flex-col">
      <header className="flex min-h-12 shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-2">
        <Link href="/admin/marketing" className="text-xs text-zinc-500 hover:text-zinc-900">
          Stats
        </Link>
        <span className="text-zinc-300">/</span>
        <h1 className="flex min-w-0 items-center gap-2 text-sm font-semibold">
          <PlatformLogo platform={video.platform} size={18} />
          <span className="truncate">{video.title ?? "(untitled)"}</span>
        </h1>
        {video.url && (
          <a href={video.url} target="_blank" rel="noreferrer" className="ml-auto rounded-md border border-[var(--admin-border)] px-2.5 py-1 text-xs text-zinc-600 hover:text-zinc-900">
            Open on {name}
          </a>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="mx-auto max-w-5xl space-y-3 p-4">
          {loadError && (
            <p className="rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2 text-sm text-zinc-700">
              Couldn&apos;t load everything: {loadError}
            </p>
          )}

          <section className="flex flex-wrap gap-4 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
            {video.thumbnail_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={video.thumbnail_url} alt="" className="h-28 rounded object-cover" />
            )}
            <div className="min-w-0 flex-1 space-y-2">
              <p className="text-xs text-zinc-500">
                {name} · posted {video.published_at ? <LocalTime iso={video.published_at} weekday /> : "at an unknown time"}
                {latest && ` · numbers from ${latest.day}`}
              </p>
              <dl className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                {tiles
                  .filter(([, value]) => value !== null)
                  .map(([label, value, hint]) => (
                    <div key={label} title={hint}>
                      <dt className="text-xs text-zinc-500">{label}</dt>
                      <dd className="text-lg font-semibold tabular-nums">{value}</dd>
                    </div>
                  ))}
              </dl>
              {experiments.length > 0 && (
                <p className="text-xs text-zinc-500">
                  In{" "}
                  {experiments.map((e, i) => (
                    <span key={e.id}>
                      {i > 0 && ", "}
                      <Link href={`/admin/marketing/experiments?id=${e.id}`} className="text-zinc-900 hover:underline">
                        {e.name}
                      </Link>{" "}
                      as {e.variant}
                    </span>
                  ))}
                </p>
              )}
            </div>
          </section>

          <section className="space-y-3 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="mr-auto font-semibold">First week against our typical {name} video</h2>
              {[72, 168].map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setMaxHours(h)}
                  className={`rounded-full border px-2.5 py-0.5 text-xs ${
                    maxHours === h ? "border-zinc-900 bg-zinc-900 text-white" : "border-[var(--admin-border)] text-zinc-500 hover:text-zinc-900"
                  }`}
                >
                  First {h === 72 ? "3 days" : "7 days"}
                </button>
              ))}
            </div>
            <ViewsCurveChart
              lines={[
                ...(benchmark.curve.length > 1
                  ? [{ id: "benchmark", label: `Typical (median of ${benchmark.videos})`, series: "benchmark", curve: benchmark.curve }]
                  : []),
                { id: "this", label: "This video", series: "A", curve: curve.curve },
              ]}
              maxHours={maxHours}
              legend={[
                { series: "A", label: "This video" },
                ...(benchmark.curve.length > 1
                  ? [{ series: "benchmark", label: `Typical: median of our last ${benchmark.videos} with hourly data` }]
                  : []),
              ]}
            />
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-zinc-500">
                <tr>
                  <th className="py-1.5 font-medium">Views at</th>
                  <th className="py-1.5 text-right font-medium">This video</th>
                  <th className="py-1.5 text-right font-medium">Typical</th>
                  <th className="py-1.5 text-right font-medium">Against typical</th>
                </tr>
              </thead>
              <tbody>
                {AGES_H.map((h) => {
                  const mine = curve.ages[h];
                  const typical = benchmark.ages[h] ?? null;
                  const ratio = mine !== null && typical ? mine / typical : null;
                  return (
                    <tr key={h} className="border-t border-[var(--admin-border)]">
                      <td className="py-1.5 text-zinc-600">{ageLabel(h)}</td>
                      <td className="py-1.5 text-right font-mono">{count(mine) ?? "-"}</td>
                      <td className="py-1.5 text-right font-mono text-zinc-500">{count(typical) ?? "-"}</td>
                      <td className={`py-1.5 text-right font-mono ${ratio === null ? "" : ratio >= 1 ? "text-emerald-700" : "text-zinc-600"}`}>
                        {ratio === null ? "-" : `${ratio.toFixed(1)}x`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          {daily.length > 1 && (
            <section className="space-y-2 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 text-sm">
              <h2 className="font-semibold">Views gained per day</h2>
              <ColumnChart
                name="Views gained per day"
                values={daily.map((d) => d.views)}
                labels={daily.map((d) => d.day.slice(8))}
                height={140}
              />
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
