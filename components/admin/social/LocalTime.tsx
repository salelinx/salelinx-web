"use client";

// A time in the viewer's own time zone. The server renders in UTC, so the
// text differs once the browser takes over; suppressHydrationWarning accepts
// that for this one element instead of warning on every scheduled post.

export function LocalTime({ iso, weekday }: { iso: string; weekday?: boolean }) {
  const d = new Date(iso);
  return (
    <time dateTime={iso} suppressHydrationWarning>
      {d.toLocaleString("en-GB", {
        ...(weekday ? { weekday: "short" } : {}),
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })}
    </time>
  );
}
