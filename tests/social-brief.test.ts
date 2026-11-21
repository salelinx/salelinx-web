import { describe, expect, it } from "vitest";
import { autoTests, weeklyBrief } from "../lib/social/brief";
import { ukHourOn } from "../lib/social/calendar";
import { zeroGains, type InsightVideo } from "../lib/social/insights";

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

describe("automatic tests", () => {
  const posts = (format: string, indexes: number[]) =>
    indexes.map((index, i) => video({ key: `${format}${i}`, tags: { format }, index: { 24: index, 168: null } }));
  const format = (videos: InsightVideo[]) => autoTests(videos).find((t) => t.key === "format")!;

  it("puts the two most posted values head to head and says what each side needs", () => {
    const t = format([...posts("POV", [2, 2, 2]), ...posts("Story", [1, 1]), ...posts("Skit", [9])]);
    expect([t.a.value, t.b.value]).toEqual(["POV", "Story"]);
    expect([t.a.median, t.b.median]).toEqual([2, 1]);
    expect(t.status).toBe("testing");
    expect(t.leader).toBe("POV");
    expect(t.needs).toEqual(['5 more "POV"', '6 more "Story"']);
  });

  it("calls a clean split a winner, and a full test with no gap even", () => {
    const won = format([...posts("POV", [4, 5, 4, 5]), ...posts("Story", [1, 1.2, 1, 1.2])]);
    expect(won.status).toBe("winner");
    expect(won.lift).toBeCloseTo(3.09, 1);
    expect(won.needs).toEqual([]);
    const flat = Array(8).fill(1);
    const even = format([...posts("POV", flat), ...posts("Story", flat)]);
    expect(even.status).toBe("even");
    expect(even.needs).toEqual([]);
  });

  it("skips a tag with only one value", () => {
    expect(autoTests(posts("POV", [1, 2])).some((t) => t.key === "format")).toBe(false);
  });
});

describe("weekly brief", () => {
  it("lists best UK hours with at least 3 scored posts", () => {
    const at = (hour: number, index: number, key: string) =>
      video({ key, slot: { day: "Mon", part: "Evening", hour }, index: { 24: index, 168: null } });
    const brief = weeklyBrief(
      [at(18, 2, "x1"), at(18, 3, "x2"), at(18, 2, "x3"), at(9, 1, "y1"), at(9, 1, "y2"), at(9, 1, "y3"), at(13, 9, "z1")],
      NOW,
    );
    expect(brief.bestHours).toEqual([
      { hour: 18, index: 2, posts: 3 },
      { hour: 9, index: 1, posts: 3 },
    ]);
    expect(brief.week.uploads).toBe(7);
    expect(brief.week.best?.index).toBe(9);
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
