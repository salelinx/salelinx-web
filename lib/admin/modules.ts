// Admin console module registry. The sidebar renders this list; adding a new
// admin section is "append an entry here + add app/admin/<key>/page.tsx".
//
// Modules marked `enabled: false` render in the sidebar as disabled
// placeholders so the planned shape of the console is visible while the
// section is still being built. All registered modules are live: Support,
// Users, Finance (a dropdown of Overview and Cancellations), Search,
// Configuration (a dropdown of tier limits, feature flags, roadmap and
// extension announcements), the Social group
// (Stats as a dropdown of Overview, Totals, Posts, Compare, Timing,
// Engagement, Growth and Lifecycle; Planner; Experiments), the Analytics group
// (Dashboard, Funnel, Feature adoption, Extension usage, Web usage, Endpoint
// health, Storage), Audit log.

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
  // A dropdown: the entry opens and closes a nested list of these pages
  // rather than linking anywhere itself (its href is only the fallback), and
  // reads as active whenever one of them is. Children take no section.
  children?: AdminModule[];
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
  // A dropdown, read from Stripe. Overview: revenue, MRR and customer counts
  // (admin-finance-stats). Cancellations: why people leave, with the uninstall
  // survey (admin-cancellation-stats). The key stays "finance" because the
  // phone tab bar (AdminTabBar) looks it up.
  {
    key: "finance",
    label: "Finance",
    href: "/admin/finance",
    enabled: true,
    children: [
      {
        key: "finance-overview",
        label: "Overview",
        href: "/admin/finance",
        enabled: true,
        exact: true,
      },
      {
        key: "finance-cancellations",
        label: "Cancellations",
        href: "/admin/finance/cancellations",
        enabled: true,
      },
    ],
  },
  // Clicks and impressions per sitemap page, from Google Search Console.
  { key: "search", label: "Search", href: "/admin/search", enabled: true },
  // Tier limits, feature flags, the public roadmap and the extension
  // announcements. A dropdown here, and tabs across the top of each of its
  // pages too (app/admin/(configuration)/layout.tsx), so either way in works.
  {
    key: "configuration",
    label: "Configuration",
    href: "/admin/tiers",
    enabled: true,
    children: [
      { key: "tiers", label: "Tier limits", href: "/admin/tiers", enabled: true },
      { key: "flags", label: "Feature flags", href: "/admin/flags", enabled: true },
      { key: "roadmap", label: "Roadmap", href: "/admin/roadmap", enabled: true },
      { key: "announcements", label: "Announcements", href: "/admin/announcements", enabled: true },
    ],
  },

  // Social: our own YouTube, Instagram, TikTok and Facebook (docs/SOCIAL.md).
  // Stats is a dropdown: Overview is each post against our typical one (plus
  // each video's detail page), and the pages under it are the deeper read of
  // the same snapshots, one per question. Planner schedules posts that
  // marketing-publish sends; Experiments tests each tag's top two options.
  {
    key: "stats",
    label: "Stats",
    href: "/admin/marketing",
    enabled: true,
    section: "Social",
    children: [
      {
        key: "marketing",
        label: "Overview",
        href: "/admin/marketing",
        also: ["/admin/marketing/videos"],
        enabled: true,
        exact: true,
      },
      // `exact` so Totals doesn't light up on the pages under its path.
      { key: "insights", label: "Totals", href: "/admin/marketing/insights", enabled: true, exact: true },
      { key: "insights-posts", label: "Posts", href: "/admin/marketing/insights/posts", enabled: true },
      { key: "insights-compare", label: "Compare", href: "/admin/marketing/insights/compare", enabled: true },
      { key: "insights-timing", label: "Timing", href: "/admin/marketing/insights/timing", enabled: true },
      { key: "insights-engagement", label: "Engagement", href: "/admin/marketing/insights/engagement", enabled: true },
      { key: "insights-growth", label: "Growth", href: "/admin/marketing/insights/growth", enabled: true },
      { key: "insights-lifecycle", label: "Lifecycle", href: "/admin/marketing/insights/lifecycle", enabled: true },
      { key: "stats-original", label: "Original", href: "/admin/marketing/original", enabled: true },
    ],
  },
  {
    key: "social-planner",
    label: "Planner",
    href: "/admin/marketing/planner",
    enabled: true,
    section: "Social",
  },
  {
    key: "social-experiments",
    label: "Experiments",
    href: "/admin/marketing/experiments",
    enabled: true,
    section: "Social",
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
  // Signup to paying, by source, device and month (migration 065).
  {
    key: "funnel",
    label: "Funnel",
    href: "/admin/analytics/funnel",
    enabled: true,
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
  if (mod.children) return mod.children.some((c) => isModuleActive(c, pathname));
  const under = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");
  // `exact` holds for the module's own href; its `also` paths still match
  // everything under them (Stats' Overview lights up on a video's detail page
  // but not on the Planner beside it).
  if (mod.exact) return pathname === mod.href || (mod.also ?? []).some(under);
  return (mod.also ?? [mod.href]).concat(mod.href).some(under);
}
