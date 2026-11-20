import { describe, expect, it } from "vitest";
import {
  assembleVideos,
  health,
  indexTone,
  indexVideos,
  per1k,
  postRows,
  strip,
  viewsAtAges,
  watchedPct,
  type AgePointRow,
  type OverviewVideo,
} from "../lib/social/overview";
import {
  autoTags,
  captionFeatures,
  cleanTags,
  formatLength,
  isTagged,
  lengthBucket,
  slotOf,
  tagLabels,
  tagOptions,
} from "../lib/social/tags";
import {
  isoDurationSeconds,
  parseFacebookReels,
  parseTikTokVideos,
  parseYouTubeVideos,
} from "../supabase/functions/marketing-sync/parse";

const H = 3600_000;
const DAY = 24 * H;

describe("tags", () => {
  it("keeps only what we store, trimmed and deduplicated", () => {
    expect(
      cleanTags({
        opening: "  Demo   first ",
        style: 7,
        topics: ["Offers", "Offers", "", "A", "B", "C", "D", "E"],
        sound: "",
        face: true,
        hookText: "yes",
        extra: "x",
      }),
    ).toEqual({ opening: "Demo first", topics: ["Offers", "A", "B", "C", "D"], face: true });
    expect(cleanTags(null)).toEqual({});
    expect(cleanTags(["a"])).toEqual({});
    expect(cleanTags({ opening: "x".repeat(60) }).opening).toHaveLength(40);
    expect(cleanTags({ madeWith: "Trend Remix", by: "auto" })).toEqual({ madeWith: "Trend Remix", by: "auto" });
    expect(cleanTags({ by: "someone" })).toEqual({});
  });

  it("counts a video as tagged only when something besides the flags is set", () => {
    expect(isTagged({ face: true })).toBe(false);
    expect(isTagged({ topics: ["Offers"] })).toBe(true);
    expect(tagLabels({ opening: "Question", topics: ["Fees"], collab: true })).toEqual([
      "Question",
      "Fees",
      "Made with a seller",
    ]);
  });

  it("offers custom values next to the defaults", () => {
    const options = tagOptions([{ opening: "Duet reply" }, { topics: ["Returns"] }]);
    expect(options.opening).toContain("Demo first");
    expect(options.opening).toContain("Duet reply");
    expect(options.topics).toContain("Returns");
  });
});

describe("automatic tags", () => {
  it("reads the slot in UK time, summer and winter", () => {
    // 17:30 UTC in July is 18:30 BST; in November it is 17:30 GMT.
    expect(slotOf("2026-07-07T17:30:00Z")).toMatchObject({ day: "Tue", part: "Evening", hour: 18 });
    expect(slotOf("2026-11-17T17:30:00Z")).toMatchObject({ day: "Tue", part: "Afternoon", hour: 17 });
    expect(slotOf("2026-11-17T23:30:00Z")).toMatchObject({ day: "Tue", part: "Late" });
    expect(slotOf("2026-11-18T03:00:00Z")).toMatchObject({ day: "Wed", part: "Late" });
    expect(slotOf(null)).toBeNull();
  });

  it("buckets and prints lengths", () => {
    expect(lengthBucket(14.9)).toBe("Under 15s");
    expect(lengthBucket(15)).toBe("15 to 30s");
    expect(lengthBucket(60)).toBe("45 to 60s");
    expect(lengthBucket(61)).toBe("Over 60s");
    expect(lengthBucket(null)).toBeNull();
    expect(formatLength(18.4)).toBe("18s");
    expect(formatLength(65)).toBe("1m 05s");
  });

  it("reads what a caption does", () => {
    expect(captionFeatures("Which takes more? Link in bio #depop #ebay")).toEqual({
      size: "Short caption",
      question: true,
      hashtags: 2,
      callToAction: true,
    });
    expect(captionFeatures("  ")).toBeNull();
    expect(
      autoTags({ publishedAt: "2026-11-17T18:30:00Z", seconds: 18, caption: "Crosslist in 20 seconds. Try it free" }),
    ).toEqual(["18s", "Tue evening", "Short caption", "Call to action"]);
  });
});

describe("views at an age", () => {
  const published = "2026-11-01T10:00:00Z";
  const p = Date.parse(published);
  const at = (h: number) => new Date(p + h * H).toISOString();
  const row = (age: number, extra: Partial<AgePointRow>): AgePointRow => ({
    platform: "tiktok",
    external_id: "v",
    age_hours: age,
    hourly_before_at: null,
    hourly_before_views: null,
    hourly_after_at: null,
    hourly_after_views: null,
    daily_before_at: null,
    daily_before_views: null,
    daily_after_at: null,
    daily_after_views: null,
    ...extra,
  });
  const pub = new Map([["tiktok:v", published]]);

  it("interpolates between the hourly snapshots either side", () => {
    const out = viewsAtAges(
      [row(24, { hourly_before_at: at(23.5), hourly_before_views: 2350, hourly_after_at: at(24.5), hourly_after_views: 2450 })],
      pub,
    );
    expect(out.get("tiktok:v")![24]).toBeCloseTo(2400);
  });

  it("uses daily rows for 7 days, but not for 24 hours", () => {
    const out = viewsAtAges(
      [
        row(24, { daily_before_at: at(13), daily_before_views: 1000, daily_after_at: at(37), daily_after_views: 3000 }),
        row(168, { daily_before_at: at(157), daily_before_views: 9000, daily_after_at: at(181), daily_after_views: 10200 }),
      ],
      pub,
    );
    expect(out.get("tiktok:v")![24]).toBeNull();
    expect(out.get("tiktok:v")![168]).toBeCloseTo(9550);
  });

  it("prefers the closer hourly point when both sources have one", () => {
    const out = viewsAtAges(
      [
        row(168, {
          hourly_before_at: at(167.9),
          hourly_before_views: 9990,
          hourly_after_at: at(168.1),
          hourly_after_views: 10010,
          daily_before_at: at(150),
          daily_before_views: 1,
          daily_after_at: at(174),
          daily_after_views: 99999,
        }),
      ],
      pub,
    );
    expect(out.get("tiktok:v")![168]).toBeCloseTo(10000);
  });

  it("has no number before the video reaches the age", () => {
    const out = viewsAtAges([row(168, { hourly_before_at: at(30), hourly_before_views: 500 })], pub);
    expect(out.get("tiktok:v")![168]).toBeNull();
  });
});

describe("index against typical", () => {
  const vid = (key: string, daysAgo: number, v168: number | null, platform: "tiktok" | "youtube" = "tiktok") => ({
    key,
    platform,
    published_at: new Date(Date.parse("2026-11-16T12:00:00Z") - daysAgo * DAY).toISOString(),
    at: { 168: v168 } as Partial<Record<number, number | null>>,
  });

  it("scores each video against the median of the others", () => {
    const { index, typical } = indexVideos([
      vid("a", 10, 1000),
      vid("b", 11, 2000),
      vid("c", 12, 4000),
      vid("d", 13, 8000),
    ]);
    // a's others: 2000, 4000, 8000, median 4000.
    expect(index.get("a")![168]).toBeCloseTo(0.25);
    expect(index.get("d")![168]).toBeCloseTo(8000 / 2000);
    expect(typical.tiktok[168]).toEqual({ views: 3000, videos: 4 });
    expect(typical.youtube[168]).toEqual({ views: null, videos: 0 });
  });

  it("needs three others before it scores anything", () => {
    const { index } = indexVideos([vid("a", 10, 1000), vid("b", 11, 2000), vid("c", 12, 4000)]);
    expect(index.get("a")![168]).toBeNull();
  });

  it("never mixes platforms, and uses only the most recent ones as the baseline", () => {
    const { index } = indexVideos(
      [
        vid("new", 8, 100),
        vid("x", 9, 100),
        vid("y", 10, 100),
        vid("z", 11, 100),
        vid("old", 60, 100000),
        vid("yt", 9, 5, "youtube"),
      ],
      { recent: 4 },
    );
    expect(index.get("new")![168]).toBeCloseTo(1);
    // old is outside the 4 most recent, so it is scored against them.
    expect(index.get("old")![168]).toBeCloseTo(1000);
    expect(index.get("yt")![168]).toBeNull();
  });

  it("colours by how far from typical", () => {
    expect(indexTone(1.6)).toBe("well-above");
    expect(indexTone(1.2)).toBe("above");
    expect(indexTone(1)).toBe("typical");
    expect(indexTone(0.8)).toBe("below");
    expect(indexTone(0.5)).toBe("well-below");
  });
});

describe("overview", () => {
  const nowMs = Date.parse("2026-11-16T12:00:00Z");
  const video = (o: Partial<OverviewVideo> & { key: string }): OverviewVideo => ({
    platform: "tiktok",
    external_id: o.key.split(":")[1] ?? o.key,
    title: "t",
    url: null,
    thumbnail_url: null,
    published_at: new Date(nowMs - 3 * DAY).toISOString(),
    postId: null,
    postName: null,
    tags: {},
    seconds: null,
    caption: null,
    views: null,
    likes: null,
    comments: null,
    shares: null,
    saves: null,
    avgWatchSeconds: null,
    avgViewPct: null,
    subscribersGained: null,
    at: { 24: null, 168: null },
    index: { 24: null, 168: null },
    ...o,
  });

  it("works out watched and per-1,000 rates", () => {
    expect(watchedPct({ avgViewPct: 71, avgWatchSeconds: null, seconds: null })).toBe(71);
    expect(watchedPct({ avgViewPct: null, avgWatchSeconds: 9, seconds: 18 })).toBe(50);
    expect(watchedPct({ avgViewPct: null, avgWatchSeconds: 30, seconds: 18 })).toBe(100);
    expect(watchedPct({ avgViewPct: null, avgWatchSeconds: 9, seconds: null })).toBeNull();
    expect(per1k(7, 1000)).toBe(7);
    expect(per1k(7, 99)).toBeNull();
    expect(per1k(null, 1000)).toBeNull();
  });

  it("compares this period's middle post with the one before", () => {
    const rows = health(
      [
        video({ key: "tiktok:a", index: { 24: null, 168: 2 }, shares: 10, views: 1000 }),
        video({ key: "tiktok:b", index: { 24: null, 168: 1 }, shares: 2, views: 1000 }),
        video({ key: "tiktok:c", index: { 24: null, 168: 1.5 }, shares: 6, views: 1000 }),
        video({
          key: "tiktok:old",
          published_at: new Date(nowMs - 40 * DAY).toISOString(),
          index: { 24: null, 168: 0.5 },
        }),
        video({ key: "tiktok:ancient", published_at: new Date(nowMs - 90 * DAY).toISOString(), index: { 24: null, 168: 9 } }),
      ],
      { nowMs, days: 30, age: 168 },
    );
    const index = rows.find((r) => r.key === "index")!;
    expect(index).toMatchObject({ now: 1.5, before: 0.5, nNow: 3, nBefore: 1 });
    expect(rows.find((r) => r.key === "shares")).toMatchObject({ now: 6, nNow: 3, before: null });
  });

  it("puts each platform's recent posts on the strip", () => {
    const rows = strip(
      [
        video({ key: "tiktok:a", index: { 24: 1.2, 168: null } }),
        video({ key: "tiktok:b", index: { 24: null, 168: null } }),
        video({ key: "youtube:c", platform: "youtube", index: { 24: 3, 168: null } }),
      ],
      { nowMs, days: 30, age: 24 },
    );
    expect(rows.find((r) => r.platform === "tiktok")).toMatchObject({ posts: 2, median: 1.2 });
    expect(rows.find((r) => r.platform === "tiktok")!.dots).toHaveLength(1);
    expect(rows.find((r) => r.platform === "facebook")).toMatchObject({ posts: 0, median: null });
  });

  it("groups a planner post's platforms into one row and keeps lone videos apart", () => {
    const rows = postRows([
      video({ key: "tiktok:t1", postId: "p1", postName: "Crosslist", views: 100, seconds: 18, tags: { opening: "Demo first" } }),
      video({ key: "youtube:y1", platform: "youtube", postId: "p1", postName: "Crosslist", views: 50, published_at: new Date(nowMs - 4 * DAY).toISOString() }),
      video({ key: "instagram:i9", platform: "instagram", title: "Old reel", views: null }),
    ]);
    expect(rows).toHaveLength(2);
    const post = rows.find((r) => r.postId === "p1")!;
    expect(post.title).toBe("Crosslist");
    expect(Object.keys(post.videos).sort()).toEqual(["tiktok", "youtube"]);
    expect(post.views).toBe(150);
    expect(post.publishedAt).toBe(new Date(nowMs - 4 * DAY).toISOString());
    expect(post.tagTarget).toEqual({ postId: "p1", platform: "tiktok", externalId: "t1" });
    const lone = rows.find((r) => !r.postId)!;
    expect(lone.tagTarget).toEqual({ postId: null, platform: "instagram", externalId: "i9" });
    expect(lone.views).toBeNull();
  });

  it("takes tags, length and caption from the planner post when there is one", () => {
    const { videos } = assembleVideos({
      videos: [
        {
          platform: "tiktok",
          external_id: "t1",
          title: "First line",
          url: null,
          thumbnail_url: null,
          published_at: "2026-11-10T18:00:00Z",
          tags: { style: "Ignored" },
          duration_seconds: "21.0",
          caption: "From the sync",
        },
        {
          platform: "youtube",
          external_id: "y1",
          title: "Lone",
          url: null,
          thumbnail_url: null,
          published_at: "2026-11-10T18:00:00Z",
          tags: { style: "Talking head" },
          duration_seconds: 40,
          caption: null,
        },
      ],
      latest: new Map(),
      agePoints: [],
      posts: [
        {
          id: "p1",
          name: "Crosslist",
          tags: { opening: "Demo first" },
          media_seconds: "18.4",
          targets: [{ platform: "tiktok", external_id: "t1", caption: "Planner caption?" }],
        },
      ],
    });
    const t = videos.find((v) => v.key === "tiktok:t1")!;
    expect(t).toMatchObject({ postId: "p1", postName: "Crosslist", tags: { opening: "Demo first" }, seconds: 18.4, caption: "Planner caption?" });
    const y = videos.find((v) => v.key === "youtube:y1")!;
    expect(y).toMatchObject({ postId: null, tags: { style: "Talking head" }, seconds: 40, caption: "Lone" });
  });
});

describe("marketing-sync length and caption", () => {
  it("reads YouTube's ISO durations", () => {
    expect(isoDurationSeconds("PT45S")).toBe(45);
    expect(isoDurationSeconds("PT1M5S")).toBe(65);
    expect(isoDurationSeconds("PT1H2M3S")).toBe(3723);
    expect(isoDurationSeconds("P0D")).toBeNull();
    expect(isoDurationSeconds(undefined)).toBeNull();
    const [v] = parseYouTubeVideos([
      { id: "a", snippet: { title: "T", description: "Line one\nLine two" }, contentDetails: { duration: "PT30S" }, statistics: {} },
    ]);
    expect(v).toMatchObject({ durationSeconds: 30, caption: "Line one\nLine two" });
  });

  it("reads TikTok's and Facebook's length and whole caption", () => {
    const [t] = parseTikTokVideos([{ id: 1, title: "", video_description: "Hi\nthere #x", duration: 18 }]);
    expect(t).toMatchObject({ title: "Hi", caption: "Hi\nthere #x", durationSeconds: 18 });
    const [f] = parseFacebookReels([{ id: "9", description: "Reel\nmore", length: 22.46 }], new Map());
    expect(f).toMatchObject({ caption: "Reel\nmore", durationSeconds: 22.5 });
    const [g] = parseFacebookReels([{ id: "8" }], new Map());
    expect(g).toMatchObject({ caption: null, durationSeconds: null });
  });
});
