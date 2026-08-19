"use client";

import { useState } from "react";

// Collapsible section for the admin console.
//
// The health module stacks several tall blocks (feature rollup, manual status
// controls, endpoint table) and the overview now carries the rollup too. Any
// one of them is useful; all of them at once pushed the actual summaries below
// the fold.
//
// Open/closed is persisted per section in localStorage, so a section you
// collapsed stays collapsed when you navigate back. Defaults are set by the
// caller, since "useful by default" differs per section: an incident tool
// should be closed until wanted, a summary should not.
//
// Deliberately NOT <details>/<summary>: those animate poorly and, more
// importantly, keep collapsed content in the DOM, which for the endpoint table
// means rendering hundreds of rows nobody is looking at.

type Props = {
  // Stable key for the persisted state. Changing it resets everyone's toggle.
  storageKey: string;
  title: string;
  // Rendered next to the title even when collapsed, so a section can still
  // report "3 broken" without being opened.
  summary?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
};

export function AdminSection({
  storageKey,
  title,
  summary,
  defaultOpen = true,
  children,
}: Props) {
  const [open, setOpen] = useState(() => {
    // Read during initialisation rather than in an effect: an effect would
    // render the wrong state first and flash. Guarded for SSR, where the
    // default is used and the client corrects on hydration.
    if (typeof window === "undefined") return defaultOpen;
    try {
      const stored = window.localStorage.getItem(`admin-section:${storageKey}`);
      return stored === null ? defaultOpen : stored === "open";
    } catch {
      // Storage disabled (private mode, blocked cookies): fall back rather
      // than breaking the page over a UI preference.
      return defaultOpen;
    }
  });

  const toggle = () => {
    setOpen((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(
          `admin-section:${storageKey}`,
          next ? "open" : "closed",
        );
      } catch {
        // Preference is not worth an error; the toggle still works this session.
      }
      return next;
    });
  };

  return (
    <section className="border-b border-[var(--admin-border)]">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left hover:bg-zinc-50"
      >
        <span
          aria-hidden="true"
          className={`inline-block text-[10px] text-zinc-400 transition-transform ${
            open ? "rotate-90" : ""
          }`}
        >
          &#9654;
        </span>
        <span className="text-sm font-semibold">{title}</span>
        {summary && (
          <span className="ml-auto text-xs text-zinc-500">{summary}</span>
        )}
      </button>

      {open && <div className="pb-1">{children}</div>}
    </section>
  );
}
