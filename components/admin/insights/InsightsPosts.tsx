"use client";

// /admin/marketing/insights/posts: every video, one row per platform copy,
// with every figure we hold for it. Column sets keep the table readable;
// Everything shows the lot. Any header sorts, and Download CSV takes the
// filtered rows with every column.

import { useMemo, useState, type ReactNode } from "react";
import { IndexBadge } from "@/components/admin/social/IndexBadge";
import { TagChips } from "@/components/admin/social/TagEditor";
import {
  AGE_SHORT,
  AGES,
  comments1k,
  count,
  engagementRate,
  halfLifeHours,
  hours,
  likeRate,
  percent,
  saves1k,
  shares1k,
  shortDay,
  subs1k,
  viewsPerDay,
  watched,
  watchHours,
  type InsightVideo,
} from "@/lib/social/insights";
import type { InsightsLoad } from "@/lib/social/load";
import { formatIndex } from "@/lib/social/overview";
import { formatLength, isTagged, tagLabels } from "@/lib/social/tags";
import { PLATFORM_NAMES } from "@/lib/social/types";
import { DataTable, type Column } from "./DataTable";
import { InsightsFrame } from "./InsightsFrame";
import { useInsightsPrefs } from "./prefs";
import { Card, chipClass, downloadCsv, platformsFor, selectClass, VideoCell } from "./ui";

type ColumnSet = "overview" | "early" | "engagement" | "watch" | "all";

const SETS: { key: ColumnSet; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "early", label: "Early views" },
  { key: "engagement", label: "Engagement" },
  { key: "watch", label: "Watch" },
  { key: "all", label: "Everything" },
];

type Def = {
  key: string;
  label: ReactNode;
  csv: string;
  title?: string;
  sets: ColumnSet[];
  value: (v: InsightVideo) => number | string | null;
  render?: (v: InsightVideo) => ReactNode;
};

const num = (f: (x: number) => string) => (x: number | string | null) => (typeof x === "number" ? f(x) : "-");
const plain = num((x) => count(x));
const oneDp = num((x) => x.toFixed(1));

export function InsightsPosts({ load }: { load: InsightsLoad }) {
  const [prefs] = useInsightsPrefs();
  const { data } = load;
  const period = prefs.period;
  const [set, setSet] = useState<ColumnSet>("overview");
  const [tag, setTag] = useState("");
  const [posted, setPosted] = useState<0 | 7 | 30 | 90>(0);
  const [q, setQ] = useState("");

  const defs: Def[] = useMemo(
    () => [
      {
        key: "posted",
        label: "Posted",
        csv: "Posted",
        sets: ["overview", "early", "engagement", "watch", "all"],
        value: (v) => v.publishedAt,
        render: (v) => (
          <span className="whitespace-nowrap text-xs text-zinc-500">
            {v.publishedAt ? shortDay(v.publishedAt.slice(0, 10)) : "-"}
            {v.slot && <span className="block text-[11px] text-zinc-400">{`${v.slot.day} ${String(v.slot.hour).padStart(2, "0")}:00 UK`}</span>}
          </span>
        ),
      },
      { key: "age", label: "Age", csv: "Age (days)", sets: ["all"], value: (v) => v.ageDays, render: (v) => num((x) => `${Math.floor(x)}d`)(v.ageDays) },
      {
        key: "length",
        label: "Length",
        csv: "Length (s)",
        sets: ["watch", "all"],
        value: (v) => v.seconds,
        render: (v) => formatLength(v.seconds) ?? "-",
      },
      { key: "views", label: "Views", csv: "Views", sets: ["overview", "early", "all"], value: (v) => v.views, render: (v) => plain(v.views) },
      {
        key: "gained",
        label: `Gained ${period}d`,
        csv: `Views gained in ${period} days`,
        title: `Views gained in the last ${period} days`,
        sets: ["overview", "all"],
        value: (v) => v.gained[period].views,
        render: (v) => plain(v.gained[period].views),
      },
      {
        key: "perDay",
        label: "Per day",
        csv: "Views per day",
        title: "Lifetime views per day since posting",
        sets: ["overview", "all"],
        value: viewsPerDay,
        render: (v) => plain(viewsPerDay(v)),
      },
      ...AGES.map(
        (h): Def => ({
          key: `at${h}`,
          label: AGE_SHORT[h],
          csv: `Views at ${AGE_SHORT[h]}`,
          title: `Views ${AGE_SHORT[h]} after posting`,
          sets: ["early", "all"],
          value: (v) => v.at[h],
          render: (v) => plain(v.at[h]),
        }),
      ),
      {
        key: "half",
        label: "Half-life",
        csv: "Hours to half the first week's views",
        title: "Hours until it had half its first week's views",
        sets: ["early", "all"],
        value: halfLifeHours,
        render: (v) => hours(halfLifeHours(v)),
      },
      {
        key: "idx24",
        label: "24h vs typical",
        csv: "Index at 24h",
        sets: ["overview", "early", "all"],
        value: (v) => v.index[24],
        render: (v) => <IndexBadge value={v.index[24]} />,
      },
      {
        key: "idx168",
        label: "7d vs typical",
        csv: "Index at 7d",
        sets: ["overview", "early", "all"],
        value: (v) => v.index[168],
        render: (v) => <IndexBadge value={v.index[168]} />,
      },
      { key: "likes", label: "Likes", csv: "Likes", sets: ["engagement", "all"], value: (v) => v.likes, render: (v) => plain(v.likes) },
      { key: "comments", label: "Comments", csv: "Comments", sets: ["engagement", "all"], value: (v) => v.comments, render: (v) => plain(v.comments) },
      { key: "shares", label: "Shares", csv: "Shares", sets: ["engagement", "all"], value: (v) => v.shares, render: (v) => plain(v.shares) },
      { key: "saves", label: "Saves", csv: "Saves", sets: ["engagement", "all"], value: (v) => v.saves, render: (v) => plain(v.saves) },
      {
        key: "reach",
        label: "Reach",
        csv: "Reach",
        title: "Accounts reached, Instagram only",
        sets: ["engagement", "all"],
        value: (v) => v.reach,
        render: (v) => plain(v.reach),
      },
      {
        key: "eng",
        label: "Eng. rate",
        csv: "Engagement rate",
        title: "Likes, comments, shares and saves per view, from 100 views",
        sets: ["overview", "engagement", "all"],
        value: engagementRate,
        render: (v) => percent(engagementRate(v)),
      },
      { key: "likeRate", label: "Like rate", csv: "Like rate", sets: ["engagement", "all"], value: likeRate, render: (v) => percent(likeRate(v)) },
      {
        key: "c1k",
        label: "Comm. /1k",
        csv: "Comments per 1k views",
        sets: ["engagement", "all"],
        value: comments1k,
        render: (v) => oneDp(comments1k(v)),
      },
      { key: "s1k", label: "Shares /1k", csv: "Shares per 1k views", sets: ["engagement", "all"], value: shares1k, render: (v) => oneDp(shares1k(v)) },
      { key: "sv1k", label: "Saves /1k", csv: "Saves per 1k views", sets: ["engagement", "all"], value: saves1k, render: (v) => oneDp(saves1k(v)) },
      {
        key: "watched",
        label: "Watched",
        csv: "Watched %",
        title: "Average share of the video watched",
        sets: ["overview", "watch", "all"],
        value: watched,
        render: (v) => num((x) => `${Math.round(x)}%`)(watched(v)),
      },
      {
        key: "avgWatch",
        label: "Avg watch",
        csv: "Average watch (s)",
        sets: ["watch", "all"],
        value: (v) => v.avgWatchSeconds,
        render: (v) => num((x) => `${x.toFixed(1)}s`)(v.avgWatchSeconds),
      },
      {
        key: "watchTime",
        label: "Watch time",
        csv: "Watch time (s)",
        sets: ["watch", "all"],
        value: (v) => v.watchSeconds,
        render: (v) => watchHours(v.watchSeconds),
      },
      {
        key: "subs",
        label: "Subscribers",
        csv: "Subscribers gained",
        title: "YouTube only",
        sets: ["watch", "all"],
        value: (v) => v.subscribers,
        render: (v) => plain(v.subscribers),
      },
      {
        key: "subs1k",
        label: "Subs /1k",
        csv: "Subscribers per 1k views",
        sets: ["watch", "all"],
        value: subs1k,
        render: (v) => num((x) => x.toFixed(2))(subs1k(v)),
      },
      {
        key: "gap",
        label: "Gap",
        csv: "Hours since previous post",
        title: "Time since the platform's previous post",
        sets: ["all"],
        value: (v) => v.gapHours,
        render: (v) => hours(v.gapHours),
      },
    ],
    [period],
  );

  const allTags = useMemo(() => {
    const s = new Set<string>();
    for (const v of data.videos) for (const t of tagLabels(v.tags)) s.add(t);
    return [...s].sort();
  }, [data.videos]);

  const rows = useMemo(() => {
    const platforms = platformsFor(prefs.platform);
    const needle = q.trim().toLowerCase();
    const since = posted ? data.nowMs - posted * 86_400_000 : null;
    return data.videos.filter(
      (v) =>
        platforms.includes(v.platform) &&
        (!needle || v.title.toLowerCase().includes(needle) || v.external_id === needle) &&
        (!since || (v.publishedAt !== null && Date.parse(v.publishedAt) >= since)) &&
        (!tag || (tag === "__untagged" ? !isTagged(v.tags) : tagLabels(v.tags).includes(tag))),
    );
  }, [data.videos, data.nowMs, prefs.platform, q, posted, tag]);

  const columns: Column<InsightVideo>[] = [
    {
      key: "video",
      label: "Video",
      align: "left",
      sort: (v) => v.title.toLowerCase(),
      className: "min-w-64 max-w-sm",
      render: (v) => (
        <div className="space-y-1 py-0.5">
          <VideoCell v={v} sub={PLATFORM_NAMES[v.platform]} />
          {set === "all" && isTagged(v.tags) && <TagChips picked={tagLabels(v.tags)} />}
        </div>
      ),
    },
    ...defs
      .filter((d) => d.sets.includes(set))
      .map(
        (d): Column<InsightVideo> => ({
          key: d.key,
          label: d.label,
          title: d.title,
          align: d.key === "posted" ? "left" : "right",
          sort: d.value,
          className: "tabular-nums whitespace-nowrap",
          render: (v) => (d.render ? d.render(v) : String(d.value(v) ?? "-")),
        }),
      ),
  ];

  function exportCsv() {
    const head = ["Platform", "Video id", "Title", "URL", "Tags", ...defs.map((d) => d.csv)];
    const body = rows.map((v) => [
      PLATFORM_NAMES[v.platform],
      v.external_id,
      v.title,
      v.url,
      tagLabels(v.tags).join("; "),
      ...defs.map((d) => {
        const x = d.value(v);
        return typeof x === "number" ? Number(x.toFixed(4)) : x;
      }),
    ]);
    downloadCsv(`salelinx-posts-${data.today}.csv`, head, body);
  }

  return (
    <InsightsFrame title="Posts" load={load}>
      <Card
        title={`${rows.length} video${rows.length === 1 ? "" : "s"}`}
        sub="One row per platform copy. Click a header to sort."
        flush
        actions={
          <button type="button" onClick={exportCsv} className={chipClass(false)}>
            Download CSV
          </button>
        }
      >
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--admin-border)] px-4 py-2.5">
          <div className="flex flex-wrap gap-1" role="group" aria-label="Columns">
            {SETS.map((s) => (
              <button key={s.key} type="button" aria-pressed={set === s.key} onClick={() => setSet(s.key)} className={chipClass(set === s.key)}>
                {s.label}
              </button>
            ))}
          </div>
          <span className="mx-1 hidden h-4 w-px bg-[var(--admin-border)] sm:block" aria-hidden />
          <select value={posted} onChange={(e) => setPosted(Number(e.target.value) as typeof posted)} className={selectClass} aria-label="Posted">
            <option value={0}>Posted any time</option>
            <option value={7}>Posted in the last 7 days</option>
            <option value={30}>Posted in the last 30 days</option>
            <option value={90}>Posted in the last 90 days</option>
          </select>
          <select value={tag} onChange={(e) => setTag(e.target.value)} className={selectClass} aria-label="Tag">
            <option value="">Any tag</option>
            <option value="__untagged">Untagged</option>
            {allTags.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search titles"
            className={`${selectClass} min-w-40 flex-1 sm:w-56 sm:flex-none`}
          />
        </div>
        <DataTable<InsightVideo>
          rows={rows}
          columns={columns}
          rowKey={(v) => v.key}
          initialSort={{ key: "posted", desc: true }}
          pageSize={50}
          minWidth={set === "all" ? 2600 : 960}
          empty="No videos match."
        />
        <p className="border-t border-[var(--admin-border)] px-4 py-2 text-[11px] text-zinc-400">
          Views at an age come from the hourly snapshots of a video&apos;s first 8 days, so videos from before those
          began show dashes there. Badges compare with our typical post on the same platform: {formatIndex(1)} is
          typical.
        </p>
      </Card>
    </InsightsFrame>
  );
}
