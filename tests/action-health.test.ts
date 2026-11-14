import { describe, expect, it } from "vitest";

import { rollUpActions, type ActionHealthRaw } from "@/lib/admin/action-health";

const row = (
  version: string,
  ok: number,
  failed: number,
  empty = 0,
): ActionHealthRaw => ({
  action: "sendEbayMessage",
  platform: "ebay",
  extension_version: version,
  ok,
  failed,
  empty,
  top_code: failed ? "reauth" : null,
  last_seen: "2026-11-14T00:00:00Z",
});

describe("rollUpActions", () => {
  it("flags the newest version when it fails far more than the one before", () => {
    const [r] = rollUpActions([row("1.9.0", 99, 1), row("1.10.0", 30, 20)]);
    expect(r.version).toBe("1.10.0");
    expect(r.prevVersion).toBe("1.9.0");
    expect(r.failedRate).toBe(40);
    expect(r.regressed).toBe(true);
  });

  it("does not flag a version with too few uses or no baseline", () => {
    expect(
      rollUpActions([row("1.9.0", 99, 1), row("1.10.0", 1, 2)])[0].regressed,
    ).toBe(false);
    expect(rollUpActions([row("1.10.0", 0, 50)])[0].regressed).toBe(false);
  });
});
