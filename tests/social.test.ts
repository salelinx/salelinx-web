import { describe, expect, it } from "vitest";
import {
  comparePlatform,
  curveAt,
  medianCurve,
  permutationP,
  typical,
  valueAtAge,
  videoCurve,
  type ExperimentMember,
} from "../lib/social/experiments";
import { hashtagCount, scheduleProblems, targetProblems } from "../lib/social/validate";
import {
  facebookNext,
  instagramNext,
  instagramTrialParams,
  retryIn,
  tiktokChunks,
  tiktokNext,
  youtubeChunks,
  youtubeStatus,
} from "../supabase/functions/marketing-publish/plan";
import {
  parseFacebookReels,
  parseInstagramMedia,
  parseYouTubeAnalytics,
} from "../supabase/functions/marketing-sync/parse";

const H = 3600_000;
const MiB = 1024 * 1024;
const T0 = Date.parse("2026-11-10T12:00:00Z");

describe("views at an age", () => {
  it("interpolates between the snapshots either side, from zero at posting", () => {
    const pts = [
      { t: T0 + 0.5 * H, v: 50 },
      { t: T0 + 1.5 * H, v: 150 },
    ];
    expect(valueAtAge(pts, T0, 1)).toBe(100);
    // Before the first snapshot it runs from the zero at posting time.
    expect(valueAtAge(pts, T0, 0.25)).toBe(25);
  });

  it("is null until a snapshot reaches the age", () => {
    expect(valueAtAge([{ t: T0 + 2 * H, v: 10 }], T0, 6)).toBeNull();
  });

  it("refuses to bridge a gap too wide to trust", () => {
    // First tracked 30 hours in: no honest 1-hour figure.
    expect(valueAtAge([{ t: T0 + 30 * H, v: 900 }], T0, 1)).toBeNull();
    // At 7 days a 24-hour gap is fine (under a quarter of the age).
    expect(
      valueAtAge(
        [
          { t: T0 + 150 * H, v: 1000 },
          { t: T0 + 174 * H, v: 1240 },
        ],
        T0,
        168,
      ),
    ).toBe(1180);
  });

  it("builds ages, engagement and a curve from hourly rows", () => {
    const row = (h: number, views: number, likes: number) => ({
      platform: "instagram" as const,
      external_id: "x",
      captured_at: new Date(T0 + h * H).toISOString(),
      views,
      likes,
      comments: 0,
      shares: null,
    });
    const c = videoCurve(
      [row(1, 100, 5), row(6, 400, 20), row(24, 1000, 40), row(72, 2000, 80), row(168, 3000, 150)],
      new Date(T0).toISOString(),
    );
    expect(c.ages).toEqual({ 1: 100, 6: 400, 24: 1000, 72: 2000, 168: 3000 });
    expect(c.engagement7d).toBe(0.05);
    expect(c.curve[0]).toEqual({ h: 0, views: 0 });
    expect(curveAt(c.curve, 12)).toBe(600);
    expect(curveAt(c.curve, 200)).toBeNull();
  });
});

describe("comparing variants", () => {
  it("uses a geometric mean for views, so one viral video cannot swamp the rest", () => {
    expect(typical([99, 99, 9999], "views_24h")).toBeCloseTo(463.2, 0);
    expect(typical([0.02, 0.04], "engagement_7d")).toBeCloseTo(0.03);
  });

  it("can never call 1 vs 1 or 2 vs 2 significant", () => {
    expect(permutationP([5], [1])).toBe(1);
    expect(permutationP([5, 6], [1, 2])).toBeCloseTo(2 / 6);
  });

  it("finds a clean split significant once there are enough videos", () => {
    expect(permutationP([10, 11, 12, 13], [1, 2, 3, 4])).toBeCloseTo(2 / 70);
  });

  it("samples deterministically when exact enumeration is too big", () => {
    const a = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
    const b = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(permutationP(a, b)).toBe(permutationP(a, b));
  });

  const member = (variant: string, value: number | null, platform: "youtube" | "tiktok" = "tiktok") =>
    ({
      platform,
      external_id: `${variant}${value}`,
      variant,
      value,
    }) as unknown as ExperimentMember;
  const variants = [
    { key: "A", label: "" },
    { key: "B", label: "" },
  ];

  it("calls one video a side a hint, and never pools platforms", () => {
    const r = comparePlatform("tiktok", [member("A", 300), member("B", 100), member("B", 5000, "youtube")], variants, "views_24h");
    expect(r.leader).toBe("A");
    expect(r.verdict).toBe("hint");
    expect(r.variants.find((v) => v.key === "B")!.videos).toBe(1);
  });

  it("waits while a side has nothing measured yet", () => {
    const r = comparePlatform("tiktok", [member("A", 300), member("B", null)], variants, "views_24h");
    expect(r.verdict).toBe("waiting");
  });

  it("takes the median curve only while enough videos reach that far", () => {
    const line = (k: number, until: number) => [
      { h: 0, views: 0 },
      { h: until, views: k * until },
    ];
    const m = medianCurve([line(1, 10), line(2, 10), line(3, 5)], 10);
    expect(m.map((p) => p.h)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(m[4].views).toBe(8);
  });
});

describe("publisher plans", () => {
  it("cuts YouTube uploads into 8 MiB pieces", () => {
    const chunks = youtubeChunks(20 * MiB);
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toEqual({ start: 0, end: 8 * MiB - 1 });
    expect(chunks[2]).toEqual({ start: 16 * MiB, end: 20 * MiB - 1 });
  });

  it("follows TikTok's chunk rules", () => {
    expect(tiktokChunks(3 * MiB)).toMatchObject({ chunkSize: 3 * MiB, count: 1 });
    expect(tiktokChunks(19 * MiB).count).toBe(1);
    const big = tiktokChunks(55 * MiB);
    // floor(55 / 10) = 5 chunks, the last takes the 5 MiB remainder.
    expect(big.count).toBe(5);
    expect(big.chunks[4]).toEqual({ start: 40 * MiB, end: 55 * MiB - 1 });
    expect(big.chunks.at(-1)!.end - big.chunks.at(-1)!.start + 1).toBeLessThanOrEqual(128 * MiB);
  });

  it("lets YouTube publish on time itself when the post is far enough off", () => {
    const now = T0;
    expect(youtubeStatus({}, new Date(now + 55 * 60_000).toISOString(), now)).toEqual({
      privacyStatus: "private",
      publishAt: new Date(now + 55 * 60_000).toISOString(),
    });
    expect(youtubeStatus({}, new Date(now + 5 * 60_000).toISOString(), now)).toEqual({ privacyStatus: "public" });
    expect(youtubeStatus({ privacy: "unlisted" }, new Date(now + 55 * 60_000).toISOString(), now)).toEqual({
      privacyStatus: "unlisted",
    });
  });

  it("asks for Trial Reels only when chosen", () => {
    expect(instagramTrialParams({ trial: "off" })).toBeNull();
    expect(instagramTrialParams({ trial: "auto" })).toEqual({ graduation_strategy: "SS_PERFORMANCE" });
  });

  it("reads TikTok's inbox progress", () => {
    const at = new Date(T0).toISOString();
    expect(tiktokNext({ status: "SEND_TO_USER_INBOX" }, at, T0 + H)).toMatchObject({ kind: "wait", status: "inbox" });
    expect(tiktokNext({ status: "PUBLISH_COMPLETE", publicaly_available_post_id: [7123] }, at, T0 + H)).toEqual({
      kind: "published",
      externalId: "7123",
    });
    expect(tiktokNext({ status: "SEND_TO_USER_INBOX" }, at, T0 + 8 * 24 * H).kind).toBe("failed");
    expect(tiktokNext({ status: "FAILED", fail_reason: "file_format_check_failed" }, at, T0)).toEqual({
      kind: "failed",
      error: "TikTok: file_format_check_failed",
    });
  });

  it("reads Instagram's container status", () => {
    const at = new Date(T0).toISOString();
    expect(instagramNext("FINISHED", undefined, at, T0).kind).toBe("publish");
    expect(instagramNext("IN_PROGRESS", undefined, at, T0 + 60_000).kind).toBe("wait");
    expect(instagramNext("IN_PROGRESS", undefined, at, T0 + 2 * H).kind).toBe("failed");
  });

  it("follows a Facebook Reel until it is live", () => {
    const at = new Date(T0).toISOString();
    expect(facebookNext({ publishing_phase: { status: "complete" } }, at, T0).kind).toBe("published");
    expect(facebookNext({ video_status: "processing", publishing_phase: { status: "in_progress" } }, at, T0 + 60_000)).toMatchObject({
      kind: "wait",
      status: "processing",
    });
    expect(
      facebookNext({ processing_phase: { status: "error", errors: [{ message: "Video too long" }] } }, at, T0),
    ).toEqual({ kind: "failed", error: "Facebook couldn't process the Reel: Video too long" });
    expect(facebookNext({ video_status: "processing" }, at, T0 + 2 * H).kind).toBe("failed");
  });

  it("backs off and then gives up", () => {
    expect([0, 1, 2, 3].map(retryIn)).toEqual([120, 240, 480, null]);
  });
});

describe("planner checks", () => {
  it("catches each platform's limits before scheduling", () => {
    expect(targetProblems({ platform: "youtube", title: "", caption: "" })).toContain("YouTube needs a title.");
    expect(targetProblems({ platform: "youtube", title: "a <b>", caption: "" })[0]).toMatch(/< or >/);
    const tags = Array.from({ length: 31 }, (_, i) => `#t${i}`).join(" ");
    expect(hashtagCount(tags)).toBe(31);
    expect(targetProblems({ platform: "instagram", title: "", caption: tags })).toEqual([
      "Instagram allows at most 30 hashtags.",
    ]);
    expect(targetProblems({ platform: "tiktok", title: "", caption: "fine #ok" })).toEqual([]);
  });

  it("needs a video, a platform and a time still to come", () => {
    expect(
      scheduleProblems({ hasMedia: false, platforms: [], scheduledAt: null, now: false, nowMs: T0 }),
    ).toHaveLength(3);
    expect(
      scheduleProblems({
        hasMedia: true,
        platforms: ["tiktok"],
        scheduledAt: new Date(T0 - H).toISOString(),
        now: false,
        nowMs: T0,
      }),
    ).toEqual(["That time has passed. Pick a later one, or use Post now."]);
  });
});

describe("deeper stats parsing", () => {
  it("reads YouTube Analytics rows by column name", () => {
    const m = parseYouTubeAnalytics({
      columnHeaders: [
        { name: "video" },
        { name: "views" },
        { name: "estimatedMinutesWatched" },
        { name: "averageViewDuration" },
        { name: "averageViewPercentage" },
        { name: "subscribersGained" },
        { name: "shares" },
      ],
      rows: [["abc", 1000, 50, 3, 61.5, 4, 9]],
    });
    expect(m.get("abc")).toEqual({
      shares: 9,
      watchSeconds: 3000,
      avgWatchSeconds: 3,
      avgViewPct: 61.5,
      subscribersGained: 4,
    });
  });

  it("reads Facebook Reels, their summaries and Facebook's time format", () => {
    const [v] = parseFacebookReels(
      [
        {
          id: 991,
          description: "Relist faster\n#reseller",
          created_time: "2026-11-01T10:00:00+0000",
          permalink_url: "/reel/991/",
          likes: { summary: { total_count: 12 } },
          comments: { summary: { total_count: 3 } },
        },
      ],
      new Map([["991", { fb_reels_total_plays: 540, post_impressions_unique: 400, post_video_avg_time_watched: 6150 }]]),
    );
    expect(v).toMatchObject({
      externalId: "991",
      title: "Relist faster",
      url: "https://www.facebook.com/reel/991/",
      publishedAt: "2026-11-01T10:00:00.000Z",
      views: 540,
      likes: 12,
      comments: 3,
      shares: null,
      reach: 400,
      avgWatchSeconds: 6.2,
    });
  });

  it("keeps total watch time whole, since watch_seconds is a BIGINT", () => {
    const [v] = parseInstagramMedia(
      [{ id: "2", media_type: "VIDEO", timestamp: "2026-11-01T00:00:00Z" }],
      new Map([["2", { ig_reels_video_view_total_time: 4930100, ig_reels_avg_watch_time: 4321 }]]),
    );
    expect(v.watchSeconds).toBe(4930);
    expect(Number.isInteger(v.watchSeconds)).toBe(true);
    expect(v.avgWatchSeconds).toBe(4.3);
  });

  it("turns Instagram's millisecond watch times into seconds", () => {
    const [v] = parseInstagramMedia(
      [{ id: "1", media_type: "VIDEO", timestamp: "2026-11-01T00:00:00Z" }],
      new Map([["1", { views: 10, reach: 8, saved: 2, ig_reels_avg_watch_time: 4321 }]]),
    );
    expect(v).toMatchObject({ reach: 8, saves: 2, avgWatchSeconds: 4.3, watchSeconds: null });
  });
});
