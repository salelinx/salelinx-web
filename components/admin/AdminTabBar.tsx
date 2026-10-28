"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ADMIN_MODULES, isModuleActive } from "@/lib/admin/modules";
import { AdminNavFooter, AdminNavList } from "@/components/admin/AdminSidebar";

// Phone navigation (below md), in place of the sidebar, which would take most
// of a phone's width. The modules you reach for away from a desk sit on the
// bar within thumb reach; More opens a sheet with the full registry-driven
// list, so a new module still needs no edit here.

const TABS: { key: string; label: string; icon: React.ReactNode }[] = [
  {
    key: "overview",
    label: "Overview",
    icon: (
      <>
        <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
        <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
        <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
        <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
      </>
    ),
  },
  {
    key: "support",
    label: "Support",
    icon: (
      <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-8l-5 4v-4H6a2 2 0 0 1-2-2Z" />
    ),
  },
  {
    key: "users",
    label: "Users",
    icon: (
      <>
        <circle cx="9" cy="8" r="3.5" />
        <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
        <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8" />
        <path d="M18 14.2a6.5 6.5 0 0 1 3.5 5.8" />
      </>
    ),
  },
  {
    key: "finance",
    label: "Finance",
    icon: (
      <>
        <path d="M3 17l6-6 4 4 8-8" />
        <path d="M15 7h6v6" />
      </>
    ),
  },
];

const TAB_MODULES = TABS.map((tab) => {
  const mod = ADMIN_MODULES.find((m) => m.key === tab.key);
  if (!mod) throw new Error(`AdminTabBar: no admin module "${tab.key}"`);
  return { ...tab, mod };
});

export function AdminTabBar({ adminEmail }: { adminEmail: string }) {
  const pathname = usePathname();
  // The sheet remembers the page it was opened on rather than a boolean, so
  // any navigation (including the browser back button) closes it without an
  // effect having to watch the pathname.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const close = () => setOpenOn(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenOn(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const onTab = TAB_MODULES.some((t) => isModuleActive(t.mod, pathname));

  return (
    <>
      <nav
        aria-label="Admin sections"
        className="flex shrink-0 border-t border-[var(--admin-border)] bg-[var(--admin-surface)] md:hidden"
      >
        {TAB_MODULES.map((tab) => {
          const active = !open && isModuleActive(tab.mod, pathname);
          return (
            <Link
              key={tab.key}
              href={tab.mod.href}
              aria-current={active ? "page" : undefined}
              className={tabClass(active)}
            >
              <TabIcon>{tab.icon}</TabIcon>
              {tab.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setOpenOn(open ? null : pathname)}
          aria-expanded={open}
          aria-haspopup="dialog"
          className={tabClass(open || !onTab)}
        >
          <TabIcon>
            <path d="M4 7h16M4 12h16M4 17h16" />
          </TabIcon>
          More
        </button>
      </nav>

      {open && (
        <div
          className="fixed inset-0 z-30 md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="All admin sections"
        >
          <div
            className="absolute inset-0 bg-zinc-900/30"
            onClick={close}
            aria-hidden="true"
          />
          <div className="absolute inset-x-0 bottom-0 flex max-h-[85dvh] flex-col rounded-t-xl bg-[var(--admin-surface)] shadow-xl">
            <div className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--admin-border)] px-4">
              <span className="flex items-center gap-2 text-sm font-semibold tracking-tight">
                <span className="flex h-5 w-5 items-center justify-center rounded bg-zinc-900 text-[10px] font-bold text-white">
                  S
                </span>
                SaleLinx Admin
              </span>
              <button
                type="button"
                onClick={close}
                className="-mr-2 rounded p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                aria-label="Close menu"
              >
                x
              </button>
            </div>
            <nav className="min-h-0 flex-1 overflow-y-auto p-2">
              <AdminNavList touch onNavigate={close} />
            </nav>
            <AdminNavFooter adminEmail={adminEmail} />
          </div>
        </div>
      )}
    </>
  );
}

function tabClass(active: boolean): string {
  return (
    "flex flex-1 flex-col items-center gap-0.5 pt-2 pb-1.5 text-[11px] " +
    (active ? "font-medium text-zinc-900" : "text-zinc-500")
  );
}

function TabIcon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}
