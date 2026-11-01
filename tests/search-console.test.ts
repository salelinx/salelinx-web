import { describe, expect, it } from "vitest";
import { mergeWithSitemap } from "@/lib/admin/search-console";

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
