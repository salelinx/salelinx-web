import { describe, expect, it } from "vitest";
import {
  buildMarketingReport,
  daysBefore,
  engagementRate,
} from "../lib/admin/marketing";
import {
  num,
  parseInstagramInsights,
  parseTikTokVideos,
  parseYouTubeVideos,
} from "../supabase/functions/marketing-sync/parse";

const video = (id: string, published: string) => ({
  platform: "youtube" as const,
  external_id: id,
  title: id,
  url: null,
  thumbnail_url: null,
  published_at: published,
});
const snap = (id: string, day: string, views: number) => ({
  platform: "youtube" as const,
  external_id: id,
  day,
  views,
  likes: null,
  comments: null,
  shares: null,
});

describe("marketing report", () => {
  it("measures a day's gain against yesterday's snapshot", () => {
    const report = buildMarketingReport({
      today: "2026-10-26",
      videos: [video("a", "2026-09-01T00:00:00Z"), video("b", "2026-09-01T00:00:00Z")],
      stats: [snap("a", "2026-10-25", 100), snap("a", "2026-10-26", 130), snap("b", "2026-10-26", 50)],
      followers: [],
    });
    expect(report.videos.map((v) => v.gained1)).toEqual([30, null]);
  });

  it("ranks engagement only from 100 views", () => {
    expect(engagementRate({ views: 99, likes: 50, comments: 0, shares: 0 })).toBeNull();
    expect(engagementRate({ views: 200, likes: 10, comments: 4, shares: null })).toBe(0.07);
  });

  it("counts days back across a month", () => {
    expect(daysBefore("2026-11-02", 3)).toBe("2026-10-30");
  });

  it("measures views gained against the snapshot from before the window", () => {
    const report = buildMarketingReport({
      today: "2026-10-25",
      videos: [video("a", "2026-09-01T00:00:00Z")],
      stats: [
        snap("a", "2026-10-17", 100),
        snap("a", "2026-10-18", 120),
        snap("a", "2026-10-25", 200),
      ],
      followers: [],
    });
    expect(report.videos[0].gained7).toBe(80);
    expect(report.platforms[0]).toMatchObject({
      gained7: 80,
      views: 200,
      partial7: false,
    });
  });

  it("gives no gain for an old video tracked too recently, but all views for a new one", () => {
    const report = buildMarketingReport({
      today: "2026-10-25",
      videos: [
        video("old", "2026-01-01T00:00:00Z"),
        video("new", "2026-10-23T00:00:00Z"),
      ],
      stats: [snap("old", "2026-10-25", 5000), snap("new", "2026-10-25", 40)],
      followers: [],
    });
    expect(report.videos.map((v) => v.gained7)).toEqual([null, 40]);
    expect(report.platforms[0]).toMatchObject({ gained7: 40, partial7: true });
  });

  it("charts each day's gain only where the day before was snapshotted", () => {
    const report = buildMarketingReport({
      today: "2026-10-25",
      days: 3,
      videos: [video("a", "2026-09-01T00:00:00Z")],
      stats: [snap("a", "2026-10-23", 10), snap("a", "2026-10-25", 30)],
      followers: [],
    });
    expect(report.daily).toEqual([
      { day: "2026-10-23", views: 0 },
      { day: "2026-10-24", views: 0 },
      { day: "2026-10-25", views: 0 },
    ]);
  });

  it("reports follower growth over 30 days", () => {
    const report = buildMarketingReport({
      today: "2026-10-25",
      videos: [],
      stats: [],
      followers: [
        { platform: "tiktok", day: "2026-09-20", followers: 100 },
        { platform: "tiktok", day: "2026-10-25", followers: 160 },
      ],
    });
    expect(report.platforms.find((p) => p.platform === "tiktok")).toMatchObject(
      {
        followers: 160,
        followersGained30: 60,
      },
    );
  });
});

describe("platform parsing", () => {
  it("reads counts sent as strings and leaves hidden ones empty", () => {
    expect(num("42")).toBe(42);
    expect(num(undefined)).toBeNull();
  });

  it("parses YouTube videos", () => {
    const [v] = parseYouTubeVideos([
      {
        id: "abc",
        snippet: { title: "Hi", publishedAt: "2026-10-01T00:00:00Z" },
        statistics: { viewCount: "10", likeCount: "2" },
      },
    ]);
    expect(v).toMatchObject({
      externalId: "abc",
      views: 10,
      likes: 2,
      comments: null,
      url: "https://www.youtube.com/watch?v=abc",
    });
  });

  it("reads Instagram insights in either shape", () => {
    expect(
      parseInstagramInsights({
        data: [
          { name: "views", values: [{ value: 300 }] },
          { name: "shares", total_value: { value: 4 } },
        ],
      }),
    ).toEqual({ views: 300, shares: 4 });
  });

  it("parses TikTok videos, titled from the description when untitled", () => {
    const [v] = parseTikTokVideos([
      {
        id: 7,
        title: "",
        video_description: "first line\nsecond",
        create_time: 1761350400,
        view_count: 900,
      },
    ]);
    expect(v).toMatchObject({
      externalId: "7",
      title: "first line",
      views: 900,
      publishedAt: "2025-10-25T00:00:00.000Z",
    });
  });
});
