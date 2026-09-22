"use client";

// A user's email (or their raw id, when no email resolved) rendered as a way
// into the user detail drawer. Drop-in for the
// `{email ? <span>{email}</span> : <span>{user_id}</span>}` pattern that every
// admin table repeats.
//
// Renders a <span role="button"> rather than a <button>: several call sites
// sit inside an element that is already clickable (a table row that opens a
// ticket, the toggle button on a usage group), and nesting a button inside a
// button is invalid HTML that React will warn about. A span with an explicit
// role, tabIndex and keyboard handler is accessible without that problem.
//
// Clicks and Enter/Space are stopped from propagating, so clicking the email
// inside a row that has its own handler opens the user, not the row.

import { useUserDrawer } from "@/components/admin/UserDrawerProvider";

export function UserEmailLink({
  userId,
  email,
  className,
  fallbackClassName,
}: {
  // Null is allowed so callers with a nullable actor id (the audit log) can
  // pass it straight through: with no id there is nothing to open, and the
  // text renders plain.
  userId: string | null;
  email: string | null | undefined;
  // Applied when an email is shown.
  className?: string;
  // Applied when falling back to the raw id, which every table styles as
  // small monospace.
  fallbackClassName?: string;
}) {
  const open = useUserDrawer();

  const label = email ?? userId;
  const styles = email
    ? (className ?? "text-zinc-800")
    : (fallbackClassName ?? "font-mono text-xs text-zinc-400");

  // Nothing to show, and nothing to open.
  if (!label) return null;

  // Outside the provider (or with no id): plain text, no affordance. The Users
  // roster is the main case - its rows already open the drawer themselves.
  if (!open || !userId) {
    return <span className={styles}>{label}</span>;
  }

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation();
        open(userId);
      }}
      onKeyDown={(e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        e.stopPropagation();
        open(userId);
      }}
      title="Open user detail"
      className={`cursor-pointer underline decoration-dotted underline-offset-2 hover:decoration-solid focus:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400 ${styles}`}
    >
      {label}
    </span>
  );
}
