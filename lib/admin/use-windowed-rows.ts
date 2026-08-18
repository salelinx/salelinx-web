"use client";

import { useMemo, useState } from "react";

// How many rows each admin table puts in the DOM before the user asks for more.
// The modules fetch their full result set server-side (filters and search run
// across ALL of it, not just the rendered page), so this caps rendering cost
// only - it never hides a row from a search.
export const ADMIN_PAGE_SIZE = 100;

// Windows an already-filtered, already-sorted row list down to the first N.
//
// Every admin table follows the same shape: a `visible` memo that filters and
// sorts the full set, then a `.map` that renders it. That map was unbounded, so
// a large table put every row in the DOM at once. This hook slices the render
// without touching the filtering, so:
//
//   - search and filters still apply to the whole dataset
//   - counts shown in the header stay counts of the whole filtered set
//   - "Show more" is purely a rendering concession, not a data boundary
//
// The window resets whenever the filtered set changes identity (a new search or
// filter), so narrowing a search never leaves you scrolled into a stale page.
// That reset is derived during render rather than done in an effect: the repo
// lints against setState-in-effect, and this is the "adjust state when a prop
// changes" pattern from the React docs, which renders once instead of twice.
export function useWindowedRows<T>(rows: T[], pageSize = ADMIN_PAGE_SIZE) {
  const [limit, setLimit] = useState(pageSize);
  const [seen, setSeen] = useState(rows);

  if (seen !== rows) {
    setSeen(rows);
    setLimit(pageSize);
  }

  // `limit` may be one render stale on the frame the reset happens above, so
  // clamp here rather than reading it directly.
  const effectiveLimit = seen === rows ? limit : pageSize;
  const windowed = useMemo(
    () => rows.slice(0, effectiveLimit),
    [rows, effectiveLimit],
  );
  const hasMore = rows.length > windowed.length;

  return {
    windowed,
    hasMore,
    shown: windowed.length,
    total: rows.length,
    showMore: () => setLimit((n) => n + pageSize),
    showAll: () => setLimit(Number.MAX_SAFE_INTEGER),
  };
}
