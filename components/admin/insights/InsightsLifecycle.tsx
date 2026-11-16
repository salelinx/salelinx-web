"use client";

// /admin/marketing/insights/lifecycle: how a post's views arrive. How much of a
// first week lands by each age, how long until half of it has, how early the
// first numbers say how the week will go, and how much the back catalogue keeps
// earning. Views at an age come from marketing_video_age_points
// (054_social_tags.sql), so only videos tracked hourly from posting have the
// early ages.

import { PlatformLogo } from "@/components/admin/marketing/PlatformLogo";
import { median } from "@/lib/social/experiments";
import {
  AGE_BUCKETS,
  AGE_SHORT,
  AGES,
  ageBucket,
  compact,
  count,
  earlySignal,
  halfLifeHours,
  hours,
  percent,
  periodWindow,
  shortDay,
  weekShare,
  type Age,
  type InsightVideo,
} from "@/lib/social/insights";
import type { InsightsLoad } from "@/lib/social/load";
import { PLATFORM_NAMES } from "@/lib/social/types";
import { InlineBar, LineChart, StackedColumns } from "./charts";
import { InsightsFrame } from "./InsightsFrame";
import { useInsightsPrefs } from "./prefs";
import { Card, Empty, PLATFORM_COLOR, PlatformKey, platformsFor, VideoCell } from "./ui";

const EARLY: Age[] = [1, 6, 24, 72];
const MIN_FOR_SIGNAL = 5;
// A point on the build-up curve needs this many posts measured at both ages.
const MIN_FOR_CURVE = 3;
const WEEKS = 13;

function strength(rho: number): { word: string; cls: string } {
  if (rho >= 0.8) return { word: "strong", cls: "bg-blue-600 text-white" };
  if (rho >= 0.6) return { word: "good", cls: "bg-blue-100 text-blue-800" };
  if (rho >= 0.4) return { word: "rough", cls: "bg-zinc-100 text-zinc-700" };
  return { word: "weak", cls: "bg-orange-100 text-orange-800" };
}

export function InsightsLifecycle({ load }: { load: InsightsLoad }) {
  const [prefs] = useInsightsPrefs();
  const { data } = load;
  const period = prefs.period;
  const platforms = platformsFor(prefs.platform);
  const w = periodWindow(data.today, period);
  const mine = (p: string) => data.videos.filter((v) => v.platform === p);

  const curves = platforms.map((p) => {
    const vids = mine(p);
    const shares = AGES.map((h) => vids.map((v) => weekShare(v, h)).filter((x): x is number => x !== null));
    return {
      key: p,
      label: PLATFORM_NAMES[p],
      color: PLATFORM_COLOR[p],
      values: shares.map((xs) => (xs.length >= MIN_FOR_CURVE ? median(xs) : null)),
      counts: shares.map((xs) => xs.length),
    };
  });
  // 7 days is always 100%, so a curve needs an earlier point to show anything.
  const anyCurve = curves.some((c) => c.values.slice(0, -1).some((x) => x !== null));

  const ages = platforms.map((p) => {
    const vids = mine(p);
    return {
      platform: p,
      half: median(vids.map(halfLifeHours).filter((x): x is number => x !== null)),
      nHalf: vids.filter((v) => halfLifeHours(v) !== null).length,
      at: AGES.map((h) => {
        const xs = vids.map((v) => v.at[h]).filter((x): x is number => x !== null);
        return { median: median(xs), n: xs.length };
      }),
      signal: EARLY.map((h) => earlySignal(vids, h)),
    };
  });

  const buckets = platforms.map((p) => {
    const vids = mine(p);
    const parts = AGE_BUCKETS.map((b) => vids.filter((v) => ageBucket(v.publishedAt, w) === b).reduce((s, v) => s + v.gained[period].views, 0));
    return { platform: p, parts, total: parts.reduce((s, x) => s + x, 0) };
  });

  const weekLabels = Array.from({ length: WEEKS }, (_, i) => (i === WEEKS - 1 ? `${i}+` : String(i)));
  const byWeek = platforms.map((p) => ({
    key: p,
    label: PLATFORM_NAMES[p],
    color: PLATFORM_COLOR[p],
    values: weekLabels.map((_, i) =>
      mine(p)
        .filter((v) => v.ageDays !== null && (i === WEEKS - 1 ? v.ageDays >= i * 7 : Math.floor(v.ageDays / 7) === i))
        .reduce((s, v) => s + v.gained[period].views, 0),
    ),
  }));

  const evergreen = data.videos
    .filter((v) => platforms.includes(v.platform) && v.publishedAt && v.publishedAt.slice(0, 10) < w.from && v.gained[period].views > 0)
    .sort((a, b) => b.gained[period].views - a.gained[period].views)
    .slice(0, 10);

  const share = (v: InsightVideo) => (v.views ? v.gained[period].views / v.views : null);

  return (
    <InsightsFrame title="Lifecycle" load={load}>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
        <Card
          title="How a first week builds up"
          sub="Median share of a post's 7-day views reached by each age"
          className="lg:col-span-3"
          table={{
            head: ["Platform", ...AGES.map((h) => AGE_SHORT[h])],
            rows: curves.map((c) => [c.label, ...c.values.map((x, i) => `${percent(x, true)} (${c.counts[i]})`)]),
          }}
        >
          {anyCurve ? (
            <LineChart
              name="Share of first-week views by age"
              labels={AGES.map((h) => AGE_SHORT[h])}
              series={curves}
              format={(x) => percent(x, true)}
              tooltipLabel={(l) => `${l} after posting`}
              legend={curves.length > 1 ? <PlatformKey platforms={platforms} /> : undefined}
              height={220}
            />
          ) : (
            <Empty>
              Not enough posts tracked hourly from posting through their first week yet ({MIN_FOR_CURVE} a platform
              needed). Every new post adds to it.
            </Empty>
          )}
        </Card>
        <Card title="Half-life" sub="Until half the first week's views are in" className="lg:col-span-2" flush>
          <ul className="divide-y divide-[var(--admin-border)]">
            {ages.map((a) => (
              <li key={a.platform} className="flex items-center gap-3 px-4 py-3">
                <PlatformLogo platform={a.platform} size={18} />
                <span className="flex-1 text-sm">{PLATFORM_NAMES[a.platform]}</span>
                <span className="text-[11px] text-zinc-400">{a.nHalf} posts</span>
                <span className="w-16 text-right text-xl font-semibold tabular-nums">{hours(a.half)}</span>
              </li>
            ))}
          </ul>
          <p className="border-t border-[var(--admin-border)] px-4 py-2 text-[11px] text-zinc-400">
            Interpolated between 1h, 6h, 24h, 3d and 7d, so read it to the nearest few hours.
          </p>
        </Card>
      </div>

      <Card
        title="Typical views at each age"
        sub="Median post at each age, over the posts measured at that age (so columns can come from different posts)"
        flush
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-xs text-zinc-500">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Platform</th>
                {AGES.map((h) => (
                  <th key={h} className="px-3 py-2 text-right font-medium last:pr-4">
                    {AGE_SHORT[h]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ages.map((a) => (
                <tr key={a.platform} className="border-t border-[var(--admin-border)]">
                  <td className="px-4 py-2">
                    <span className="flex items-center gap-2">
                      <PlatformLogo platform={a.platform} size={16} />
                      {PLATFORM_NAMES[a.platform]}
                    </span>
                  </td>
                  {a.at.map((x, i) => (
                    <td key={AGES[i]} className="px-3 py-2 text-right tabular-nums last:pr-4">
                      {count(x.median)}
                      <span className="block text-[11px] text-zinc-400">{x.n}</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="When can you judge a post?" sub="How well views at each age rank posts the way their first week does" flush>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead className="text-xs text-zinc-500">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Platform</th>
                {EARLY.map((h) => (
                  <th key={h} className="px-3 py-2 text-center font-medium last:pr-4">
                    At {AGE_SHORT[h]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ages.map((a) => (
                <tr key={a.platform} className="border-t border-[var(--admin-border)]">
                  <td className="px-4 py-2">
                    <span className="flex items-center gap-2">
                      <PlatformLogo platform={a.platform} size={16} />
                      {PLATFORM_NAMES[a.platform]}
                    </span>
                  </td>
                  {a.signal.map((s, i) => {
                    if (s.rho === null || s.n < MIN_FOR_SIGNAL)
                      return (
                        <td key={EARLY[i]} className="px-3 py-2 text-center text-xs text-zinc-400 last:pr-4">
                          {s.n ? `${s.n} post${s.n === 1 ? "" : "s"}, too few` : "-"}
                        </td>
                      );
                    const st = strength(s.rho);
                    return (
                      <td key={EARLY[i]} className="px-3 py-2 text-center last:pr-4">
                        <span className={`inline-flex min-w-24 justify-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${st.cls}`}>
                          {st.word} <span className="tabular-nums opacity-80">{s.rho.toFixed(2)}</span>
                        </span>
                        <span className="block text-[11px] text-zinc-400">{s.n} posts</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-[var(--admin-border)] px-4 py-2 text-[11px] text-zinc-400">
          Rank correlation with views at 7 days: 1 means the early order always holds, 0 means it tells you nothing.
          Once it reads strong, that age is enough to call a post and plan the next one. Needs {MIN_FOR_SIGNAL} posts.
        </p>
      </Card>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card
          title="Views by post age"
          sub={`Views gained in the last ${period} days, by how many weeks old the post is now`}
          table={{
            head: ["Weeks old", ...byWeek.map((s) => s.label)],
            rows: weekLabels.map((l, i) => [l, ...byWeek.map((s) => count(s.values[i]))]),
          }}
        >
          <StackedColumns
            name="Views gained by post age in weeks"
            labels={weekLabels}
            series={byWeek}
            format={compact}
            tooltipLabel={(l) => (l.endsWith("+") ? `${l.slice(0, -1)} weeks or older` : l === "0" ? "Under a week old" : `${l} week${l === "1" ? "" : "s"} old`)}
            integer
            height={200}
            legend={byWeek.length > 1 ? <PlatformKey platforms={platforms} /> : undefined}
          />
        </Card>

        <Card title="New posts against the back catalogue" sub={`Views gained in the last ${period} days`} flush>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="text-xs text-zinc-500">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Platform</th>
                  {AGE_BUCKETS.map((b) => (
                    <th key={b} className="px-3 py-2 text-right font-medium last:pr-4">
                      {b.replace("Posted this period", "New")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {buckets.map((b) => (
                  <tr key={b.platform} className="border-t border-[var(--admin-border)]">
                    <td className="px-4 py-2">
                      <span className="flex items-center gap-2">
                        <PlatformLogo platform={b.platform} size={16} />
                        {PLATFORM_NAMES[b.platform]}
                      </span>
                      <span className="text-[11px] text-zinc-400">{count(b.total)} views</span>
                    </td>
                    {b.parts.map((x, i) => (
                      <td key={AGE_BUCKETS[i]} className="w-28 px-3 py-2 text-right tabular-nums last:pr-4">
                        {b.total ? percent(x / b.total, true) : "-"}
                        <InlineBar value={b.total ? x / b.total : null} max={1} color={PLATFORM_COLOR[b.platform]} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Card title="Still gaining" sub={`Posts from before the last ${period} days with the most views since`} flush>
        {evergreen.length === 0 ? (
          <Empty>No older post gained views in this period.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-xs text-zinc-500">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Video</th>
                  <th className="px-3 py-2 text-right font-medium">Age</th>
                  <th className="px-3 py-2 text-right font-medium">Gained</th>
                  <th className="px-3 py-2 text-right font-medium" title="Share of its lifetime views that came in this period">
                    Of lifetime
                  </th>
                  <th className="px-4 py-2 text-right font-medium">Lifetime</th>
                </tr>
              </thead>
              <tbody>
                {evergreen.map((v) => (
                  <tr key={v.key} className="border-t border-[var(--admin-border)]">
                    <td className="max-w-md px-4 py-2">
                      <VideoCell v={v} sub={v.publishedAt ? shortDay(v.publishedAt.slice(0, 10)) : undefined} />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-zinc-500">{v.ageDays === null ? "-" : `${Math.floor(v.ageDays)}d`}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">{count(v.gained[period].views)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{percent(share(v), true)}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-zinc-500">{count(v.views)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </InsightsFrame>
  );
}
