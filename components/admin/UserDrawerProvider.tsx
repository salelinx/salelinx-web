"use client";

// Lets ANY admin module open the user detail drawer, so an email rendered in
// Subscriptions, Support, Storage, Usage or Analytics is a way into the same
// panel the Users roster opens - without navigating away and losing the
// filters, sort and scroll position you set up to find that user.
//
// Why a provider rather than a prop: emails are rendered in a dozen places
// across ten components, several of them nested inside table rows that already
// own a click handler. Threading "open this user" callbacks down every one of
// those trees would touch far more code than it is worth, and the drawer is a
// singleton anyway (only one can be open at a time). The provider mounts once
// in the admin layout; <UserEmailLink> anywhere below it just works.
//
// Two deliberate differences from the Users module's own drawer:
//
//  1. It is READ-ONLY here (readOnly on AdminUserDetail hides Edit, Change
//     plan and the Danger zone). The host table cannot know how to update
//     itself after an edit made from a drawer it does not own, so it would
//     silently show stale rows. Mutations stay in /admin/users, where the
//     roster updates in place. See docs/ADMIN.md.
//
//  2. Callers pass only a user_id, because that is all a subscriptions row or
//     a ticket has. The drawer needs an AdminUserRow, so the provider fetches
//     the roster and picks that row. /admin/users passes its row straight to
//     AdminUserDetail instead and never goes through here.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import dynamic from "next/dynamic";
import { createBrowserClient } from "@/lib/supabase/client";
import type { AdminUserRow } from "@/lib/types/admin";
import type { TierConfig } from "@/lib/types/tiers";

// Same dynamic import the Users roster uses: the drawer is ~1k lines and only
// ever renders after a click, so it should not sit in the shell's bundle.
const AdminUserDetail = dynamic(
  () => import("./users/AdminUserDetail").then((m) => m.AdminUserDetail),
  { ssr: false },
);

type OpenUser = (userId: string) => void;

const UserDrawerContext = createContext<OpenUser | null>(null);

// Null outside the provider rather than throwing: the Users module renders its
// own drawer and does not need this one, and a module rendered in isolation
// (tests, a future standalone page) should degrade to a plain email, not crash.
export function useUserDrawer(): OpenUser | null {
  return useContext(UserDrawerContext);
}

export function UserDrawerProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [userId, setUserId] = useState<string | null>(null);
  const [user, setUser] = useState<AdminUserRow | null>(null);
  const [tiers, setTiers] = useState<TierConfig[]>([]);
  const [error, setError] = useState<string | null>(null);

  const open = useCallback((id: string) => {
    setUser(null);
    setError(null);
    setUserId(id);
  }, []);

  const close = useCallback(() => {
    setUserId(null);
    setUser(null);
    setError(null);
  }, []);

  // Close on Escape, matching every other dismissable surface in the console.
  useEffect(() => {
    if (!userId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [userId, close]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const supabase = createBrowserClient();

    async function load(id: string) {
      // admin_list_users() takes no arguments - it returns the whole roster and
      // we pick one row. That is why this needs no new migration. The roster is
      // small (one row per account) and this only runs on an explicit click.
      // tier_limits is public-read, so it needs no admin RPC.
      const [rosterRes, tierRes] = await Promise.all([
        supabase.rpc("admin_list_users"),
        supabase
          .from("tier_limits")
          .select("tier_id, version, limits, features, active")
          .eq("active", true),
      ]);
      if (cancelled) return;

      const roster = (rosterRes.data as AdminUserRow[] | null) ?? [];
      const found = roster.find((u) => u.user_id === id) ?? null;
      if (!found) {
        // Either the RPC failed (not an admin, AAL1, network) or the account
        // has since been deleted. Both are worth saying out loud rather than
        // leaving an empty drawer.
        setError(
          rosterRes.error
            ? "Could not load this user."
            : "This account no longer exists.",
        );
        return;
      }
      setUser(found);
      setTiers((tierRes.data as TierConfig[] | null) ?? []);
    }

    void load(userId);
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return (
    <UserDrawerContext.Provider value={open}>
      {children}

      {userId && (
        <>
          {/* Click-away backdrop. The Users roster drawer has no backdrop
              because the roster behind it is the thing you came from; here the
              drawer is an interruption over an unrelated table, so it gets a
              way out that does not require aiming at the close button. */}
          <div
            className="fixed inset-0 z-10 bg-zinc-900/10"
            onClick={close}
            aria-hidden="true"
          />
          {user ? (
            <AdminUserDetail
              key={user.user_id}
              user={user}
              tiers={tiers}
              readOnly
              onClose={close}
              // Read-only, so neither fires. Required by the drawer's props.
              onSubscriptionChange={() => {}}
              onDeleted={() => {}}
            />
          ) : (
            <div className="fixed inset-y-0 right-0 z-20 flex w-full max-w-xl flex-col border-l border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl">
              <header className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--admin-border)] px-4">
                <span className="text-sm font-semibold">
                  {error ? "User" : "Loading..."}
                </span>
                <button
                  type="button"
                  onClick={close}
                  className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                  aria-label="Close detail"
                >
                  x
                </button>
              </header>
              <p className="px-4 py-8 text-sm text-zinc-500">
                {error ?? "Loading user..."}
              </p>
            </div>
          )}
        </>
      )}
    </UserDrawerContext.Provider>
  );
}
