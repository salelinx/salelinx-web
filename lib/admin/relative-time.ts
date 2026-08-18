// Relative timestamps for the admin console ("3 days ago"), plus a staleness
// tone so a roster of dates reads as a health signal at a glance instead of
// something you have to do arithmetic on.
//
// Every function takes `nowMs` explicitly rather than calling Date.now()
// itself. That is deliberate: these render inside Client Components that Next
// also renders on the server, and a "now" read independently on each side
// produces different text for the same row, which React reports as a hydration
// mismatch. Callers pass a single `now` captured after mount (null before it),
// so the server and the first client render agree on showing nothing.

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// Compact age label. Returns null for a missing timestamp so callers can fall
// back to their own placeholder.
export function relativeAge(iso: string | null, nowMs: number): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;

  const diff = nowMs - then;
  // Clock skew, or a timestamp a webhook wrote slightly ahead of us. Reading
  // "in 4 seconds" is worse than reading "just now".
  if (diff < MINUTE) return "just now";

  if (diff < HOUR) {
    const mins = Math.floor(diff / MINUTE);
    return `${mins}m ago`;
  }
  if (diff < DAY) {
    const hours = Math.floor(diff / HOUR);
    return `${hours}h ago`;
  }
  const days = Math.floor(diff / DAY);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export type Staleness = "fresh" | "recent" | "stale" | "none";

// How alive an account looks, bucketed for colour. The thresholds match how the
// product is used: the extension heartbeats whenever the panel is open, so a
// genuinely active seller is seen within days, not weeks.
export function staleness(iso: string | null, nowMs: number): Staleness {
  if (!iso) return "none";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "none";
  const diff = nowMs - then;
  if (diff < 7 * DAY) return "fresh";
  if (diff < 30 * DAY) return "recent";
  return "stale";
}

export const STALENESS_TONE: Record<Staleness, string> = {
  fresh: "text-emerald-700",
  recent: "text-amber-700",
  stale: "text-zinc-500",
  none: "text-zinc-400",
};

// The more recent of two timestamps, either of which may be missing. Used to
// reconcile last_sign_in_at (the website's view of the account) with the
// freshest device heartbeat (the extension's), which usually disagree: a
// refresh token keeps a session alive long after someone stops using the
// product, so the heartbeat is normally the fresher and truer of the two.
export function mostRecent(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b;
}
