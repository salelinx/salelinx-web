"use client";

// /admin/marketing/insights/compare: why some posts do better. Group our posts
// by one thing and see each group's posts on one measure against every other
// post, with a verdict from the permutation test (lib/social/compare.ts).
// Below: any two groups head to head, and the clearest differences across
// every dimension at once.

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  compareGroups,
  compareTwo,
  DIMENSIONS,
  findings,
  MEASURES,
  type ComparePoint,
  type GroupRow,
  type Measure,
} from "@/lib/social/compare";
import { median } from "@/lib/social/experiments";
import { signedPercent, type InsightVideo } from "@/lib/social/insights";
import type { InsightsLoad } from "@/lib/social/load";
import { PLATFORM_NAMES } from "@/lib/social/types";
import { DotRows, indexTick, niceTicks, type DotRow, type DotScale } from "./charts";
import { InsightsFrame } from "./InsightsFrame";
import { useInsightsPrefs } from "./prefs";
import { Card, Delta, Empty, PLATFORM_COLOR, PlatformKey, platformsFor, selectClass, VerdictBadge, videoHref } from "./ui";

/**
 * Where the dots go for a measure: the index on a doubling scale round 1.0x,
 * wide enough for every post (at least 0.25x to 4x, at most 1/64x to 64x),
 * views on a log scale, rates from zero.
 */
export function scaleFor(
  m: Measure,
  values: number[],
): { scale: DotScale; ticks: number[]; tickFormat?: (x: number) => string; reference?: { value: number; label: string } } {
  if (m.key.startsWith("index")) {
    const pos = values.filter((v) => v > 0);
    const lo = Math.max(-6, Math.min(-2, Math.floor(Math.log2(Math.min(...pos, 1)))));
    const hi = Math.min(6, Math.max(2, Math.ceil(Math.log2(Math.max(...pos, 1)))));
    const step = hi - lo > 6 ? 2 : 1;
    const ticks: number[] = [];
    for (let t = 0; t >= lo; t -= step) ticks.unshift(2 ** t);
    for (let t = step; t <= hi; t += step) ticks.push(2 ** t);
    return { scale: { kind: "log", min: 2 ** lo, max: 2 ** hi }, ticks, tickFormat: indexTick, reference: { value: 1, label: "typical" } };
  }
  const max = Math.max(0, ...values);
  if (m.log) {
    const lo = 10 ** Math.floor(Math.log10(Math.max(1, Math.min(...values.filter((v) => v > 0), max || 1))));
    const hi = 10 ** Math.max(Math.ceil(Math.log10(Math.max(max, 10))), Math.log10(lo) + 1);
    const ticks: number[] = [];
    for (let t = lo; t <= hi; t *= 10) ticks.push(t);
    return { scale: { kind: "log", min: lo, max: hi }, ticks };
  }
  if (m.key === "watched") return { scale: { kind: "linear", min: 0, max: 100 }, ticks: [0, 25, 50, 75, 100] };
  const ticks = niceTicks(0, max || 1, 4);
  return { scale: { kind: "linear", min: 0, max: ticks[ticks.length - 1] }, ticks };
}

const toDots = (points: ComparePoint[]) =>
  points.map((p) => ({
    key: p.key,
    value: p.value,
    color: PLATFORM_COLOR[p.video.platform],
    label: p.video.title,
    sub: PLATFORM_NAMES[p.video.platform],
    href: videoHref(p.video),
  }));

const SINCE = [
  { days: 0, label: "Posts from any time" },
  { days: 90, label: "Posted in the last 90 days" },
  { days: 30, label: "Posted in the last 30 days" },
];

function Often({ often }: { often: GroupRow["often"] }) {
  if (!often) return null;
  return (
    <p className="text-[11px] text-amber-700" title={`${Math.round(often.restShare * 100)}% of the other posts`}>
      {Math.round(often.share * 100)}% are {often.label}, so that may be the reason
    </p>
  );
}

export function InsightsCompare({ load }: { load: InsightsLoad }) {
  const [prefs] = useInsightsPrefs();
  const { data } = load;
  const [dimKey, setDimKey] = useState("platform");
  const [measureKey, setMeasureKey] = useState("index168");
  const [since, setSince] = useState(0);
  const [pick, setPick] = useState<{ a: string; b: string } | null>(null);

  const dim = DIMENSIONS.find((d) => d.key === dimKey) ?? DIMENSIONS[0];
  const measure = MEASURES.find((m) => m.key === measureKey) ?? MEASURES[0];
  const blocked = !measure.pooled && prefs.platform === "all";

  const videos = useMemo(() => {
    const platforms = platformsFor(prefs.platform);
    const from = since ? data.nowMs - since * 86_400_000 : null;
    return data.videos.filter(
      (v: InsightVideo) => platforms.includes(v.platform) && (!from || (v.publishedAt !== null && Date.parse(v.publishedAt) >= from)),
    );
  }, [data.videos, data.nowMs, prefs.platform, since]);

  const result = useMemo(() => (blocked ? null : compareGroups(videos, dim, measure)), [videos, dim, measure, blocked]);
  const found = useMemo(() => (blocked ? [] : findings(videos, measure)), [videos, measure, blocked]);

  const values = result?.rows.flatMap((r) => r.points.map((p) => p.value)) ?? [];
  const { scale, ticks, tickFormat, reference } = scaleFor(measure, values);

  const groupNames = result?.rows.map((r) => r.value) ?? [];
  const byCount = [...(result?.rows ?? [])].sort((x, y) => y.points.length - x.points.length);
  const a = pick && groupNames.includes(pick.a) ? pick.a : byCount[0]?.value;
  const b = pick && groupNames.includes(pick.b) && pick.b !== a ? pick.b : byCount.find((r) => r.value !== a)?.value;
  const duel = a && b && !blocked ? compareTwo(videos, dim, a, b, measure) : null;

  const rows: DotRow[] = (result?.rows ?? []).map((r) => ({
    key: r.value,
    label: (
      <>
        <span className="block truncate text-zinc-900" title={r.value}>
          {r.value}
        </span>
        <span className="text-[11px] text-zinc-400">
          {r.points.length} post{r.points.length === 1 ? "" : "s"}
        </span>
      </>
    ),
    dots: toDots(r.points),
    median: r.median,
    right: (
      <div className="space-y-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold tabular-nums text-zinc-900">{r.median === null ? "-" : measure.format(r.median)}</span>
          <Delta value={r.lift} text={signedPercent(r.lift)} note="vs the rest" />
          <VerdictBadge verdict={r.verdict} p={r.p} />
        </div>
        <Often often={r.often} />
      </div>
    ),
  }));

  return (
    <InsightsFrame title="Compare" load={load} period={false}>
      <Card
        title="Compare groups"
        sub={measure.hint}
        actions={
          <>
            <label className="flex items-center gap-1.5 text-xs text-zinc-500">
              Group by
              <select value={dim.key} onChange={(e) => setDimKey(e.target.value)} className={selectClass}>
                {DIMENSIONS.map((d) => (
                  <option key={d.key} value={d.key}>
                    {d.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1.5 text-xs text-zinc-500">
              Measure
              <select value={measure.key} onChange={(e) => setMeasureKey(e.target.value)} className={selectClass}>
                {MEASURES.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            <select value={since} onChange={(e) => setSince(Number(e.target.value))} className={selectClass} aria-label="Posted">
              {SINCE.map((s) => (
                <option key={s.days} value={s.days}>
                  {s.label}
                </option>
              ))}
            </select>
          </>
        }
      >
        {blocked ? (
          <div className="space-y-2 py-4 text-center text-sm text-zinc-600">
            <p>Each platform counts a view its own way, so raw views can&apos;t be pooled.</p>
            <p>
              Pick one platform at the top, or{" "}
              <button type="button" onClick={() => setMeasureKey("index168")} className="text-zinc-900 underline">
                compare against typical
              </button>
              , which can.
            </p>
          </div>
        ) : !rows.length ? (
          <Empty>
            No posts have both a {dim.label.toLowerCase()} and a figure for {measure.label.toLowerCase()} yet.
            {["opening", "style", "topic", "sound", "face", "hookText", "collab"].includes(dim.key) &&
              " Tag videos on Stats to compare by what is in them."}
            {dim.key === "length" &&
              " Lengths come from the sync (YouTube, TikTok and Facebook give it, Instagram doesn't) and from planner uploads."}
          </Empty>
        ) : (
          <div className="space-y-3">
            <DotRows
              rows={rows}
              scale={scale}
              ticks={ticks}
              tickFormat={tickFormat}
              reference={reference}
              format={measure.format}
              rightClass="sm:w-72"
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <PlatformKey platforms={platformsFor(prefs.platform)} />
              <p className="text-[11px] text-zinc-400">
                Dark bar: the group&apos;s median. Each group is tested against every other post
                {result && result.missing > 0 ? `; ${result.missing} posts have no ${dim.label.toLowerCase()} and are left out` : ""}.
              </p>
            </div>
          </div>
        )}
      </Card>

      {!blocked && groupNames.length >= 2 && a && b && duel && (
        <Card
          title="Head to head"
          sub={`${dim.label}, ${measure.label.toLowerCase()}`}
          actions={
            <>
              <select value={a} onChange={(e) => setPick({ a: e.target.value, b })} className={selectClass} aria-label="Group A">
                {groupNames.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
              <span className="text-xs text-zinc-400">against</span>
              <select value={b} onChange={(e) => setPick({ a, b: e.target.value })} className={selectClass} aria-label="Group B">
                {groupNames
                  .filter((g) => g !== a)
                  .map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
              </select>
            </>
          }
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_1fr_1.2fr]">
            {[
              { name: a, points: duel.a },
              { name: b, points: duel.b },
            ].map((side) => {
              const vals = side.points.map((p) => p.value).sort((x, y) => x - y);
              const mid = median(vals);
              return (
                <div key={side.name} className="rounded-md border border-[var(--admin-border)] px-3 py-2.5">
                  <p className="truncate text-xs text-zinc-500">{side.name}</p>
                  <p className="text-3xl font-semibold tracking-tight">{mid === null ? "-" : measure.format(mid)}</p>
                  <p className="text-xs text-zinc-400">
                    median of {vals.length} post{vals.length === 1 ? "" : "s"}
                    {vals.length > 1 && `, ${measure.format(vals[0])} to ${measure.format(vals[vals.length - 1])}`}
                  </p>
                </div>
              );
            })}
            <div className="space-y-1.5 rounded-md border border-[var(--admin-border)] px-3 py-2.5 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-2xl font-semibold tabular-nums">{signedPercent(duel.lift)}</span>
                <VerdictBadge verdict={duel.verdict} p={duel.p} />
              </div>
              <p className="text-xs text-zinc-600">
                {duel.verdict === "few"
                  ? `Needs at least 3 posts on each side before the gap means anything.`
                  : `${a} against ${b}. A gap this size turns up by chance ${Math.max(1, Math.round((duel.p ?? 1) * 100))}% of the time with these posts.`}
                {duel.both > 0 && ` ${duel.both} post${duel.both === 1 ? " is" : "s are"} in both and left out.`}
              </p>
              <Link href="/admin/marketing/experiments" className="text-xs text-zinc-900 underline">
                Test it properly with an experiment
              </Link>
            </div>
          </div>
          <div className="mt-4">
            <DotRows
              rows={[
                { key: "a", label: a, dots: toDots(duel.a), median: median(duel.a.map((p) => p.value)) },
                { key: "b", label: b, dots: toDots(duel.b), median: median(duel.b.map((p) => p.value)) },
              ]}
              scale={scale}
              ticks={ticks}
              tickFormat={tickFormat}
              reference={reference}
              format={measure.format}
              rightClass="sm:w-0"
            />
          </div>
        </Card>
      )}

      {!blocked && (
        <Card title="Biggest differences" sub={`Every group on every dimension, on ${measure.label.toLowerCase()}`} flush>
          {found.length === 0 ? (
            <Empty>Nothing stands out yet. Differences show here once groups have at least 3 posts each.</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="text-xs text-zinc-500">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Group</th>
                    <th className="px-3 py-2 text-right font-medium">Posts</th>
                    <th className="px-3 py-2 text-right font-medium">Median</th>
                    <th className="px-3 py-2 text-right font-medium">vs the rest</th>
                    <th className="px-3 py-2 text-left font-medium">Verdict</th>
                    <th className="px-4 py-2 text-left font-medium">Watch out</th>
                  </tr>
                </thead>
                <tbody>
                  {found.slice(0, 15).map(({ dimension, row }) => (
                    <tr key={`${dimension.key}:${row.value}`} className="border-t border-[var(--admin-border)]">
                      <td className="px-4 py-2">
                        <button type="button" onClick={() => setDimKey(dimension.key)} className="text-left hover:underline">
                          <span className="text-xs text-zinc-500">{dimension.label}: </span>
                          {row.value}
                        </button>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{row.points.length}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{row.median === null ? "-" : measure.format(row.median)}</td>
                      <td className="px-3 py-2 text-right">
                        <Delta value={row.lift} text={signedPercent(row.lift)} />
                      </td>
                      <td className="px-3 py-2">
                        <VerdictBadge verdict={row.verdict} p={row.p} />
                      </td>
                      <td className="px-4 py-2">
                        <Often often={row.often} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="border-t border-[var(--admin-border)] px-4 py-2 text-[11px] text-zinc-400">
            Many groups are tested at once, and each has about a one in five chance of showing as &ldquo;leaning&rdquo;
            by luck alone. Treat this as a list of things to test in an experiment, not answers.
          </p>
        </Card>
      )}
    </InsightsFrame>
  );
}
