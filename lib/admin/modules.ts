// Admin console module registry. The sidebar renders this list; adding a new
// admin section is "append an entry here + add app/admin/<key>/page.tsx".
//
// Modules marked `enabled: false` render in the sidebar as disabled
// placeholders so the planned shape of the console is visible while the
// section is still being built. Support is the first live module.

export type AdminModule = {
  key: string;
  label: string;
  // Absolute, non-localized path under the top-level /admin tree.
  href: string;
  enabled: boolean;
};

export const ADMIN_MODULES: AdminModule[] = [
  { key: "support", label: "Support", href: "/admin/support", enabled: true },
  { key: "users", label: "Users", href: "/admin/users", enabled: false },
  {
    key: "subscriptions",
    label: "Subscriptions",
    href: "/admin/subscriptions",
    enabled: false,
  },
  { key: "tiers", label: "Tier limits", href: "/admin/tiers", enabled: false },
  {
    key: "flags",
    label: "Feature flags",
    href: "/admin/flags",
    enabled: false,
  },
  { key: "usage", label: "Usage", href: "/admin/usage", enabled: false },
  { key: "storage", label: "Storage", href: "/admin/storage", enabled: false },
  { key: "audit", label: "Audit log", href: "/admin/audit", enabled: false },
];
