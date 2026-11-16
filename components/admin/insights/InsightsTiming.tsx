"use client";

// /admin/marketing/insights/timing: when to post. Everything is on the index
// (a post against our typical one on the same platform at the same age), so
// platforms can pool and a busy week doesn't flatter its slots. Times are UK
// time, since that is when we post. Then when we actually post, and how often.

import { useMemo, useState } from "react";
import { median } from "@/lib/social/experiments";
import { compact, count, GAP_BUCKETS, gapBucket, shortDay, weekOf, type InsightVideo } from "@/lib/social/insights";
import type { InsightsLoad } from "@/lib/social/load";
import { AGE_LABELS, formatIndex, type IndexAge } from "@/lib/social/overview";
import { DAYS, PARTS } from "@/lib/social/tags";
import { PLATFORM_NAMES } from "@/lib/social/types";
import { daysBefore } from "@/lib/admin/marketing";
import { Heatmap, IndexColumns, StackedColumns } from "./charts";
import { InsightsFrame } from "./InsightsFrame";
import { useInsightsPrefs } from "./prefs";
import { Card, chipClass, PLATFORM_COLOR, PlatformKey, platformsFor, selectClass } from "./ui";

const MIN_POSTS = 3;
const HOURS = Array.from({ length: 24 }, (_, h) => h);
const hourLabel = (h: number) => String(h).padStart(2, "0");

const cell = (vals: (number | null)[]) => {
  const xs = vals.filter((x): x is number => x !== null);
  return { value: median(xs), n: xs.length };
};

export function InsightsTiming({ load }: { load: InsightsLoad }) {
  const [prefs] = useInsightsPrefs();
  const { data } = load;
  const [age, setAge] = useState<IndexAge>(168);
  const [since, setSince] = useState(0);
  const platforms = platformsFor(prefs.platform);

  const videos = useMemo(() => {
    const from = since ? data.nowMs - since * 86_400_000 : null;
    const mine = platformsFor(prefs.platform);
    return data.videos.filter(
      (v: InsightVideo) => mine.includes(v.platform) && v.slot && (!from || (v.publishedAt !== null && Date.parse(v.publishedAt) >= from)),
    );
  }, [data.videos, data.nowMs, prefs.platform, since]);

  const idx = (v: InsightVideo) => v.index[age];

  const grid = new Map<string, { value: number | null; n: number }>();
  for (const d of DAYS)
    for (const p of PARTS) grid.set(`${d}|${p}`, cell(videos.filter((v) => v.slot!.day === d && v.slot!.part === p).map(idx)));

  const best = [...grid.entries()]
    .filter(([, c]) => c.value !== null && c.n >= MIN_POSTS)
    .sort((a, b) => b[1].value! - a[1].value!);

  const byDay = DAYS.map((d) => ({ label: d, ...summary(videos.filter((v) => v.slot!.day === d).map(idx)) }));
  const byHour = HOURS.map((h) => ({ label: hourLabel(h), ...summary(videos.filter((v) => v.slot!.hour === h).map(idx)) }));
  const byGap = GAP_BUCKETS.map((g) => ({ label: g, ...summary(videos.filter((v) => gapBucket(v.gapHours) === g).map(idx)) }));

  // When we post, whether or not the post is old enough to score.
  const postsBy = (key: (v: InsightVideo) => string, labels: string[]) =>
    platforms.map((p) => ({
      key: p,
      label: PLATFORM_NAMES[p],
      color: PLATFORM_COLOR[p],
      values: labels.map((l) => videos.filter((v) => v.platform === p && key(v) === l).length),
    }));
  const hourLabels = HOURS.map(hourLabel);
  const perHour = postsBy((v) => hourLabel(v.slot!.hour), hourLabels);
  const perDay = postsBy((v) => v.slot!.day, [...DAYS]);

  const weeks = useMemo(() => {
    const first = videos
      .map((v) => v.publishedAt?.slice(0, 10))
      .filter((d): d is string => !!d)
      .sort()[0];
    if (!first) return [];
    const out: string[] = [];
    for (let w = weekOf(first); w <= data.today; w = daysBefore(w, -7)) out.push(w);
    return out;
  }, [videos, data.today]);
  const perWeek = postsBy((v) => (v.publishedAt ? weekOf(v.publishedAt.slice(0, 10)) : ""), weeks);

  const scored = videos.filter((v) => idx(v) !== null).length;

  return (
    <InsightsFrame
      title="Timing"
      load={load}
      period={false}
      controls={
        <>
          <div className="flex items-center gap-1" role="group" aria-label="Compare at">
            {([24, 168] as IndexAge[]).map((a) => (
              <button key={a} type="button" aria-pressed={age === a} onClick={() => setAge(a)} className={chipClass(age === a)}>
                At {AGE_LABELS[a]}
              </button>
            ))}
          </div>
          <select value={since} onChange={(e) => setSince(Number(e.target.value))} className={selectClass} aria-label="Posted">
            <option value={0}>Any time</option>
            <option value={90}>Last 90 days</option>
            <option value={30}>Last 30 days</option>
          </select>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <Card
          title="Day and time of day"
          sub={`Median post against typical at ${AGE_LABELS[age]}, UK time, ${scored} of ${videos.length} posts scored`}
          className="xl:col-span-2"
          table={{
            head: ["Day", ...PARTS],
            rows: DAYS.map((d) => [
              d,
              ...PARTS.map((p) => {
                const c = grid.get(`${d}|${p}`)!;
                return c.value === null ? "-" : `${formatIndex(c.value)} (${c.n})`;
              }),
            ]),
          }}
        >
          <Heatmap rows={[...DAYS]} cols={[...PARTS]} cell={(r, c) => grid.get(`${r}|${c}`)!} minN={MIN_POSTS} />
          <p className="mt-2 text-[11px] text-zinc-400">
            Morning 6 to 11, midday 11 to 3, afternoon 3 to 6, evening 6 to 10, late after 10.
          </p>
        </Card>
        <Card title="Best slots" sub={`At least ${MIN_POSTS} posts`} flush>
          {best.length === 0 ? (
            <p className="px-4 py-6 text-sm text-zinc-500">No slot has {MIN_POSTS} scored posts yet.</p>
          ) : (
            <ol className="divide-y divide-[var(--admin-border)]">
              {best.slice(0, 8).map(([k, c], i) => {
                const [d, p] = k.split("|");
                return (
                  <li key={k} className="flex items-center gap-3 px-4 py-2 text-sm">
                    <span className="w-4 text-xs text-zinc-400">{i + 1}</span>
                    <span className="flex-1">
                      {d} {p.toLowerCase()}
                    </span>
                    <span className="text-xs text-zinc-400">{c.n} posts</span>
                    <span className="w-12 text-right font-semibold tabular-nums">{formatIndex(c.value)}</span>
                  </li>
                );
              })}
              {best.length > 8 && (
                <li className="px-4 py-2 text-xs text-zinc-400">
                  Weakest: {best[best.length - 1][0].replace("|", " ").toLowerCase()}, {formatIndex(best[best.length - 1][1].value)}
                </li>
              )}
            </ol>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card
          title="By day"
          sub={`Against typical at ${AGE_LABELS[age]}`}
          table={{ head: ["Day", "Median", "Posts"], rows: byDay.map((d) => [d.label, formatIndex(d.median), d.n]) }}
        >
          <IndexColumns items={byDay} name="Median post against typical by day posted" minN={MIN_POSTS} />
        </Card>
        <Card
          title="Since the previous post"
          sub="Same platform; does posting close together cost views?"
          table={{ head: ["Gap", "Median", "Posts"], rows: byGap.map((d) => [d.label, formatIndex(d.median), d.n]) }}
        >
          <IndexColumns
            items={byGap.map((g) => ({ ...g, label: g.label.replace(" hours", "h").replace(" days", "d").replace(" or more", "+") }))}
            name="Median post against typical by time since the previous post"
            minN={MIN_POSTS}
          />
        </Card>
      </div>

      <Card
        title="By hour posted"
        sub={`UK time, against typical at ${AGE_LABELS[age]}`}
        table={{ head: ["Hour", "Median", "Posts"], rows: byHour.map((d) => [`${d.label}:00`, formatIndex(d.median), d.n]) }}
      >
        <IndexColumns items={byHour} name="Median post against typical by hour posted" minN={MIN_POSTS} />
      </Card>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card
          title="When we post"
          sub="Posts by hour, UK time"
          table={{ head: ["Hour", ...perHour.map((s) => s.label)], rows: hourLabels.map((h, i) => [`${h}:00`, ...perHour.map((s) => s.values[i])]) }}
        >
          <StackedColumns
            name="Posts by hour posted"
            labels={hourLabels}
            series={perHour}
            format={count}
            integer
            height={180}
            tooltipLabel={(l) => `${l}:00 to ${l}:59`}
            legend={perHour.length > 1 ? <PlatformKey platforms={platforms} /> : undefined}
          />
        </Card>
        <Card
          title="Posts by day"
          sub="Every post, scored or not"
          table={{ head: ["Day", ...perDay.map((s) => s.label)], rows: DAYS.map((d, i) => [d, ...perDay.map((s) => s.values[i])]) }}
        >
          <StackedColumns
            name="Posts by day posted"
            labels={[...DAYS]}
            series={perDay}
            format={count}
            integer
            height={180}
            legend={perDay.length > 1 ? <PlatformKey platforms={platforms} /> : undefined}
          />
        </Card>
      </div>

      <Card
        title="Posts per week"
        sub="Weeks start on Monday"
        table={{ head: ["Week of", ...perWeek.map((s) => s.label)], rows: weeks.map((w, i) => [shortDay(w), ...perWeek.map((s) => s.values[i])]) }}
      >
        {weeks.length ? (
          <StackedColumns
            name="Posts per week"
            labels={weeks}
            series={perWeek}
            format={compact}
            integer
            height={180}
            tickLabel={shortDay}
            tooltipLabel={(w) => `Week of ${shortDay(w)}`}
            legend={perWeek.length > 1 ? <PlatformKey platforms={platforms} /> : undefined}
          />
        ) : (
          <p className="py-6 text-center text-sm text-zinc-500">No posts yet.</p>
        )}
      </Card>
    </InsightsFrame>
  );
}

/** The median and post count, as IndexColumns takes them. */
function summary(vals: (number | null)[]) {
  const c = cell(vals);
  return { median: c.value, n: c.n };
}
