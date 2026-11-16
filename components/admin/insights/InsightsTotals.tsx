"use client";

// /admin/marketing/insights, Stats > Totals: the period at a glance. Totals
// gained against the period before, views per day by platform, how the
// platforms split it, where the views came from (new posts or ones already
// up), and the posts that gained most. Stats > Overview (/admin/marketing) has
// the index view of the same posts.

import { PlatformLogo } from "@/components/admin/marketing/PlatformLogo";
import { IndexBadge } from "@/components/admin/social/IndexBadge";
import type { MarketingPlatform } from "@/lib/admin/marketing";
import {
  AGE_BUCKETS,
  ageBucket,
  change,
  compact,
  count,
  coverage,
  engagementRate,
  followersGained,
  followerSeries,
  MIN_VIEWS_FOR_RATES,
  percent,
  periodWindow,
  shortDay,
  signedPercent,
  watchHours,
  weekdayDay,
  windowSeries,
  windowTotals,
  type Gains,
  type InsightVideo,
} from "@/lib/social/insights";
import type { InsightsLoad } from "@/lib/social/load";
import { PLATFORM_NAMES } from "@/lib/social/types";
import { InlineBar, SegmentedBar, StackedColumns, type Segment } from "./charts";
import { DataTable } from "./DataTable";
import { InsightsFrame } from "./InsightsFrame";
import { useInsightsPrefs } from "./prefs";
import { Card, Delta, PLATFORM_COLOR, PlatformKey, platformsFor, StatTile, VideoCell } from "./ui";

const engaged = (g: Pick<Gains, "likes" | "comments" | "shares" | "saves">) => g.likes + g.comments + g.shares + g.saves;

const sumOrNull = (xs: (number | null)[]) => (xs.some((x) => x !== null) ? xs.reduce<number>((s, x) => s + (x ?? 0), 0) : null);

// Text inside the platform blocks: white on the blue, orange and green, near-black on amber.
const INK: Record<MarketingPlatform, Segment["ink"]> = { youtube: "light", instagram: "light", tiktok: "light", facebook: "dark" };

export function InsightsTotals({ load }: { load: InsightsLoad }) {
  const [prefs] = useInsightsPrefs();
  const { data } = load;
  const platforms = platformsFor(prefs.platform);
  const period = prefs.period;
  const w = periodWindow(data.today, period);
  const wBefore = periodWindow(data.today, period, 1);
  const earlier = coverage(data, wBefore) !== "none";

  const now = windowTotals(data, platforms, w);
  const before = windowTotals(data, platforms, wBefore);
  const followersNow = sumOrNull(platforms.map((p) => followersGained(data, p, w)));
  const followersBefore = sumOrNull(platforms.map((p) => followersGained(data, p, wBefore)));
  const perPlatform = platforms.map((p) => followerSeries(data, p, w));
  const followerDaily = perPlatform[0]?.map((_, i) => perPlatform.reduce((s, list) => s + (list[i] ?? 0), 0)) ?? [];

  const spark = (value: (g: Gains, uploads: number) => number) => windowSeries(data, platforms, w, value);
  const days = spark(() => 0).days;

  const tiles: {
    label: string;
    hint: string;
    now: number | null;
    before: number | null;
    format: (n: number | null) => string;
    series: number[];
  }[] = [
    {
      label: "Views gained",
      hint: "New views on every video, from the daily snapshots",
      now: now.views,
      before: before.views,
      format: compact,
      series: spark((g) => g.views).values,
    },
    {
      label: "Engagements",
      hint: "Likes, comments, shares and saves gained",
      now: engaged(now),
      before: engaged(before),
      format: compact,
      series: spark((g) => engaged(g)).values,
    },
    {
      label: "Engagement rate",
      hint: "Engagements gained per view gained",
      now: now.views ? engaged(now) / now.views : null,
      before: before.views ? engaged(before) / before.views : null,
      format: (x) => percent(x),
      series: spark((g) => (g.views ? engaged(g) / g.views : 0)).values,
    },
    { label: "Likes", hint: "Likes gained", now: now.likes, before: before.likes, format: compact, series: spark((g) => g.likes).values },
    {
      label: "Comments",
      hint: "Comments gained",
      now: now.comments,
      before: before.comments,
      format: compact,
      series: spark((g) => g.comments).values,
    },
    {
      label: "Shares",
      hint: "Shares gained. Facebook gives no share count for Reels",
      now: now.shares,
      before: before.shares,
      format: compact,
      series: spark((g) => g.shares).values,
    },
    {
      label: "Saves",
      hint: "Saves gained, Instagram only",
      now: now.saves,
      before: before.saves,
      format: compact,
      series: spark((g) => g.saves).values,
    },
    {
      label: "Watch time",
      hint: "Hours watched, YouTube and Instagram (YouTube runs two or three days behind)",
      now: now.watchSeconds,
      before: before.watchSeconds,
      format: watchHours,
      series: spark((g) => g.watchSeconds / 3600).values,
    },
    {
      label: "Followers gained",
      hint: "Net change in followers across the accounts",
      now: followersNow,
      before: followersBefore,
      format: (n) => (n === null ? "-" : `${n > 0 ? "+" : ""}${count(n)}`),
      series: followerDaily,
    },
    {
      label: "Videos posted",
      hint: "Uploads in the period, each platform's copy counted once",
      now: now.uploads,
      before: before.uploads,
      format: count,
      series: spark((_, u) => u).values,
    },
  ];

  const daily = platforms.map((p) => ({
    key: p,
    label: PLATFORM_NAMES[p],
    color: PLATFORM_COLOR[p],
    values: windowSeries(data, [p], w, (g) => g.views).values,
  }));

  const mine = data.videos.filter((v) => platforms.includes(v.platform));

  const split = platforms.map((p) => {
    const t = windowTotals(data, [p], w);
    const vids = data.videos.filter((v) => v.platform === p);
    return {
      platform: p,
      views: t.views,
      rate: t.views >= MIN_VIEWS_FOR_RATES ? engaged(t) / t.views : null,
      followers: followersGained(data, p, w),
      uploads: t.uploads,
      lifetime: vids.reduce((s, v) => s + (v.views ?? 0), 0),
      videos: vids.length,
    };
  });
  const maxViews = Math.max(0, ...split.map((s) => s.views));

  const sources = AGE_BUCKETS.map((bucket) => {
    const vids = mine.filter((v) => ageBucket(v.publishedAt, w) === bucket);
    return { bucket, views: vids.reduce((s, v) => s + v.gained[period].views, 0), videos: vids.filter((v) => v.gained[period].views > 0).length };
  });
  const sourceTotal = sources.reduce((s, x) => s + x.views, 0);

  const top = [...mine].filter((v) => v.gained[period].views > 0).sort((a, b) => b.gained[period].views - a.gained[period].views);

  return (
    <InsightsFrame title="Totals" load={load}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map((t) => {
          const c = earlier ? change(t.now, t.before) : null;
          return (
            <StatTile
              key={t.label}
              label={t.label}
              hint={t.hint}
              value={t.format(t.now)}
              spark={t.series}
              sparkLabels={days.map(shortDay)}
              delta={
                <Delta
                  value={c}
                  text={earlier ? signedPercent(c) : ""}
                  note={earlier ? `vs previous ${period}d (${t.format(t.before)})` : "no earlier figures"}
                />
              }
            />
          );
        })}
      </div>

      <Card
        title="Views gained per day"
        sub={`Last ${period} days`}
        table={{
          head: ["Day", ...daily.map((d) => d.label), "Total"],
          rows: days.map((d, i) => [
            weekdayDay(d),
            ...daily.map((s) => count(s.values[i])),
            count(daily.reduce((sum, s) => sum + s.values[i], 0)),
          ]),
        }}
      >
        <StackedColumns
          name={`Views gained per day, last ${period} days`}
          labels={days}
          series={daily}
          format={compact}
          tickLabel={shortDay}
          tooltipLabel={weekdayDay}
          integer
          height={220}
          legend={daily.length > 1 ? <PlatformKey platforms={platforms} /> : undefined}
        />
      </Card>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
        <Card title="By platform" sub={`Last ${period} days`} className="lg:col-span-3" flush>
          <div className="space-y-3">
            {platforms.length > 1 && (
              <div className="px-4 pt-4">
                <SegmentedBar
                  name="Share of views gained"
                  format={count}
                  parts={split.map((s) => ({
                    key: s.platform,
                    label: PLATFORM_NAMES[s.platform],
                    value: s.views,
                    color: PLATFORM_COLOR[s.platform],
                    ink: INK[s.platform],
                  }))}
                />
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="text-xs text-zinc-500">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Platform</th>
                    <th className="px-3 py-2 text-right font-medium">Views gained</th>
                    <th className="px-3 py-2 text-right font-medium" title="Engagements gained per view gained">
                      Eng. rate
                    </th>
                    <th className="px-3 py-2 text-right font-medium">Followers</th>
                    <th className="px-3 py-2 text-right font-medium">Posted</th>
                    <th className="px-4 py-2 text-right font-medium" title="Lifetime views on every tracked video">
                      All-time views
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {split.map((s) => (
                    <tr key={s.platform} className="border-t border-[var(--admin-border)]">
                      <td className="px-4 py-2">
                        <span className="flex items-center gap-2">
                          <PlatformLogo platform={s.platform} size={16} />
                          {PLATFORM_NAMES[s.platform]}
                        </span>
                      </td>
                      <td className="w-36 px-3 py-2 text-right tabular-nums">
                        {count(s.views)}
                        <span className="text-xs text-zinc-400"> {now.views ? `${Math.round((s.views / now.views) * 100)}%` : ""}</span>
                        <InlineBar value={s.views} max={maxViews} color={PLATFORM_COLOR[s.platform]} />
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{percent(s.rate)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {s.followers === null ? "-" : `${s.followers > 0 ? "+" : ""}${count(s.followers)}`}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{s.uploads}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-zinc-500">
                        {count(s.lifetime)}
                        <span className="block text-[11px] text-zinc-400">{s.videos} videos</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Card>

        <Card title="Where the views came from" sub={`Views gained in the last ${period} days, by when the post went up`} className="lg:col-span-2" flush>
          <table className="w-full text-sm">
            <tbody>
              {sources.map((s) => (
                <tr key={s.bucket} className="border-t border-[var(--admin-border)] first:border-t-0">
                  <td className="px-4 py-2.5">
                    {s.bucket}
                    <span className="block text-[11px] text-zinc-400">
                      {s.videos} video{s.videos === 1 ? "" : "s"} gaining
                    </span>
                  </td>
                  <td className="w-40 px-4 py-2.5 text-right tabular-nums">
                    {count(s.views)}
                    <span className="text-xs text-zinc-400"> {sourceTotal ? `${Math.round((s.views / sourceTotal) * 100)}%` : ""}</span>
                    <InlineBar value={s.views} max={Math.max(...sources.map((x) => x.views))} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-[var(--admin-border)] px-4 py-2 text-[11px] text-zinc-400">
            A high share from older posts means the back catalogue still earns; see Lifecycle.
          </p>
        </Card>
      </div>

      <Card title="Most views gained" sub={`Last ${period} days`} flush>
        <DataTable<InsightVideo>
          rows={top}
          rowKey={(v) => v.key}
          pageSize={10}
          minWidth={760}
          initialSort={{ key: "gained", desc: true }}
          empty="No views gained in this period yet."
          columns={[
            {
              key: "video",
              label: "Video",
              align: "left",
              sort: (v) => v.title.toLowerCase(),
              render: (v) => (
                <VideoCell v={v} sub={v.publishedAt ? `${PLATFORM_NAMES[v.platform]} · ${shortDay(v.publishedAt.slice(0, 10))}` : PLATFORM_NAMES[v.platform]} />
              ),
              className: "max-w-sm",
            },
            {
              key: "gained",
              label: "Gained",
              align: "right",
              sort: (v) => v.gained[period].views,
              render: (v) => <span className="font-semibold tabular-nums">{count(v.gained[period].views)}</span>,
            },
            {
              key: "share",
              label: "Of period",
              align: "right",
              title: "Share of every view gained in the period",
              sort: (v) => v.gained[period].views,
              render: (v) => <span className="tabular-nums text-zinc-500">{now.views ? percent(v.gained[period].views / now.views) : "-"}</span>,
            },
            {
              key: "views",
              label: "All-time",
              align: "right",
              sort: (v) => v.views,
              render: (v) => <span className="tabular-nums text-zinc-500">{count(v.views)}</span>,
            },
            {
              key: "rate",
              label: "Eng. rate",
              align: "right",
              sort: (v) => engagementRate(v),
              render: (v) => <span className="tabular-nums">{percent(engagementRate(v))}</span>,
            },
            {
              key: "index",
              label: "7d vs typical",
              align: "right",
              sort: (v) => v.index[168],
              render: (v) => <IndexBadge value={v.index[168]} />,
            },
          ]}
        />
      </Card>
    </InsightsFrame>
  );
}
