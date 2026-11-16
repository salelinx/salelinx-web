import { describe, expect, it } from "vitest";
import type { MarketingStatRow } from "../lib/admin/marketing";
import {
  compareGroups,
  compareTwo,
  DIMENSIONS,
  findings,
  hashtagBucket,
  MEASURES,
  oftenWith,
  verdictOf,
} from "../lib/social/compare";
import { permutationP } from "../lib/social/experiments";
import {
  ageBucket,
  assembleInsights,
  compact,
  count,
  coverage,
  dailyGains,
  dayRange,
  earlySignal,
  engagementRate,
  followersGained,
  gapBucket,
  halfLifeHours,
  HISTORY_DAYS,
  percent,
  periodWindow,
  signedPercent,
  spearman,
  watched,
  weekOf,
  weekShare,
  windowTotals,
  zeroGains,
  type InsightVideo,
} from "../lib/social/insights";

const stat = (day: string, views: number | null, extra: Partial<MarketingStatRow> = {}): MarketingStatRow => ({
  platform: "tiktok",
  external_id: "a",
  day,
  views,
  likes: null,
  comments: null,
  shares: null,
  ...extra,
});

const dim = (key: string) => DIMENSIONS.find((d) => d.key === key)!;
const measure = (key: string) => MEASURES.find((m) => m.key === key)!;

function video(o: Partial<InsightVideo> & { key: string }): InsightVideo {
  return {
    platform: "tiktok",
    external_id: o.key,
    title: o.key,
    url: null,
    thumbnail: null,
    publishedAt: "2026-11-01T12:00:00Z",
    postId: null,
    tags: {},
    seconds: null,
    caption: null,
    slot: null,
    ageDays: 10,
    views: null,
    likes: null,
    comments: null,
    shares: null,
    saves: null,
    reach: null,
    watchSeconds: null,
    avgWatchSeconds: null,
    avgViewPct: null,
    subscribers: null,
    at: { 1: null, 6: null, 24: null, 72: null, 168: null },
    index: { 24: null, 168: null },
    gained: { 7: zeroGains(), 30: zeroGains(), 90: zeroGains() },
    gapHours: null,
    ...o,
  };
}

describe("daily gains", () => {
  it("takes each day less the day before, never below zero", () => {
    const g = dailyGains([stat("2026-11-03", 150), stat("2026-11-01", 100), stat("2026-11-02", 90)], "2026-10-01T00:00:00Z");
    expect(g.map((x) => x.day)).toEqual(["2026-11-01", "2026-11-02", "2026-11-03"]);
    expect(g.map((x) => x.gains.views)).toEqual([0, 0, 60]);
  });

  it("counts a new video's first snapshot in full, but not an old one's", () => {
    expect(dailyGains([stat("2026-11-02", 40)], "2026-11-01T20:00:00Z")[0].gains.views).toBe(40);
    expect(dailyGains([stat("2026-11-05", 40)], "2026-11-01T20:00:00Z")[0].gains.views).toBe(0);
    // Posted after tracking began, first seen two days later: still all ours.
    expect(dailyGains([stat("2026-11-05", 40)], "2026-11-01T20:00:00Z", "2026-10-25")[0].gains.views).toBe(40);
    expect(dailyGains([stat("2026-11-05", 40)], "2026-10-20T20:00:00Z", "2026-10-25")[0].gains.views).toBe(0);
  });

  it("only gains a metric once both days report it", () => {
    const g = dailyGains(
      [stat("2026-11-01", 100, { saves: null }), stat("2026-11-02", 120, { saves: 9 }), stat("2026-11-03", 130, { saves: 12 })],
      "2026-10-01T00:00:00Z",
    );
    expect(g.map((x) => x.gains.saves)).toEqual([0, 0, 3]);
  });
});

describe("windows", () => {
  it("counts back from today, then the run before", () => {
    expect(periodWindow("2026-11-16", 7)).toEqual({ from: "2026-11-10", to: "2026-11-16" });
    expect(periodWindow("2026-11-16", 7, 1)).toEqual({ from: "2026-11-03", to: "2026-11-09" });
    expect(dayRange("2026-11-16", 3)).toEqual(["2026-11-14", "2026-11-15", "2026-11-16"]);
  });

  it("buckets weeks from Monday", () => {
    expect(weekOf("2026-11-16")).toBe("2026-11-16"); // a Monday
    expect(weekOf("2026-11-22")).toBe("2026-11-16");
    expect(weekOf("2026-11-15T10:00:00Z")).toBe("2026-11-09");
  });
});

describe("assembling the section", () => {
  const today = "2026-11-16";
  const nowMs = Date.parse("2026-11-16T12:00:00Z");
  const data = assembleInsights({
    today,
    nowMs,
    videos: [
      { platform: "tiktok", external_id: "old", title: "Old", url: null, thumbnail_url: null, published_at: "2026-10-01T10:00:00Z" },
      { platform: "tiktok", external_id: "new", title: "New", url: null, thumbnail_url: null, published_at: "2026-11-14T18:00:00Z" },
      { platform: "youtube", external_id: "yt", title: "Yt", url: null, thumbnail_url: null, published_at: "2026-11-13T09:00:00Z" },
    ],
    stats: [
      stat("2026-11-10", 1000, { external_id: "old", likes: 10 }),
      stat("2026-11-15", 1100, { external_id: "old", likes: 12 }),
      stat("2026-11-16", 1150, { external_id: "old", likes: 15 }),
      stat("2026-11-15", 300, { external_id: "new", likes: 30 }),
      stat("2026-11-16", 500, { external_id: "new", likes: 40 }),
      { ...stat("2026-11-14", 50), platform: "youtube", external_id: "yt" },
    ],
    agePoints: [],
    posts: [{ id: "p1", name: "Planner name", tags: { opening: "Question" }, targets: [{ platform: "tiktok", external_id: "new", caption: "Try it? #a" }] }],
    followers: [
      { platform: "tiktok", day: "2026-11-08", followers: 100 },
      { platform: "tiktok", day: "2026-11-16", followers: 130 },
    ],
  });

  it("lines every daily array up with the loaded days", () => {
    expect(data.days).toHaveLength(HISTORY_DAYS);
    expect(data.days[data.days.length - 1]).toBe(today);
    expect(data.daily.tiktok.gains).toHaveLength(HISTORY_DAYS);
    expect(data.measuredFrom).toBe("2026-11-11");
  });

  it("sums gains per platform per day and per video per period", () => {
    const t = windowTotals(data, ["tiktok"], periodWindow(today, 7));
    // old: 100 on the 15th (against the 10th), 50 on the 16th; new: 300 then 200.
    expect(t.views).toBe(650);
    expect(t.likes).toBe(2 + 3 + 30 + 10);
    expect(t.uploads).toBe(1);
    const byKey = new Map(data.videos.map((v) => [v.key, v]));
    expect(byKey.get("tiktok:new")!.gained[7].views).toBe(500);
    expect(byKey.get("tiktok:old")!.gained[7].views).toBe(150);
    expect(byKey.get("youtube:yt")!.gained[7].views).toBe(50);
  });

  it("carries each video's latest views into the lifetime total", () => {
    const i = data.days.indexOf("2026-11-14");
    expect(data.daily.tiktok.lifetimeViews[i]).toBe(1000);
    expect(data.daily.tiktok.lifetimeViews[data.days.length - 1]).toBe(1650);
    expect(data.daily.tiktok.lifetimeViews[0]).toBeNull();
  });

  it("takes the planner post's name, tags and caption, and the gap since the last post", () => {
    const v = data.videos.find((x) => x.key === "tiktok:new")!;
    expect(v.title).toBe("Planner name");
    expect(v.tags).toEqual({ opening: "Question" });
    expect(v.caption?.question).toBe(true);
    expect(v.gapHours).toBeCloseTo((Date.parse("2026-11-14T18:00:00Z") - Date.parse("2026-10-01T10:00:00Z")) / 3600_000);
    expect(data.videos.find((x) => x.key === "tiktok:old")!.gapHours).toBeNull();
  });

  it("works out followers gained and how much of a window the snapshots cover", () => {
    expect(followersGained(data, "tiktok", periodWindow(today, 7))).toBe(30);
    expect(followersGained(data, "youtube", periodWindow(today, 7))).toBeNull();
    // Counting began inside a 30-day window: from the first count.
    expect(followersGained(data, "tiktok", periodWindow(today, 30))).toBe(30);
    expect(followersGained(data, "tiktok", periodWindow(today, 30, 1))).toBeNull();
    expect(coverage(data, periodWindow(today, 7))).toBe("partial");
    expect(coverage(data, periodWindow(today, 7, 1))).toBe("none");
    expect(coverage(data, { from: "2026-11-12", to: "2026-11-16" })).toBe("full");
  });
});

describe("rates and lifecycle", () => {
  it("needs 100 views before giving an engagement rate or a watched share", () => {
    expect(engagementRate(video({ key: "a", views: 99, likes: 50 }))).toBeNull();
    expect(watched(video({ key: "a", views: 4, avgViewPct: 100 }))).toBeNull();
    expect(watched(video({ key: "a", views: 400, avgViewPct: 55 }))).toBe(55);
    expect(engagementRate(video({ key: "a", views: 200, likes: 10, comments: 5, shares: 5, saves: null }))).toBeCloseTo(0.1);
  });

  it("reads how much of a week had come in, and when half had", () => {
    const at = { 1: 10, 6: 40, 24: 80, 72: 90, 168: 100 };
    expect(weekShare({ at }, 24)).toBeCloseTo(0.8);
    // Half (50) lands between 6h (40) and 24h (80): a quarter of the way.
    expect(halfLifeHours({ at })).toBeCloseTo(6 + 18 / 4);
    expect(halfLifeHours({ at: { ...at, 168: null } })).toBeNull();
    expect(halfLifeHours({ at: { 1: 60, 6: null, 24: null, 72: null, 168: 100 } })).toBeCloseTo(50 / 60);
    // Known only at 7 days: no half-life, rather than a straight line's 84 hours.
    expect(halfLifeHours({ at: { 1: null, 6: null, 24: null, 72: null, 168: 100 } })).toBeNull();
    expect(halfLifeHours({ at: { 1: 10, 6: null, 24: 80, 72: 90, 168: 100 } })).toBeNull();
  });

  it("ranks with Spearman, handling ties", () => {
    expect(spearman([1, 2, 3, 4], [10, 20, 30, 40])).toBeCloseTo(1);
    expect(spearman([1, 2, 3, 4], [4, 3, 2, 1])).toBeCloseTo(-1);
    expect(spearman([1, 1, 2], [5, 5, 9])).toBeCloseTo(1);
    expect(spearman([1, 2], [1, 2])).toBeNull();
    expect(spearman([1, 1, 1], [1, 2, 3])).toBeNull();
    const vids = [1, 2, 3, 4, 5].map((n) => video({ key: `v${n}`, at: { 1: n, 6: null, 24: n * 3, 72: null, 168: n * 10 } }));
    expect(earlySignal(vids, 24)).toEqual({ rho: expect.closeTo(1), n: 5 });
    expect(earlySignal(vids, 6)).toEqual({ rho: null, n: 0 });
  });

  it("sorts views by when the post went up", () => {
    const w = { from: "2026-11-10", to: "2026-11-16" };
    expect(ageBucket("2026-11-12T00:00:00Z", w)).toBe("Posted this period");
    expect(ageBucket("2026-10-20T00:00:00Z", w)).toBe("Up to 4 weeks before");
    expect(ageBucket("2026-09-01T00:00:00Z", w)).toBe("1 to 3 months before");
    expect(ageBucket("2026-01-01T00:00:00Z", w)).toBe("Older");
    expect(gapBucket(3)).toBe("Under 12 hours");
    expect(gapBucket(30)).toBe("1 to 2 days");
    expect(gapBucket(200)).toBe("4 days or more");
    expect(gapBucket(null)).toBeNull();
  });

  it("formats figures", () => {
    expect(count(12480)).toBe("12,480");
    expect(count(2_400_000)).toBe("2.4M");
    expect(compact(940)).toBe("940");
    expect(compact(1250)).toBe("1.3K");
    expect(compact(48_200)).toBe("48K");
    expect(percent(0.1234)).toBe("12.3%");
    expect(percent(0.1234, true)).toBe("12%");
    expect(signedPercent(0.124)).toBe("+12%");
    expect(signedPercent(-0.004)).toBe("same");
  });
});

describe("compare", () => {
  const idx = (key: string, platform: InsightVideo["platform"], x: number, extra: Partial<InsightVideo> = {}) =>
    video({ key, platform, index: { 24: null, 168: x }, ...extra });

  it("puts groups in their natural order, each against the rest", () => {
    const vids = [
      idx("t1", "tiktok", 2),
      idx("t2", "tiktok", 3),
      idx("t3", "tiktok", 4),
      idx("y1", "youtube", 0.5),
      idx("y2", "youtube", 0.4),
      idx("y3", "youtube", 0.6),
      idx("n", "youtube", NaN),
    ];
    const { rows, missing, overall } = compareGroups(vids, dim("platform"), measure("index168"));
    expect(rows.map((r) => r.value)).toEqual(["YouTube", "TikTok"]);
    expect(missing).toBe(0);
    expect(overall).toBeCloseTo((0.6 + 2) / 2);
    const tiktok = rows.find((r) => r.value === "TikTok")!;
    expect(tiktok.median).toBe(3);
    expect(tiktok.lift).toBeCloseTo(3 / 0.5 - 1);
    // 3 against 3 can't get under 0.1 however clean the split.
    expect(tiktok.p).toBeCloseTo(0.1);
    expect(tiktok.verdict).toBe("leaning");
  });

  it("calls too few posts too few, and leaves posts without a value out", () => {
    const vids = [idx("a", "tiktok", 2, { seconds: 10 }), idx("b", "tiktok", 1, { seconds: 50 }), idx("c", "tiktok", 1)];
    const { rows, missing } = compareGroups(vids, dim("length"), measure("index168"));
    expect(missing).toBe(1);
    expect(rows.map((r) => [r.value, r.verdict])).toEqual([
      ["Under 15s", "few"],
      ["45 to 60s", "few"],
    ]);
    expect(verdictOf([1, 2, 3, 4], [10, 11, 12, 13], measure("engagement")).verdict).toBe("real");
  });

  it("only counts the tag flags on videos someone has tagged", () => {
    expect(dim("face").values(video({ key: "a" }))).toEqual([]);
    expect(dim("face").values(video({ key: "a", tags: { style: "Talking head" } }))).toEqual(["No face"]);
    expect(dim("face").values(video({ key: "a", tags: { style: "Talking head", face: true } }))).toEqual(["Face on screen"]);
    expect(hashtagBucket(0)).toBe("No hashtags");
    expect(hashtagBucket(4)).toBe("3 to 5 hashtags");
  });

  it("names what a group's posts nearly all share", () => {
    const talk = (key: string, platform: InsightVideo["platform"]) => video({ key, platform, tags: { style: "Talking head" } });
    const screen = (key: string, platform: InsightVideo["platform"]) => video({ key, platform, tags: { style: "Screen recording" } });
    const members = [talk("a", "tiktok"), talk("b", "tiktok"), talk("c", "tiktok"), talk("d", "tiktok")];
    const rest = [screen("e", "youtube"), screen("f", "youtube"), screen("g", "tiktok")];
    expect(oftenWith(members, rest, "style")).toMatchObject({ label: "TikTok", share: 1 });
    expect(oftenWith(members, rest, "platform")).toMatchObject({ label: "Style: Talking head" });
    expect(oftenWith(members.slice(0, 2), rest, "style")).toBeNull();
  });

  it("leaves posts in both groups out of a head to head", () => {
    const vids = [
      video({ key: "a", tags: { topics: ["Offers"] }, index: { 24: null, 168: 2 } }),
      video({ key: "b", tags: { topics: ["Offers", "Shipping"] }, index: { 24: null, 168: 1 } }),
      video({ key: "c", tags: { topics: ["Shipping"] }, index: { 24: null, 168: 0.5 } }),
    ];
    const duel = compareTwo(vids, dim("topic"), "Offers", "Shipping", measure("index168"));
    expect(duel.a.map((p) => p.key)).toEqual(["a"]);
    expect(duel.b.map((p) => p.key)).toEqual(["c"]);
    expect(duel.both).toBe(1);
    expect(duel.verdict).toBe("few");
  });

  it("lists a two-way split once, from the winning side", () => {
    const vids = [
      ...[1, 2, 3, 4, 5].map((n) => video({ key: `p${n}`, postId: "x", index: { 24: null, 168: 3 + n / 10 } })),
      ...[1, 2, 3, 4, 5].map((n) => video({ key: `d${n}`, index: { 24: null, 168: 0.3 + n / 100 } })),
    ];
    const found = findings(vids, measure("index168")).filter((f) => f.dimension.key === "source");
    expect(found).toHaveLength(1);
    expect(found[0].row.value).toBe("From the planner");
    expect(found[0].row.verdict).toBe("real");
  });
});

describe("permutation test, sampled", () => {
  it("still finds a clean split and ignores noise, whichever side is smaller", () => {
    const big = Array.from({ length: 40 }, (_, i) => i % 7);
    const high = [20, 21, 22, 23, 24];
    expect(permutationP(high, big)).toBeLessThan(0.001);
    expect(permutationP(big, high)).toBeLessThan(0.001);
    const same = Array.from({ length: 12 }, (_, i) => i % 7);
    expect(permutationP(same, big)).toBeGreaterThan(0.3);
  });
});
