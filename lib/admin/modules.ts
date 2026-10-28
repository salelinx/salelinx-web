// Admin console module registry. The sidebar renders this list; adding a new
// admin section is "append an entry here + add app/admin/<key>/page.tsx".
//
// Modules marked `enabled: false` render in the sidebar as disabled
// placeholders so the planned shape of the console is visible while the
// section is still being built. All registered modules are live: Support,
// Users, Finance, Marketing, Configuration (tier limits, feature flags, roadmap), the Analytics group
// (Feature adoption, Extension usage, Web usage, Endpoint health, Storage),
// Audit log.

export type AdminModule = {
  key: string;
  label: string;
  // Absolute, non-localized path under the top-level /admin tree.
  href: string;
  enabled: boolean;
  // When true, the sidebar marks this active only on an EXACT pathname match
  // (used by Overview at /admin so it does not light up on every /admin/*).
  exact?: boolean;
  // Other paths that light this entry up: one entry standing for several pages.
  also?: string[];
  // Optional sidebar group. Consecutive modules sharing a section render
  // under one heading; modules without one sit at the top level. Keep the
  // members of a section adjacent in this list, since grouping is by run.
  section?: string;
};

export const ADMIN_MODULES: AdminModule[] = [
  // Overview is the dashboard home at /admin itself. `exact` so it only
  // highlights on /admin, not on every /admin/* sub-route.
  {
    key: "overview",
    label: "Overview",
    href: "/admin",
    enabled: true,
    exact: true,
  },
  { key: "support", label: "Support", href: "/admin/support", enabled: true },
  { key: "users", label: "Users", href: "/admin/users", enabled: true },
  // Revenue, MRR and customer counts, read from Stripe (admin-finance-stats).
  { key: "finance", label: "Finance", href: "/admin/finance", enabled: true },
  // Views and followers on our YouTube, Instagram and TikTok (marketing-sync).
  { key: "marketing", label: "Marketing", href: "/admin/marketing", enabled: true },
  // Tier limits, feature flags and the public roadmap, as tabs of one page
  // (app/admin/(configuration)/layout.tsx).
  {
    key: "configuration",
    label: "Configuration",
    href: "/admin/tiers",
    also: ["/admin/flags", "/admin/roadmap"],
    enabled: true,
  },

  // Analytics: the read-only "what is the extension doing" views. A landing
  // dashboard of one-glance boxes, then three cuts of usage_counters (per
  // feature, per user, web abuse limits; see lib/admin/usage-sources.ts and
  // lib/admin/adoption.ts), plus endpoint health (whether it worked) and
  // per-user cloud storage.
  {
    key: "analytics",
    label: "Dashboard",
    href: "/admin/analytics",
    enabled: true,
    exact: true,
    section: "Analytics",
  },
  {
    key: "usage-features",
    label: "Feature adoption",
    href: "/admin/usage/features",
    enabled: true,
    section: "Analytics",
  },
  {
    key: "usage",
    label: "Extension usage",
    href: "/admin/usage",
    enabled: true,
    exact: true,
    section: "Analytics",
  },
  {
    key: "usage-web",
    label: "Web usage",
    href: "/admin/usage/web",
    enabled: true,
    section: "Analytics",
  },
  {
    key: "health",
    label: "Endpoint health",
    href: "/admin/health",
    enabled: true,
    section: "Analytics",
  },
  {
    key: "storage",
    label: "Storage",
    href: "/admin/storage",
    enabled: true,
    section: "Analytics",
  },

  { key: "audit", label: "Audit log", href: "/admin/audit", enabled: true },
];

// Whether a module's nav entry should read as the current page. Shared by the
// desktop sidebar and the phone tab bar so the two never disagree.
export function isModuleActive(mod: AdminModule, pathname: string): boolean {
  if (mod.exact) return pathname === mod.href;
  const under = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");
  return (mod.also ?? [mod.href]).concat(mod.href).some(under);
}
