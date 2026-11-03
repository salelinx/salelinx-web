"use client";

// Whether any support ticket is waiting on staff, for the alert triangle on the
// Support nav entry (sidebar, phone tab bar and its More sheet).
//
// A client read rather than a prop from the admin layout, because Next keeps a
// layout mounted across soft navigations: a server-rendered count would stay
// frozen at whatever it was on the last full page load. RLS gates the read
// through is_admin(), the same as the support table.
//
// Re-checks on every navigation and whenever the window regains focus. There is
// no polling, so a tab left open and focused only updates when you next click.
// AdminTicketTable calls refresh() after each change, so answering a ticket
// clears the triangle straight away.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";
import { loadOpenTicketCounts } from "@/lib/admin/needs-reply";

type NeedsReply = {
  count: number;
  refresh: () => Promise<void>;
};

// Defaults rather than null, so a nav or table rendered outside the provider
// simply shows no alert.
const NeedsReplyContext = createContext<NeedsReply>({
  count: 0,
  refresh: async () => {},
});

export function useNeedsReply(): NeedsReply {
  return useContext(NeedsReplyContext);
}

export function NeedsReplyProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [count, setCount] = useState(0);

  const refresh = useCallback(
    () =>
      loadOpenTicketCounts(createBrowserClient()).then((counts) => {
        // A failed read keeps the last known answer: it should neither raise a
        // false alarm nor clear a real one.
        if (counts) setCount(counts.needsReply);
      }),
    [],
  );

  useEffect(() => {
    void refresh();
  }, [pathname, refresh]);

  useEffect(() => {
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  const value = useMemo(() => ({ count, refresh }), [count, refresh]);

  return (
    <NeedsReplyContext.Provider value={value}>
      {children}
    </NeedsReplyContext.Provider>
  );
}

// The caller sets size and colour, since the amber has to change on the dark
// active row. The title is both the tooltip and the accessible name.
export function NeedsReplyTriangle({
  count,
  className,
}: {
  count: number;
  className: string;
}) {
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.25}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <title>
        {count === 1
          ? "1 ticket needs a reply"
          : `${count} tickets need a reply`}
      </title>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}
