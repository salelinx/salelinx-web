"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ADMIN_MODULES } from "@/lib/admin/modules";

// Admin console sidebar. Driven entirely by ADMIN_MODULES so a new section is
// "append to the registry" - no edit here. Uses plain next/link (admin is
// non-localized) and a hard-nav <a> back to the marketing site (separate <html>
// root, so a soft transition across the boundary isn't possible anyway).

type Props = {
  adminEmail: string;
};

export function AdminSidebar({ adminEmail }: Props) {
  const pathname = usePathname();

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-[var(--admin-border)] bg-[var(--admin-surface)]">
      <div className="flex h-12 items-center gap-2 border-b border-[var(--admin-border)] px-4">
        <span className="flex h-5 w-5 items-center justify-center rounded bg-zinc-900 text-[10px] font-bold text-white">
          S
        </span>
        <span className="text-sm font-semibold tracking-tight">
          SaleLinx Admin
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto p-2">
        <ul className="space-y-0.5">
          {ADMIN_MODULES.map((mod) => {
            const active =
              pathname === mod.href || pathname.startsWith(mod.href + "/");

            if (!mod.enabled) {
              return (
                <li key={mod.key}>
                  <span className="flex cursor-default items-center justify-between rounded-md px-3 py-1.5 text-sm text-zinc-400">
                    {mod.label}
                    <span className="text-[10px] uppercase tracking-wide text-zinc-300">
                      soon
                    </span>
                  </span>
                </li>
              );
            }

            return (
              <li key={mod.key}>
                <Link
                  href={mod.href}
                  className={
                    active
                      ? "flex items-center rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white"
                      : "flex items-center rounded-md px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100"
                  }
                >
                  {mod.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-[var(--admin-border)] p-3">
        {adminEmail && (
          <p
            className="mb-2 truncate font-mono text-xs text-zinc-500"
            title={adminEmail}
          >
            {adminEmail}
          </p>
        )}
        {/* next/link to a page outside this tree's <html> root: Next performs a
            full (MPA) navigation across the marketing <-> admin boundary. */}
        <Link
          href="/account"
          className="text-xs text-zinc-500 underline-offset-2 hover:text-zinc-900 hover:underline"
        >
          Back to site
        </Link>
      </div>
    </aside>
  );
}
