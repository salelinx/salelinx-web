// The index colour scale: blue above our typical video, orange below, grey
// about the same. Blue and orange rather than green and red, so it still reads
// for red-green colour blindness; every badge also shows its number. The
// palettes are mirrored in admin.css's dark theme, so these classes flip with
// the console.

import Link from "next/link";
import { formatIndex, indexTone, type IndexTone } from "@/lib/social/overview";

const BADGE: Record<IndexTone, string> = {
  "well-above": "bg-blue-600 text-white",
  above: "bg-blue-100 text-blue-800",
  typical: "bg-zinc-100 text-zinc-700",
  below: "bg-orange-100 text-orange-800",
  "well-below": "bg-orange-700 text-white",
};

const DOT: Record<IndexTone, string> = {
  "well-above": "bg-blue-500",
  above: "bg-blue-500",
  typical: "bg-zinc-500",
  below: "bg-orange-500",
  "well-below": "bg-orange-500",
};

export const indexDotClass = (x: number) => DOT[indexTone(x)];

/** Text colour for a change: up is blue, down orange, nothing grey. */
export const changeClass = (x: number | null) =>
  x === null || Math.abs(x) < 1e-9 ? "text-zinc-500" : x > 0 ? "text-blue-700" : "text-orange-700";

export function IndexBadge({
  value,
  href,
  title,
}: {
  value: number | null;
  href?: string;
  title?: string;
}) {
  if (value === null) {
    const empty = (
      <span className="inline-flex min-w-11 justify-center rounded-md px-1.5 py-0.5 text-xs text-zinc-400">-</span>
    );
    return href ? (
      <Link href={href} title={title} className="hover:underline">
        {empty}
      </Link>
    ) : (
      empty
    );
  }
  const badge = (
    <span
      className={`inline-flex min-w-11 justify-center rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums ${BADGE[indexTone(value)]}`}
    >
      {formatIndex(value)}
    </span>
  );
  return href ? (
    <Link href={href} title={title} className="rounded-md hover:opacity-80">
      {badge}
    </Link>
  ) : (
    <span title={title}>{badge}</span>
  );
}
