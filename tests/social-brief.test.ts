import { describe, expect, it } from "vitest";
import { ruleMembers, ruleProgress, ruleWarnings, weeklyBrief } from "../lib/social/brief";
import { ukHourOn } from "../lib/social/calendar";
import { zeroGains, type InsightVideo } from "../lib/social/insights";
import type { SocialExperimentRow } from "../lib/social/types";

const NOW = Date.parse("2026-11-20T12:00:00Z");

function video(o: Partial<InsightVideo> & { key: string }): InsightVideo {
  return {
    platform: "tiktok",
    external_id: o.key,
    title: o.key,
    url: null,
    thumbnail: null,
    publishedAt: "2026-11-15T12:00:00Z",
    postId: null,
    tags: {},
    seconds: null,
    caption: null,
    slot: null,
    ageDays: 5,
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
    at: { 1: null, 6: null, 24: 100, 72: null, 168: null },
    index: { 24: 1, 168: null },
    gained: { 7: zeroGains(), 30: zeroGains(), 90: zeroGains() },
    gapHours: null,
    ...o,
  };
}

const exp = {
  id: "e1",
  name: "POV vs Story",
  metric: "views_24h",
  status: "running",
  dimension: "format",
  starts_at: "2026-11-10T00:00:00Z",
  target_per_variant: 2,
  variants: [
    { key: "A", label: "POV", value: "POV" },
    { key: "B", label: "Story", value: "Story" },
  ],
} satisfies Partial<SocialExperimentRow> as SocialExperimentRow;

describe("rule experiments", () => {
  const videos = [
    video({ key: "a1", tags: { format: "POV" } }),
    video({ key: "a2", tags: { format: "POV" } }),
    video({ key: "b1", tags: { format: "Story" } }),
    video({ key: "b2", tags: { format: "Story" }, at: { 1: null, 6: null, 24: null, 72: null, 168: null } }),
    video({ key: "old", tags: { format: "POV" }, publishedAt: "2026-11-01T12:00:00Z" }),
    video({ key: "other", tags: { format: "Skit" } }),
  ];

  it("takes every post from the start whose value is a variant's", () => {
    expect(ruleMembers(exp, videos).map((m) => `${m.external_id}:${m.variant}`)).toEqual([
      "a1:A",
      "a2:A",
      "b1:B",
      "b2:B",
    ]);
  });

  it("is ready only once every variant has the target measured", () => {
    const p = ruleProgress(exp, videos);
    expect(p.variants.map((v) => [v.posted, v.measured])).toEqual([
      [2, 2],
      [2, 1],
    ]);
    expect(p.ready).toBe(false);
    expect(ruleProgress({ ...exp, target_per_variant: 1 }, videos).ready).toBe(true);
  });

  it("warns when one variant is mostly something else too", () => {
    const evening = { day: "Sat" as const, part: "Evening" as const, hour: 19 };
    const morning = { day: "Sat" as const, part: "Morning" as const, hour: 9 };
    const mixed = [
      ...["1", "2", "3"].map((k) => video({ key: `p${k}`, tags: { format: "POV" }, slot: evening })),
      ...["1", "2", "3"].map((k) => video({ key: `s${k}`, tags: { format: "Story" }, slot: morning })),
    ];
    expect(ruleWarnings(exp, mixed).join(" ")).toMatch(/POV: 100% are/);
  });
});

describe("weekly brief", () => {
  it("lists best UK hours with at least 3 scored posts, and what a running test needs", () => {
    const at = (hour: number, index: number, key: string) =>
      video({ key, slot: { day: "Mon", part: "Evening", hour }, index: { 24: index, 168: null } });
    const brief = weeklyBrief(
      [at(18, 2, "x1"), at(18, 3, "x2"), at(18, 2, "x3"), at(9, 1, "y1"), at(9, 1, "y2"), at(9, 1, "y3"), at(13, 9, "z1")],
      [exp],
      NOW,
    );
    expect(brief.bestHours).toEqual([
      { hour: 18, index: 2, posts: 3 },
      { hour: 9, index: 1, posts: 3 },
    ]);
    expect(brief.week.uploads).toBe(7);
    expect(brief.week.best?.index).toBe(9);
    expect(brief.experiments[0].needs).toEqual(['2 more "POV"', '2 more "Story"']);
  });
});

describe("ukHourOn", () => {
  it("lands on that London hour in summer and winter", () => {
    const fmt = (d: Date) =>
      d.toLocaleString("en-GB", { timeZone: "Europe/London", hour: "2-digit", hourCycle: "h23" });
    expect(fmt(ukHourOn(new Date(2026, 6, 1), 18))).toBe("18");
    expect(fmt(ukHourOn(new Date(2026, 11, 1), 9))).toBe("09");
  });
});
