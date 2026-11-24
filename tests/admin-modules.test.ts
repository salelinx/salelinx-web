import { describe, expect, it } from "vitest";
import { ADMIN_MODULES, isModuleActive } from "../lib/admin/modules";

const stats = ADMIN_MODULES.find((m) => m.key === "stats")!;
const child = (key: string) => stats.children!.find((c) => c.key === key)!;

describe("admin sidebar registry", () => {
  it("lights the Stats dropdown on any of its pages, and only the page that is open", () => {
    for (const path of ["/admin/marketing", "/admin/marketing/videos/tiktok/123", "/admin/marketing/insights/compare"])
      expect(isModuleActive(stats, path)).toBe(true);
    expect(isModuleActive(stats, "/admin/marketing/planner")).toBe(false);

    expect(isModuleActive(child("marketing"), "/admin/marketing/videos/tiktok/123")).toBe(true);
    expect(isModuleActive(child("marketing"), "/admin/marketing/insights")).toBe(false);
    expect(isModuleActive(child("insights"), "/admin/marketing/insights")).toBe(true);
    expect(isModuleActive(child("insights"), "/admin/marketing/insights/posts")).toBe(false);
    expect(isModuleActive(child("insights-posts"), "/admin/marketing/insights/posts")).toBe(true);
  });

  it("lights the Finance dropdown on both pages, and only the page that is open", () => {
    const finance = ADMIN_MODULES.find((m) => m.key === "finance")!;
    const page = (key: string) => finance.children!.find((c) => c.key === key)!;
    expect(isModuleActive(finance, "/admin/finance")).toBe(true);
    expect(isModuleActive(finance, "/admin/finance/cancellations")).toBe(true);
    expect(isModuleActive(finance, "/admin/users")).toBe(false);
    expect(isModuleActive(page("finance-overview"), "/admin/finance")).toBe(true);
    expect(isModuleActive(page("finance-overview"), "/admin/finance/cancellations")).toBe(false);
    expect(isModuleActive(page("finance-cancellations"), "/admin/finance/cancellations")).toBe(true);
  });

  it("keeps keys unique across top-level entries and dropdown pages", () => {
    const keys = ADMIN_MODULES.flatMap((m) => [m.key, ...(m.children ?? []).map((c) => c.key)]);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
