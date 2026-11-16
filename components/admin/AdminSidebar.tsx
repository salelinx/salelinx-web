"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ADMIN_MODULES,
  isModuleActive,
  type AdminModule,
} from "@/lib/admin/modules";
import { AdminThemeToggle } from "@/components/admin/AdminThemeToggle";
import {
  NeedsReplyTriangle,
  useNeedsReply,
} from "@/components/admin/NeedsReplyProvider";

// Admin console sidebar. Driven entirely by ADMIN_MODULES so a new section is
// "append to the registry" - no edit here. Uses plain next/link (admin is
// non-localized) and a hard-nav <a> back to the marketing site (separate <html>
// root, so a soft transition across the boundary isn't possible anyway).
//
// Desktop only (md and up). Phones get AdminTabBar instead, whose More sheet
// renders the same AdminNavList below.

type Props = {
  adminEmail: string;
};

export function AdminSidebar({ adminEmail }: Props) {
  return (
    <aside className="hidden w-44 shrink-0 flex-col border-r border-[var(--admin-border)] bg-[var(--admin-surface)] md:flex">
      <div className="flex h-12 items-center border-b border-[var(--admin-border)] px-3">
        {/* Logo + title link back to the dashboard home (/admin). */}
        <Link
          href="/admin"
          className="flex items-center gap-2 rounded-md hover:opacity-80"
        >
          <span className="flex h-5 w-5 items-center justify-center rounded bg-zinc-900 text-[10px] font-bold text-white">
            S
          </span>
          <span className="text-sm font-semibold tracking-tight">
            SaleLinx Admin
          </span>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto p-2">
        <AdminNavList />
      </nav>

      <AdminNavFooter adminEmail={adminEmail} />
    </aside>
  );
}

// One link row, for a module or a page inside a dropdown.
function NavLink({
  mod,
  active,
  row,
  onNavigate,
  badge,
}: {
  mod: AdminModule;
  active: boolean;
  row: string;
  onNavigate?: () => void;
  badge?: React.ReactNode;
}) {
  return (
    <Link
      href={mod.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={
        active
          ? `flex items-center rounded-md bg-zinc-900 font-medium text-white ${row}`
          : `flex items-center rounded-md text-zinc-700 hover:bg-zinc-100 ${row}`
      }
    >
      {mod.label}
      {badge}
    </Link>
  );
}

// The module list itself. `touch` gives each row a finger-sized target for the
// phone sheet; `onNavigate` lets that sheet close itself on a tap, including a
// tap on the page already open (which changes no pathname).
//
// A module with `children` is a dropdown: it opens on its own when one of its
// pages is the current one, and a click opens or closes it. That choice lasts
// while the console stays loaded (the sidebar lives in the layout), not across
// a reload.
export function AdminNavList({
  touch = false,
  onNavigate,
}: {
  touch?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { count: needsReply } = useNeedsReply();
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const row = touch ? "px-3 py-2.5 text-[15px]" : "px-3 py-1.5 text-sm";
  const childRow = touch ? "px-3 py-2 text-[15px]" : "px-2.5 py-1 text-[13px]";

  return (
    <ul className="space-y-0.5">
      {ADMIN_MODULES.map((mod, i) => {
        const active = isModuleActive(mod, pathname);

        // A section heading opens each run of grouped modules, and the
        // first top-level module after a group gets a little air so the
        // group reads as a block rather than bleeding into what follows.
        const prev = i > 0 ? ADMIN_MODULES[i - 1].section : undefined;
        const opensSection = mod.section !== undefined && mod.section !== prev;
        const closesSection = mod.section === undefined && prev !== undefined;
        const heading = opensSection ? (
          <p className="mt-4 mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            {mod.section}
          </p>
        ) : null;
        const gapClass = closesSection ? "mt-4" : "";

        if (!mod.enabled) {
          return (
            <li key={mod.key} className={gapClass}>
              {heading}
              <span
                className={`flex cursor-default items-center justify-between rounded-md text-zinc-400 ${row}`}
              >
                {mod.label}
                <span className="text-[10px] uppercase tracking-wide text-zinc-300">
                  soon
                </span>
              </span>
            </li>
          );
        }

        if (mod.children) {
          const open = toggled[mod.key] ?? active;
          const listId = `admin-nav-${mod.key}`;
          return (
            <li key={mod.key} className={gapClass}>
              {heading}
              <button
                type="button"
                aria-expanded={open}
                aria-controls={listId}
                onClick={() => setToggled({ ...toggled, [mod.key]: !open })}
                className={`flex w-full items-center rounded-md hover:bg-zinc-100 ${
                  active ? "font-medium text-zinc-900" : "text-zinc-700"
                } ${row}`}
              >
                {mod.label}
                <svg
                  viewBox="0 0 16 16"
                  aria-hidden
                  className={`ml-auto h-3.5 w-3.5 shrink-0 text-zinc-400 transition-transform ${
                    open ? "rotate-90" : ""
                  }`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.75}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M6 3.5 10.5 8 6 12.5" />
                </svg>
              </button>
              {open && (
                <ul
                  id={listId}
                  className="mt-0.5 mb-1 ml-3 space-y-0.5 border-l border-[var(--admin-border)] pl-1.5"
                >
                  {mod.children.map((child) => (
                    <li key={child.key}>
                      <NavLink
                        mod={child}
                        active={isModuleActive(child, pathname)}
                        row={childRow}
                        onNavigate={onNavigate}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        }

        return (
          <li key={mod.key} className={gapClass}>
            {heading}
            <NavLink
              mod={mod}
              active={active}
              row={row}
              onNavigate={onNavigate}
              badge={
                mod.key === "support" &&
                needsReply > 0 && (
                  <NeedsReplyTriangle
                    count={needsReply}
                    className={`ml-auto h-4 w-4 shrink-0 ${
                      active ? "text-amber-400" : "text-amber-600"
                    }`}
                  />
                )
              }
            />
          </li>
        );
      })}
    </ul>
  );
}

export function AdminNavFooter({ adminEmail }: { adminEmail: string }) {
  return (
    <div className="border-t border-[var(--admin-border)] p-3">
      <div className="mb-2">
        <AdminThemeToggle />
      </div>
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
  );
}
