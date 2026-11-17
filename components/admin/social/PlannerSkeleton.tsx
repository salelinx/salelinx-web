// The planner's shape while it loads (and for the moment before the browser
// knows today's date): header, toolbar and a week of empty columns, so the
// real page drops in without the layout jumping. Presentation only.

export function PlannerSkeleton({
  withHeader = true,
}: {
  withHeader?: boolean;
}) {
  const body = (
    <div
      className="space-y-4 p-4"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">Loading the planner</span>
      <div className="flex items-center gap-2">
        <div className="h-8 w-16 animate-pulse rounded-lg bg-zinc-100" />
        <div className="h-8 w-16 animate-pulse rounded-lg bg-zinc-100" />
        <div className="h-5 w-40 animate-pulse rounded bg-zinc-100" />
        <div className="ml-auto h-8 w-44 animate-pulse rounded-lg bg-zinc-100" />
      </div>
      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-border)] md:min-h-[28rem] md:grid-cols-7">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="space-y-2 bg-[var(--admin-surface)] p-2.5">
            <div className="h-5 w-14 animate-pulse rounded bg-zinc-100" />
            {i % 3 !== 2 && (
              <div
                className="h-[74px] animate-pulse rounded-lg bg-zinc-100"
                style={{ opacity: 0.8 - i * 0.08 }}
              />
            )}
            {i % 2 === 0 && (
              <div
                className="h-[74px] animate-pulse rounded-lg bg-zinc-100"
                style={{ opacity: 0.6 - i * 0.06 }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
  if (!withHeader) return body;
  return (
    <div className="flex h-full flex-col">
      <header className="flex min-h-12 shrink-0 items-center border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-2">
        <h1 className="text-sm font-semibold">Planner</h1>
      </header>
      <div className="min-h-0 flex-1 overflow-hidden">{body}</div>
    </div>
  );
}
