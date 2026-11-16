"use client";

// /admin/marketing/insights/engagement: what people do once they watch. Rates
// per platform from what the period gained, the mix of likes, comments,
// shares and saves, every post's rate, the rolling rate over time, the posts
// that do best on each, and how much of a video gets watched. Rates need 100
// views on a post so one like can't swing them.

import { useMemo, useState } from "react";
import { PlatformLogo } from "@/components/admin/marketing/PlatformLogo";
import { MEASURES } from "@/lib/social/compare";
import { median } from "@/lib/social/experiments";
import {
  comments1k,
  count,
  engagementRate,
  likeRate,
  MIN_VIEWS_FOR_RATES,
  percent,
  periodWindow,
  saves1k,
  shares1k,
  shortDay,
  watched,
  weekdayDay,
  windowSeries,
  windowTotals,
  type InsightVideo,
} from "@/lib/social/insights";
import type { InsightsLoad } from "@/lib/social/load";
import { LENGTH_BUCKETS, lengthBucket } from "@/lib/social/tags";
import { PLATFORM_NAMES } from "@/lib/social/types";
import { DotRows, InlineBar, LineChart } from "./charts";
import { scaleFor } from "./InsightsCompare";
import { InsightsFrame } from "./InsightsFrame";
import { useInsightsPrefs } from "./prefs";
import { Card, Empty, PLATFORM_COLOR, PlatformKey, platformsFor, selectClass, VideoCell, videoHref } from "./ui";

const SPREAD = ["engagement", "likes", "comments1k", "shares1k", "saves1k", "watched", "subs1k"];
const per1kText = (x: number | null) => (x === null ? "-" : x.toFixed(1));

const TOPS: { key: string; title: string; value: (v: InsightVideo) => number | null; format: (x: number) => string }[] = [
  { key: "eng", title: "Engagement rate", value: engagementRate, format: (x) => percent(x) },
  { key: "like", title: "Like rate", value: likeRate, format: (x) => percent(x) },
  { key: "comm", title: "Comments per 1,000", value: comments1k, format: (x) => x.toFixed(1) },
  { key: "share", title: "Shares per 1,000", value: shares1k, format: (x) => x.toFixed(1) },
  { key: "save", title: "Saves per 1,000", value: saves1k, format: (x) => x.toFixed(1) },
  { key: "watch", title: "Watched", value: watched, format: (x) => `${Math.round(x)}%` },
];

export function InsightsEngagement({ load }: { load: InsightsLoad }) {
  const [prefs] = useInsightsPrefs();
  const { data } = load;
  const period = prefs.period;
  const platforms = platformsFor(prefs.platform);
  const w = periodWindow(data.today, period);
  const [spreadKey, setSpreadKey] = useState("engagement");
  const spread = MEASURES.find((m) => m.key === spreadKey)!;

  const videos = useMemo(() => {
    const mine = platformsFor(prefs.platform);
    return data.videos.filter((v) => mine.includes(v.platform));
  }, [data.videos, prefs.platform]);

  const rates = platforms.map((p) => {
    const t = windowTotals(data, [p], w);
    // Under 100 views a rate is noise, as for a single post.
    const v = t.views >= MIN_VIEWS_FOR_RATES ? t.views : 0;
    const mine = videos.filter((x) => x.platform === p);
    return {
      platform: p,
      views: t.views,
      likes: t.likes,
      comments: t.comments,
      shares: t.shares,
      saves: t.saves,
      like: v ? t.likes / v : null,
      c1k: v ? (t.comments / v) * 1000 : null,
      s1k: v ? (t.shares / v) * 1000 : null,
      sv1k: v ? (t.saves / v) * 1000 : null,
      eng: v ? (t.likes + t.comments + t.shares + t.saves) / v : null,
      watchPerView: v && t.watchSeconds ? t.watchSeconds / v : null,
      subs1k: v && t.subscribers ? (t.subscribers / v) * 1000 : null,
      medianPost: median(mine.map(engagementRate).filter((x): x is number => x !== null)),
    };
  });

  // A 7-day rolling rate, so a quiet day's handful of views doesn't spike the line.
  const lead = periodWindow(data.today, period + 6);
  const rolling = platforms.map((p) => {
    const views = windowSeries(data, [p], lead, (g) => g.views);
    const eng = windowSeries(data, [p], lead, (g) => g.likes + g.comments + g.shares + g.saves);
    const values = views.days.slice(6).map((_, i) => {
      let vs = 0;
      let es = 0;
      for (let j = i; j <= i + 6; j++) {
        vs += views.values[j];
        es += eng.values[j];
      }
      return vs >= 100 ? es / vs : null;
    });
    return { key: p, label: PLATFORM_NAMES[p], color: PLATFORM_COLOR[p], values, days: views.days.slice(6) };
  });
  const rollDays = rolling[0]?.days ?? [];

  const spreadRows = platforms
    .map((p) => {
      const pts = videos
        .filter((v) => v.platform === p)
        .map((v) => ({ v, x: spread.value(v) }))
        .filter((s): s is { v: InsightVideo; x: number } => s.x !== null);
      return {
        key: p,
        label: (
          <span className="flex items-center gap-2">
            <PlatformLogo platform={p} size={16} />
            {PLATFORM_NAMES[p]}
            <span className="text-[11px] text-zinc-400">{pts.length}</span>
          </span>
        ),
        dots: pts.map((s) => ({
          key: s.v.key,
          value: s.x,
          color: PLATFORM_COLOR[p],
          label: s.v.title,
          sub: `${count(s.v.views)} views`,
          href: videoHref(s.v),
        })),
        median: median(pts.map((s) => s.x)),
      };
    })
    .filter((r) => r.dots.length);
  const spreadScale = scaleFor(spread, spreadRows.flatMap((r) => r.dots.map((d) => d.value)));

  const byLength = LENGTH_BUCKETS.map((b) => {
    const mine = videos.filter((v) => lengthBucket(v.seconds) === b);
    const wv = mine.map(watched).filter((x): x is number => x !== null);
    const er = mine.map(engagementRate).filter((x): x is number => x !== null);
    return { bucket: b, n: mine.length, watched: median(wv), nWatched: wv.length, eng: median(er) };
  });
  const anyLength = byLength.some((b) => b.n > 0);

  const watchRows = platforms.map((p) => {
    const mine = videos.filter((v) => v.platform === p);
    const wv = mine.map(watched).filter((x): x is number => x !== null);
    const avg = mine.map((v) => v.avgWatchSeconds).filter((x): x is number => x !== null);
    return { platform: p, watched: median(wv), nWatched: wv.length, avg: median(avg), nAvg: avg.length };
  });

  return (
    <InsightsFrame title="Engagement" load={load}>
      <Card title="Rates by platform" sub={`From everything gained in the last ${period} days`} flush>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="text-xs text-zinc-500">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Platform</th>
                <th className="px-3 py-2 text-right font-medium">Views gained</th>
                <th className="px-3 py-2 text-right font-medium" title="Likes, comments, shares and saves per view">
                  Engagement
                </th>
                <th className="px-3 py-2 text-right font-medium">Like rate</th>
                <th className="px-3 py-2 text-right font-medium">Comments /1k</th>
                <th className="px-3 py-2 text-right font-medium">Shares /1k</th>
                <th className="px-3 py-2 text-right font-medium">Saves /1k</th>
                <th className="px-3 py-2 text-right font-medium" title="Seconds watched per view gained">
                  Watch per view
                </th>
                <th className="px-3 py-2 text-right font-medium">Subs /1k</th>
                <th className="px-4 py-2 text-right font-medium" title="The middle post's lifetime engagement rate">
                  Median post
                </th>
              </tr>
            </thead>
            <tbody>
              {rates.map((r) => (
                <tr key={r.platform} className="border-t border-[var(--admin-border)]">
                  <td className="px-4 py-2">
                    <span className="flex items-center gap-2">
                      <PlatformLogo platform={r.platform} size={16} />
                      {PLATFORM_NAMES[r.platform]}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{count(r.views)}</td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">{percent(r.eng)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{percent(r.like)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{per1kText(r.c1k)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.platform === "facebook" ? "n/a" : per1kText(r.s1k)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.platform === "instagram" ? per1kText(r.sv1k) : "n/a"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.watchPerView === null ? "-" : `${r.watchPerView.toFixed(1)}s`}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.platform === "youtube" ? (r.subs1k === null ? "-" : r.subs1k.toFixed(2)) : "n/a"}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-zinc-500">{percent(r.medianPost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-[var(--admin-border)] px-4 py-2 text-[11px] text-zinc-400">
          n/a: the platform doesn&apos;t report it. Facebook gives no share count for Reels; saves are Instagram&apos;s and
          subscribers YouTube&apos;s.
        </p>
      </Card>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card
          title="Engagement rate over time"
          sub="Rolling 7 days, engagements per view gained"
          table={{
            head: ["Day", ...rolling.map((r) => r.label)],
            rows: rollDays.map((d, i) => [weekdayDay(d), ...rolling.map((r) => percent(r.values[i]))]),
          }}
        >
          <LineChart
            name="Rolling 7-day engagement rate by platform"
            labels={rollDays}
            series={rolling}
            format={(x) => percent(x, true)}
            tickLabel={shortDay}
            tooltipLabel={(d) => `7 days to ${weekdayDay(d)}`}
            legend={rolling.length > 1 ? <PlatformKey platforms={platforms} /> : undefined}
            area={rolling.length === 1}
          />
        </Card>

        <Card title="What people do" sub={`Share of engagements gained in the last ${period} days`} flush>
          <table className="w-full text-sm">
            <thead className="text-xs text-zinc-500">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Platform</th>
                {["Likes", "Comments", "Shares", "Saves"].map((h) => (
                  <th key={h} className="px-3 py-2 text-right font-medium last:pr-4">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rates.map((r) => {
                const total = r.likes + r.comments + r.shares + r.saves;
                return (
                  <tr key={r.platform} className="border-t border-[var(--admin-border)]">
                    <td className="px-4 py-2">
                      <span className="flex items-center gap-2">
                        <PlatformLogo platform={r.platform} size={16} />
                        {PLATFORM_NAMES[r.platform]}
                      </span>
                      <span className="text-[11px] text-zinc-400">{count(total)} engagements</span>
                    </td>
                    {[r.likes, r.comments, r.shares, r.saves].map((x, i) => (
                      <td key={i} className="w-24 px-3 py-2 text-right tabular-nums last:pr-4">
                        {total ? percent(x / total, true) : "-"}
                        <InlineBar value={total ? x / total : null} max={1} />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="border-t border-[var(--admin-border)] px-4 py-2 text-[11px] text-zinc-400">
            Shares and saves take more intent than a like, so a higher share of them is the stronger signal.
          </p>
        </Card>
      </div>

      <Card
        title="Every post"
        sub={spread.hint}
        actions={
          <select value={spreadKey} onChange={(e) => setSpreadKey(e.target.value)} className={selectClass} aria-label="Measure">
            {MEASURES.filter((m) => SPREAD.includes(m.key)).map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
        }
      >
        {spreadRows.length ? (
          <DotRows
            rows={spreadRows.map((r) => ({
              ...r,
              right: <span className="text-sm font-semibold tabular-nums">{r.median === null ? "-" : spread.format(r.median)}</span>,
            }))}
            scale={spreadScale.scale}
            ticks={spreadScale.ticks}
            tickFormat={spreadScale.tickFormat}
            format={spread.format}
            rightClass="sm:w-16 sm:text-right"
          />
        ) : (
          <Empty>No posts with 100 views and a figure for this yet.</Empty>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {TOPS.map((t) => {
          const ranked = videos
            .map((v) => ({ v, x: t.value(v) }))
            .filter((s): s is { v: InsightVideo; x: number } => s.x !== null)
            .sort((a, b) => b.x - a.x)
            .slice(0, 5);
          return (
            <Card key={t.key} title={`Top: ${t.title.toLowerCase()}`} flush>
              {ranked.length === 0 ? (
                <p className="px-4 py-4 text-xs text-zinc-500">No posts with a figure yet.</p>
              ) : (
                <ol className="divide-y divide-[var(--admin-border)]">
                  {ranked.map((s) => (
                    <li key={s.v.key} className="flex items-center gap-3 px-4 py-2 text-sm">
                      <div className="min-w-0 flex-1">
                        <VideoCell v={s.v} sub={`${count(s.v.views)} views`} />
                      </div>
                      <span className="font-semibold tabular-nums">{t.format(s.x)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card title="Watching" sub="Median post" flush>
          <table className="w-full text-sm">
            <thead className="text-xs text-zinc-500">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Platform</th>
                <th className="px-3 py-2 text-right font-medium">Watched</th>
                <th className="px-4 py-2 text-right font-medium">Average watch</th>
              </tr>
            </thead>
            <tbody>
              {watchRows.map((r) => (
                <tr key={r.platform} className="border-t border-[var(--admin-border)]">
                  <td className="px-4 py-2">
                    <span className="flex items-center gap-2">
                      <PlatformLogo platform={r.platform} size={16} />
                      {PLATFORM_NAMES[r.platform]}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r.watched === null ? "-" : `${Math.round(r.watched)}%`}
                    {r.nWatched > 0 && <span className="block text-[11px] text-zinc-400">{r.nWatched} posts</span>}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {r.avg === null ? "-" : `${r.avg.toFixed(1)}s`}
                    {r.nAvg > 0 && <span className="block text-[11px] text-zinc-400">{r.nAvg} posts</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-[var(--admin-border)] px-4 py-2 text-[11px] text-zinc-400">
            YouTube reports watched and average watch; Instagram average watch only (watched needs the length). TikTok
            and Facebook report neither here.
          </p>
        </Card>

        <Card title="By length" sub="Median post in each length" flush>
          {anyLength ? (
            <table className="w-full text-sm">
              <thead className="text-xs text-zinc-500">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Length</th>
                  <th className="px-3 py-2 text-right font-medium">Posts</th>
                  <th className="px-3 py-2 text-right font-medium">Watched</th>
                  <th className="px-4 py-2 text-right font-medium">Engagement</th>
                </tr>
              </thead>
              <tbody>
                {byLength.map((b) => (
                  <tr key={b.bucket} className="border-t border-[var(--admin-border)]">
                    <td className="px-4 py-2">{b.bucket}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{b.n}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {b.watched === null ? "-" : `${Math.round(b.watched)}%`}
                      <InlineBar value={b.watched} max={100} />
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{percent(b.eng)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="px-4 py-6 text-sm text-zinc-500">
              No lengths yet. The sync reads them from YouTube, TikTok and Facebook (Instagram doesn&apos;t give one),
              and planner posts take theirs from the uploaded file.
            </p>
          )}
        </Card>
      </div>
    </InsightsFrame>
  );
}
