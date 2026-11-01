import { describe, expect, it } from "vitest";
import { aggregateQueries, mergeWithSitemap } from "@/lib/admin/search-console";

const row = (url: string, clicks: number, impressions: number) => ({
  keys: [url],
  clicks,
  impressions,
  ctr: impressions ? clicks / impressions : 0,
  position: 4.2,
});

describe("mergeWithSitemap", () => {
  it("keeps sitemap pages Google has not shown, at zero", () => {
    const out = mergeWithSitemap(["https://salelinx.com/blog/a"], []);
    expect(out).toEqual([
      {
        url: "https://salelinx.com/blog/a",
        clicks: 0,
        impressions: 0,
        ctr: 0,
        position: null,
        inSitemap: true,
      },
    ]);
  });

  it("matches Google rows to sitemap URLs regardless of a trailing slash", () => {
    const out = mergeWithSitemap(
      ["https://salelinx.com"],
      [row("https://salelinx.com/", 3, 30)],
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      url: "https://salelinx.com",
      clicks: 3,
      inSitemap: true,
    });
  });

  it("flags pages Google reports that the sitemap lacks, and sorts by clicks", () => {
    const out = mergeWithSitemap(
      ["https://salelinx.com/pricing"],
      [
        row("https://salelinx.com/old", 1, 5),
        row("https://salelinx.com/pricing", 9, 50),
      ],
    );
    expect(out.map((r) => [r.url, r.inSitemap])).toEqual([
      ["https://salelinx.com/pricing", true],
      ["https://salelinx.com/old", false],
    ]);
  });
});

describe("aggregateQueries", () => {
  const r = (
    keys: string[],
    clicks: number,
    impressions: number,
    position = 3,
  ) => ({
    keys,
    clicks,
    impressions,
    ctr: impressions ? clicks / impressions : 0,
    position,
  });

  it("keeps Google's per-search totals and picks the page with most clicks", () => {
    const out = aggregateQueries(
      [r(["vinted relist"], 2, 40, 8.5)],
      [
        r(["vinted relist", "https://salelinx.com/blog/a"], 0, 30),
        r(["vinted relist", "https://salelinx.com/docs/b"], 2, 10),
      ],
    );
    expect(out).toEqual([
      {
        query: "vinted relist",
        topPage: "https://salelinx.com/docs/b",
        clicks: 2,
        impressions: 40,
        ctr: 0.05,
        position: 8.5,
        brand: false,
      },
    ]);
  });

  it("flags searches for the brand, however it is spelled", () => {
    const out = aggregateQueries(
      [
        r(["salelinx"], 1, 1),
        r(["sale linx app"], 0, 1),
        r(["depop fees"], 0, 1),
      ],
      [],
    );
    expect(out.map((q) => q.brand)).toEqual([true, true, false]);
  });
});
