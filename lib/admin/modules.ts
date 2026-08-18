// Admin console module registry. The sidebar renders this list; adding a new
// admin section is "append an entry here + add app/admin/<key>/page.tsx".
//
// Modules marked `enabled: false` render in the sidebar as disabled
// placeholders so the planned shape of the console is visible while the
// section is still being built. All registered modules are live: Support,
// Users, Subscriptions, Tier limits, Feature flags, Usage, Storage, Audit log.

export type AdminModule = {
  key: string;
  label: string;
  // Absolute, non-localized path under the top-level /admin tree.
  href: string;
  enabled: boolean;
  // When true, the sidebar marks this active only on an EXACT pathname match
  // (used by Overview at /admin so it does not light up on every /admin/*).
  exact?: boolean;
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
  {
    key: "subscriptions",
    label: "Subscriptions",
    href: "/admin/subscriptions",
    enabled: true,
  },
  { key: "tiers", label: "Tier limits", href: "/admin/tiers", enabled: true },
  {
    key: "flags",
    label: "Feature flags",
    href: "/admin/flags",
    enabled: true,
  },
  // Two usage modules: extension product metering (capped by tier_limits) and
  // web abuse rate limits (capped by constants in the Edge Functions). They
  // read the same usage_counters table but answer different questions, so they
  // are separate pages. See lib/admin/usage-sources.ts.
  {
    key: "usage",
    label: "Extension usage",
    href: "/admin/usage",
    enabled: true,
    exact: true,
  },
  {
    key: "usage-web",
    label: "Web usage",
    href: "/admin/usage/web",
    enabled: true,
  },
  { key: "storage", label: "Storage", href: "/admin/storage", enabled: true },
  { key: "audit", label: "Audit log", href: "/admin/audit", enabled: true },
];
