"use client";

// /admin/marketing/insights/growth: the accounts. Followers on each platform
// and how fast they move, how many views it takes to win one, total audience,
// and lifetime views over time. Follower counts sit at very different sizes,
// so each platform gets its own small chart rather than sharing one axis.

import { PlatformLogo } from "@/components/admin/marketing/PlatformLogo";
import type { MarketingPlatform } from "@/lib/admin/marketing";
import {
  change,
  compact,
  count,
  coverage,
  followersGained,
  followersOn,
  followerSeries,
  MIN_VIEWS_FOR_RATES,
  periodWindow,
  shortDay,
  signedPercent,
  subs1k,
  weekdayDay,
  windowSeries,
  windowTotals,
  type InsightsData,
} from "@/lib/social/insights";
import type { InsightsLoad } from "@/lib/social/load";
import { PLATFORM_NAMES } from "@/lib/social/types";
import { LineChart, StackedColumns } from "./charts";
import { InsightsFrame } from "./InsightsFrame";
import { useInsightsPrefs } from "./prefs";
import { Card, Delta, Empty, PLATFORM_COLOR, PlatformKey, platformsFor, StatTile, VideoCell } from "./ui";

const signed = (n: number | null) => (n === null ? "-" : `${n > 0 ? "+" : ""}${count(n)}`);

/** Each day's count carried forward from the last one recorded, from the first. */
function carried(data: InsightsData, p: MarketingPlatform, key: "followers" | "lifetimeViews"): (number | null)[] {
  const out: (number | null)[] = [];
  let last: number | null = null;
  for (const v of data.daily[p][key]) {
    if (v !== null) last = v;
    out.push(last);
  }
  return out;
}

export function InsightsGrowth({ load }: { load: InsightsLoad }) {
  const [prefs] = useInsightsPrefs();
  const { data } = load;
  const period = prefs.period;
  const platforms = platformsFor(prefs.platform);
  const w = periodWindow(data.today, period);
  const wBefore = periodWindow(data.today, period, 1);
  const earlier = coverage(data, wBefore) !== "none";

  // From the first day anything was recorded, so the charts don't open on months of nothing.
  const first = data.days.findIndex((_, i) =>
    platforms.some((p) => data.daily[p].followers[i] !== null || data.daily[p].lifetimeViews[i] !== null),
  );
  const span = first < 0 ? [] : data.days.slice(first);

  const followers = Object.fromEntries(platforms.map((p) => [p, carried(data, p, "followers")])) as Record<
    MarketingPlatform,
    (number | null)[]
  >;

  const cards = platforms.map((p) => {
    const gained = followersGained(data, p, w);
    const before = followersGained(data, p, wBefore);
    const views = windowTotals(data, [p], w).views;
    return {
      platform: p,
      now: followersOn(data, p, data.today),
      gained,
      before,
      views,
      per1k: gained !== null && views >= MIN_VIEWS_FOR_RATES ? (gained / views) * 1000 : null,
      viewsPerFollower: gained && gained > 0 ? views / gained : null,
      spark: followers[p].slice(first < 0 ? 0 : first),
    };
  });

  const total = span.map((_, i) => {
    const vals = platforms.map((p) => followers[p][first + i]);
    return vals.some((v) => v !== null) ? vals.reduce<number>((s, v) => s + (v ?? 0), 0) : null;
  });
  const totalNow = cards.reduce<number | null>((s, c) => (c.now === null ? s : (s ?? 0) + c.now), null);
  const gainedAll = cards.some((c) => c.gained !== null) ? cards.reduce((s, c) => s + (c.gained ?? 0), 0) : null;
  const beforeAll = cards.some((c) => c.before !== null) ? cards.reduce((s, c) => s + (c.before ?? 0), 0) : null;

  const netDaily = platforms.map((p) => ({
    key: p,
    label: PLATFORM_NAMES[p],
    color: PLATFORM_COLOR[p],
    values: followerSeries(data, p, w).map((x) => x ?? 0),
  }));
  const netDays = windowSeries(data, platforms, w, () => 0).days;

  const youtube = data.videos
    .filter((v) => v.platform === "youtube" && platforms.includes("youtube") && v.subscribers !== null && v.subscribers > 0)
    .sort((a, b) => b.subscribers! - a.subscribers!);

  return (
    <InsightsFrame title="Growth" load={load}>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile
          label="All followers"
          value={count(totalNow)}
          hint="Every selected account added up"
          spark={total.filter((x): x is number => x !== null)}
          delta={
            <Delta
              value={earlier ? change(gainedAll, beforeAll) : null}
              text={signed(gainedAll)}
              note={`in ${period}d${earlier ? `, ${signed(beforeAll)} the ${period}d before` : ""}`}
            />
          }
        />
        {cards.map((c) => (
          <div key={c.platform} className="flex min-w-0 flex-col gap-1 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3.5 py-3">
            <p className="flex items-center gap-1.5 text-xs text-zinc-500">
              <PlatformLogo platform={c.platform} size={13} />
              {PLATFORM_NAMES[c.platform]}
            </p>
            <p className="text-2xl font-semibold tracking-tight">{count(c.now)}</p>
            <Delta value={c.gained} text={signed(c.gained)} note={`in ${period}d${earlier ? `, ${signed(c.before)} before` : ""}`} />
            <p className="text-[11px] text-zinc-400">
              {c.per1k === null ? "Under 100 views gained" : `${c.per1k.toFixed(1)} per 1,000 views`}
              {c.viewsPerFollower !== null && `, one per ${count(c.viewsPerFollower)} views`}
            </p>
          </div>
        ))}
      </div>

      <Card title="Followers" sub="Each platform on its own scale">
        {span.length === 0 ? (
          <Empty>No follower counts yet.</Empty>
        ) : (
          <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2">
            {cards.map((c) => (
              <div key={c.platform} className="min-w-0">
                <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-zinc-600">
                  <PlatformLogo platform={c.platform} size={13} />
                  {PLATFORM_NAMES[c.platform]}
                  <span className="ml-auto font-semibold tabular-nums text-zinc-900">{count(c.now)}</span>
                </p>
                <LineChart
                  name={`${PLATFORM_NAMES[c.platform]} followers`}
                  labels={span}
                  series={[{ key: c.platform, label: "Followers", color: PLATFORM_COLOR[c.platform], values: c.spark }]}
                  format={compact}
                  tickLabel={shortDay}
                  tooltipLabel={weekdayDay}
                  fit
                  area
                  integer
                  height={150}
                />
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card
          title="Net followers per day"
          sub={`Last ${period} days`}
          table={{
            head: ["Day", ...netDaily.map((s) => s.label)],
            rows: netDays.map((d, i) => [weekdayDay(d), ...netDaily.map((s) => signed(s.values[i]))]),
          }}
        >
          <StackedColumns
            name="Net followers gained per day"
            labels={netDays}
            series={netDaily}
            format={(n) => (n > 0 ? `+${compact(n)}` : compact(n))}
            tickLabel={shortDay}
            tooltipLabel={weekdayDay}
            integer
            legend={netDaily.length > 1 ? <PlatformKey platforms={platforms} /> : undefined}
          />
        </Card>
        <Card
          title="Total audience"
          sub="Followers on the selected accounts, added up"
          table={{ head: ["Day", "Followers"], rows: span.map((d, i) => [weekdayDay(d), count(total[i])]) }}
        >
          <LineChart
            name="Total followers"
            labels={span}
            series={[{ key: "total", label: "Followers", color: "var(--admin-chart-accent)", values: total }]}
            format={compact}
            tickLabel={shortDay}
            tooltipLabel={weekdayDay}
            fit
            area
            integer
          />
        </Card>
      </div>

      <Card title="Turning views into followers" sub={`Last ${period} days`} flush>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-sm">
            <thead className="text-xs text-zinc-500">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Platform</th>
                <th className="px-3 py-2 text-right font-medium">Views gained</th>
                <th className="px-3 py-2 text-right font-medium">Followers gained</th>
                <th className="px-3 py-2 text-right font-medium">Per 1,000 views</th>
                <th className="px-3 py-2 text-right font-medium">Views per follower</th>
                <th className="px-4 py-2 text-right font-medium">vs the {period}d before</th>
              </tr>
            </thead>
            <tbody>
              {cards.map((c) => (
                <tr key={c.platform} className="border-t border-[var(--admin-border)]">
                  <td className="px-4 py-2">
                    <span className="flex items-center gap-2">
                      <PlatformLogo platform={c.platform} size={16} />
                      {PLATFORM_NAMES[c.platform]}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{count(c.views)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{signed(c.gained)}</td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">{c.per1k === null ? "-" : c.per1k.toFixed(1)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{c.viewsPerFollower === null ? "-" : count(c.viewsPerFollower)}</td>
                  <td className="px-4 py-2 text-right">
                    {earlier ? <Delta value={change(c.gained, c.before)} text={signedPercent(change(c.gained, c.before))} /> : <span className="text-xs text-zinc-400">no earlier figures</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Lifetime views" sub="Every tracked video's views added up, each platform on its own scale">
        {span.length === 0 ? (
          <Empty>No views yet.</Empty>
        ) : (
          <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2">
            {platforms.map((p) => {
              const values = carried(data, p, "lifetimeViews").slice(first);
              return (
                <div key={p} className="min-w-0">
                  <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-zinc-600">
                    <PlatformLogo platform={p} size={13} />
                    {PLATFORM_NAMES[p]}
                    <span className="ml-auto font-semibold tabular-nums text-zinc-900">{count(values[values.length - 1] ?? null)}</span>
                  </p>
                  <LineChart
                    name={`${PLATFORM_NAMES[p]} lifetime views`}
                    labels={span}
                    series={[{ key: p, label: "Views", color: PLATFORM_COLOR[p], values }]}
                    format={compact}
                    tickLabel={shortDay}
                    tooltipLabel={weekdayDay}
                    fit
                    height={150}
                  />
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {platforms.includes("youtube") && (
        <Card title="Subscribers by video" sub="YouTube, lifetime, from YouTube Analytics" flush>
          {youtube.length === 0 ? (
            <Empty>No subscribers recorded against a video yet. This needs the YouTube login.</Empty>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs text-zinc-500">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Video</th>
                  <th className="px-3 py-2 text-right font-medium">Subscribers</th>
                  <th className="px-3 py-2 text-right font-medium">Per 1,000 views</th>
                  <th className="px-4 py-2 text-right font-medium">Views</th>
                </tr>
              </thead>
              <tbody>
                {youtube.slice(0, 10).map((v) => (
                  <tr key={v.key} className="border-t border-[var(--admin-border)]">
                    <td className="max-w-md px-4 py-2">
                      <VideoCell v={v} sub={v.publishedAt ? shortDay(v.publishedAt.slice(0, 10)) : undefined} />
                    </td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">{count(v.subscribers)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{subs1k(v)?.toFixed(2) ?? "-"}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-zinc-500">{count(v.views)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}
    </InsightsFrame>
  );
}
