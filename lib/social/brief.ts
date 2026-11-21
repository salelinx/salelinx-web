import { compareTwo, DIMENSIONS, findings, MEASURES } from "./compare";
import { median } from "./experiments";
import type { InsightVideo } from "./insights";
import type { SocialPlatform } from "./types";

const DAY_MS = 86_400_000;
const WINDOW_DAYS = 90;
// Posts per side before a test with no difference counts as finished.
const TARGET = 8;
const MIN_SLOT_POSTS = 3;
const index24 = MEASURES.find((m) => m.key === "index24")!;
const TESTED = DIMENSIONS.filter((d) => !["platform", "source", "gap"].includes(d.key));

type Side = { value: string; posts: number; median: number | null };

export type AutoTest = {
  key: string;
  dimension: string;
  a: Side;
  b: Side;
  status: "winner" | "leaning" | "even" | "testing";
  leader: string | null;
  // 0.5 = +50%.
  lift: number | null;
  needs: string[];
};

export function autoTests(videos: InsightVideo[]): AutoTest[] {
  const scored = videos.filter((v) => index24.value(v) !== null);
  const tests = TESTED.flatMap((dim): AutoTest[] => {
    const counts = new Map<string, number>();
    for (const v of scored) for (const x of new Set(dim.values(v))) counts.set(x, (counts.get(x) ?? 0) + 1);
    const [a, b] = [...counts].sort((x, y) => y[1] - x[1]).map(([x]) => x);
    if (!b) return [];
    const r = compareTwo(scored, dim, a, b, index24);
    const side = (value: string, pts: { value: number }[]): Side => ({
      value,
      posts: pts.length,
      median: median(pts.map((p) => p.value)),
    });
    const sa = side(a, r.a);
    const sb = side(b, r.b);
    const ahead = sa.median !== null && sb.median !== null && sa.median !== sb.median ? (sa.median > sb.median ? sa : sb) : null;
    const behind = ahead === sa ? sb : sa;
    const full = sa.posts >= TARGET && sb.posts >= TARGET;
    const status = r.verdict === "real" ? "winner" : r.verdict === "leaning" ? "leaning" : full ? "even" : "testing";
    return [
      {
        key: dim.key,
        dimension: dim.label,
        a: sa,
        b: sb,
        status,
        leader: ahead?.value ?? null,
        lift: ahead && behind.median ? ahead.median! / behind.median - 1 : null,
        needs:
          status === "winner" || status === "even"
            ? []
            : [sa, sb].filter((s) => s.posts < TARGET).map((s) => `${TARGET - s.posts} more "${s.value}"`),
      },
    ];
  });
  const order = { winner: 0, leaning: 1, testing: 2, even: 3 };
  return tests.sort((x, y) => order[x.status] - order[y.status] || (y.lift ?? 0) - (x.lift ?? 0));
}

type BriefPost = { title: string; platform: SocialPlatform; url: string | null; index: number };

export type Brief = {
  generatedAt: string;
  week: { uploads: number; typical: number | null; best: BriefPost | null; worst: BriefPost | null };
  // Trend Remix's prompt reads experiments[].needs and working.
  experiments: AutoTest[];
  working: { dimension: string; value: string; lift: number; often: string | null }[];
  // UK hours.
  bestHours: { hour: number; index: number; posts: number }[];
};

export function weeklyBrief(videos: InsightVideo[], nowMs: number): Brief {
  const since = (days: number) =>
    videos.filter((v) => v.publishedAt && Date.parse(v.publishedAt) >= nowMs - days * DAY_MS);

  const week = since(7);
  const scored = week
    .filter((v) => v.index[24] !== null)
    .map((v) => ({ title: v.title, platform: v.platform, url: v.url, index: v.index[24]! }))
    .sort((a, b) => b.index - a.index);

  const recent = since(WINDOW_DAYS);
  const hours = new Map<number, number[]>();
  for (const v of recent) {
    if (!v.slot || v.index[24] === null) continue;
    hours.set(v.slot.hour, [...(hours.get(v.slot.hour) ?? []), v.index[24]]);
  }
  const bestHours = [...hours]
    .filter(([, xs]) => xs.length >= MIN_SLOT_POSTS)
    .map(([hour, xs]) => ({ hour, index: median(xs)!, posts: xs.length }))
    .sort((a, b) => b.index - a.index)
    .slice(0, 3);

  return {
    generatedAt: new Date(nowMs).toISOString(),
    week: {
      uploads: week.length,
      typical: median(scored.map((s) => s.index)),
      best: scored[0] ?? null,
      worst: scored.length > 1 ? scored[scored.length - 1] : null,
    },
    experiments: autoTests(recent),
    working: findings(recent, index24)
      .filter((f) => f.row.verdict === "real")
      .slice(0, 3)
      .map((f) => ({
        dimension: f.dimension.label,
        value: f.row.value,
        lift: f.row.lift ?? 0,
        often: f.row.often?.label ?? null,
      })),
    bestHours,
  };
}
