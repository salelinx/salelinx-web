import { describe, expect, it } from "vitest";
import {
  EVENTS_EPOCH,
  EVENTS_RETENTION_DAYS,
  HOUR_EPOCH,
  HOUR_KEY_RE,
  HOUR_RETENTION_DAYS,
  USAGE_EPOCH,
  hourKey,
  hourKeysForRange,
  periodKeysForRange,
} from "@/lib/admin/period";
import {
  WINDOW_PRESETS,
  resolveUsageRange,
  usageRangeBounds,
} from "@/lib/admin/usage-range";

// The admin usage pages resolve their URL params into either the exact list
// of period keys admin_list_usage is asked for, or a trailing window for
// admin_list_usage_events. Day ranges must include every month bucket touched
// (monthly counters only exist there) while hour ranges must NEVER include a
// day or month bucket, or the same action is summed twice (the hour bucket
// nests inside them; see migration 016_usage_hour_buckets). Window presets
// must carry no keys at all: they are answered from events.

// Well inside both retention windows relative to the epochs.
const NOW = new Date("2026-09-20T15:42:10Z");

describe("hour keys", () => {
  it("formats the UTC hour as YYYY-MM-DDTHH", () => {
    expect(hourKey(new Date("2026-09-08T14:59:59Z"))).toBe("2026-09-08T14");
    expect(hourKey(new Date("2026-01-05T03:00:00Z"))).toBe("2026-01-05T03");
    expect(HOUR_KEY_RE.test("2026-09-08T14")).toBe(true);
    expect(HOUR_KEY_RE.test("2026-09-08")).toBe(false);
    expect(HOUR_KEY_RE.test("2026-09-08T14:00")).toBe(false);
  });

  it("enumerates every hour between two keys, inclusive, across midnight", () => {
    expect(hourKeysForRange("2026-09-08T22", "2026-09-09T01")).toEqual([
      "2026-09-08T22",
      "2026-09-08T23",
      "2026-09-09T00",
      "2026-09-09T01",
    ]);
  });

  it("returns nothing for malformed keys", () => {
    expect(hourKeysForRange("2026-09-08", "2026-09-09T01")).toEqual([]);
    expect(hourKeysForRange("2026-13-40T99", "2026-09-09T01")).toEqual([]);
  });
});

describe("periodKeysForRange", () => {
  it("emits every month touched plus one key per day", () => {
    expect(periodKeysForRange("2026-08-30", "2026-09-02")).toEqual([
      "2026-08",
      "2026-09",
      "2026-08-30",
      "2026-08-31",
      "2026-09-01",
      "2026-09-02",
    ]);
  });
});

describe("resolveUsageRange", () => {
  it("defaults to the capped current period", () => {
    const sel = resolveUsageRange({}, NOW);
    expect(sel.preset).toBe("current");
    expect(sel.resolution).toBe("day");
    expect(sel.period.capped).toBe(true);
    expect(sel.period.keys).toEqual(["2026-09", "2026-09-20"]);
    expect(sel.period.window).toBeUndefined();
  });

  it("resolves 'Last 15 minutes' to an exact event window ending now", () => {
    const sel = resolveUsageRange({ range: "15m" }, NOW);
    expect(sel.preset).toBe("15m");
    expect(sel.resolution).toBe("window");
    expect(sel.period.capped).toBe(false);
    expect(sel.period.keys).toEqual([]);
    expect(sel.period.window).toEqual({
      since: "2026-09-20T15:27:10.000Z",
      until: "2026-09-20T15:42:10.000Z",
    });
    expect(sel.period.label).toBe("Last 15 minutes (since 15:27 UTC)");
    expect(sel.period.note).toBeUndefined();
  });

  it("resolves every window preset to its exact length, keys empty", () => {
    for (const [range, { minutes }] of Object.entries(WINDOW_PRESETS)) {
      const sel = resolveUsageRange({ range }, NOW);
      expect(sel.resolution, range).toBe("window");
      expect(sel.period.keys, range).toEqual([]);
      const w = sel.period.window!;
      expect(Date.parse(w.until) - Date.parse(w.since), range).toBe(
        minutes * 60_000,
      );
      expect(w.until, range).toBe(NOW.toISOString());
    }
  });

  it("clamps a long window to the events epoch right after launch and says so", () => {
    const justAfterLaunch = new Date("2026-09-08T10:00:00Z");
    const sel = resolveUsageRange({ range: "72h" }, justAfterLaunch);
    expect(sel.period.window?.since).toBe(EVENTS_EPOCH);
    expect(sel.period.note).toContain("Usage events start at");
  });

  it("clamps a window to the event retention once past the epoch", () => {
    const later = new Date("2027-03-01T12:00:00Z");
    const bounds = usageRangeBounds(later);
    expect(bounds.eventsMin).toBe(
      new Date(
        later.getTime() - EVENTS_RETENTION_DAYS * 86_400_000,
      ).toISOString(),
    );
    // 72 hours is inside 7 days, so no clamp for any preset once mature.
    const sel = resolveUsageRange({ range: "72h" }, later);
    expect(sel.period.note).toBeUndefined();
  });

  it("resolves hour-shaped from/to to hour keys only", () => {
    const sel = resolveUsageRange(
      { from: "2026-09-10T09", to: "2026-09-10T11" },
      NOW,
    );
    expect(sel.preset).toBe("custom");
    expect(sel.resolution).toBe("hour");
    expect(sel.period.window).toBeUndefined();
    expect(sel.period.keys).toEqual([
      "2026-09-10T09",
      "2026-09-10T10",
      "2026-09-10T11",
    ]);
    expect(sel.period.label).toBe(
      "2026-09-10 09:00 to 2026-09-10 11:00 UTC (hourly)",
    );
  });

  it("swaps reversed hour bounds", () => {
    const sel = resolveUsageRange(
      { from: "2026-09-10T11", to: "2026-09-10T09" },
      NOW,
    );
    expect(sel.from).toBe("2026-09-10T09");
    expect(sel.to).toBe("2026-09-10T11");
  });

  it("clamps an hour range to the future to the current hour", () => {
    const sel = resolveUsageRange(
      { from: "2026-09-20T14", to: "2026-09-25T00" },
      NOW,
    );
    expect(sel.to).toBe("2026-09-20T15");
    expect(sel.period.keys).toEqual(["2026-09-20T14", "2026-09-20T15"]);
  });

  it("clamps an hour range that starts before HOUR_EPOCH and says so", () => {
    const sel = resolveUsageRange(
      { from: "2026-09-01T00", to: "2026-09-08T02" },
      NOW,
    );
    expect(sel.from).toBe(HOUR_EPOCH);
    expect(sel.period.keys).toEqual([
      "2026-09-08T00",
      "2026-09-08T01",
      "2026-09-08T02",
    ]);
    expect(sel.period.note).toContain("Hourly buckets start at");
  });

  it("clamps an hour range to the retention window once it is past the epoch", () => {
    const later = new Date("2027-03-01T12:00:00Z");
    const bounds = usageRangeBounds(later);
    expect(bounds.hourMin).toBe(
      hourKey(new Date(later.getTime() - HOUR_RETENTION_DAYS * 86_400_000)),
    );
    const sel = resolveUsageRange(
      { from: "2026-12-01T00", to: "2027-03-01T12" },
      later,
    );
    expect(sel.from).toBe(bounds.hourMin);
    expect(sel.period.note).toContain(`kept for ${HOUR_RETENTION_DAYS} days`);
  });

  it("keeps day-shaped from/to at day resolution with month keys", () => {
    const sel = resolveUsageRange(
      { from: "2026-08-31", to: "2026-09-01" },
      NOW,
    );
    expect(sel.resolution).toBe("day");
    expect(sel.period.keys).toEqual([
      "2026-08",
      "2026-09",
      "2026-08-31",
      "2026-09-01",
    ]);
  });

  it("falls back to the current period when from/to mix shapes", () => {
    const sel = resolveUsageRange(
      { from: "2026-09-10", to: "2026-09-10T11" },
      NOW,
    );
    expect(sel.preset).toBe("current");
  });

  it("clamps day ranges to the usage epoch and today", () => {
    const sel = resolveUsageRange(
      { from: "2025-01-01", to: "2030-01-01" },
      NOW,
    );
    expect(sel.from).toBe(USAGE_EPOCH);
    expect(sel.to).toBe("2026-09-20");
  });
});
