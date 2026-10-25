"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin/tiers", label: "Tier limits" },
  { href: "/admin/flags", label: "Feature flags" },
  { href: "/admin/roadmap", label: "Roadmap" },
];

export function ConfigurationTabs() {
  const pathname = usePathname();
  return (
    <nav className="flex h-10 shrink-0 items-end gap-1 border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-4">
      {TABS.map((tab) => {
        const active =
          pathname === tab.href || pathname.startsWith(tab.href + "/");
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`-mb-px border-b-2 px-3 pb-2 text-sm ${
              active
                ? "border-zinc-900 font-semibold text-zinc-900"
                : "border-transparent text-zinc-500 hover:text-zinc-900"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
