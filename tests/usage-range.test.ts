import { describe, expect, it } from "vitest";
import {
  HOUR_EPOCH,
  HOUR_KEY_RE,
  HOUR_RETENTION_DAYS,
  USAGE_EPOCH,
  hourKey,
  hourKeysForRange,
  periodKeysForRange,
} from "@/lib/admin/period";
import {
  HOUR_PRESETS,
  resolveUsageRange,
  usageRangeBounds,
} from "@/lib/admin/usage-range";

// The admin usage pages resolve their URL params into the exact list of
// period keys admin_list_usage is asked for. Day ranges must include every
// month bucket touched (monthly counters only exist there) while hour ranges
// must NEVER include a day or month bucket, or the same action is summed twice
// (the hour bucket nests inside them; see migration 016_usage_hour_buckets).

// Well inside the hourly retention window relative to HOUR_EPOCH.
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
  });

  it("resolves 'Last 24 hours' to exactly 24 hour keys ending now", () => {
    const sel = resolveUsageRange({ range: "24h" }, NOW);
    expect(sel.preset).toBe("24h");
    expect(sel.resolution).toBe("hour");
    expect(sel.period.capped).toBe(false);
    expect(sel.period.keys).toHaveLength(24);
    expect(sel.period.keys[0]).toBe("2026-09-19T16");
    expect(sel.period.keys[23]).toBe("2026-09-20T15");
    expect(sel.period.keys.every((k) => HOUR_KEY_RE.test(k))).toBe(true);
    expect(sel.period.note).toBeUndefined();
  });

  it("resolves 'Last hour' to just the current hour bucket", () => {
    const sel = resolveUsageRange({ range: "1h" }, NOW);
    expect(sel.preset).toBe("1h");
    expect(sel.resolution).toBe("hour");
    expect(sel.period.keys).toEqual(["2026-09-20T15"]);
    expect(sel.period.label).toBe("Last hour");
  });

  it("resolves every hour preset to N bucket-aligned hour keys ending now", () => {
    for (const [range, { hours }] of Object.entries(HOUR_PRESETS)) {
      const sel = resolveUsageRange({ range }, NOW);
      expect(sel.resolution, range).toBe("hour");
      expect(sel.period.keys, range).toHaveLength(hours);
      expect(sel.period.keys[hours - 1], range).toBe("2026-09-20T15");
      expect(sel.period.keys.every((k) => HOUR_KEY_RE.test(k)), range).toBe(
        true,
      );
    }
    expect(resolveUsageRange({ range: "72h" }, NOW).period.keys[0]).toBe(
      "2026-09-17T16",
    );
  });

  it("clamps a long hour preset to the epoch right after launch", () => {
    const justAfterLaunch = new Date("2026-09-09T10:00:00Z");
    const sel = resolveUsageRange({ range: "72h" }, justAfterLaunch);
    expect(sel.from).toBe(HOUR_EPOCH);
    expect(sel.period.keys).toHaveLength(35);
    expect(sel.period.note).toContain("Hourly buckets start at");
  });

  it("resolves hour-shaped from/to to hour keys only", () => {
    const sel = resolveUsageRange(
      { from: "2026-09-10T09", to: "2026-09-10T11" },
      NOW,
    );
    expect(sel.preset).toBe("custom");
    expect(sel.resolution).toBe("hour");
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
