// Shared loading skeleton for the admin modules. Mirrors the shell every module
// renders (a 12-unit header bar plus a scrolling body) so the swap to real
// content does not shift layout. Presentation only - it renders no data, so it
// is safe to show before any gate or query has resolved.

export function AdminSkeleton({
  title,
  rows = 8,
}: {
  title: string;
  rows?: number;
}) {
  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-12 shrink-0 items-center border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-4">
        <h1 className="text-sm font-semibold">{title}</h1>
      </header>

      <div className="min-h-0 flex-1 overflow-hidden p-4">
        <div
          className="space-y-2"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <span className="sr-only">Loading {title}</span>
          {Array.from({ length: rows }).map((_, i) => (
            <div
              key={i}
              className="h-9 animate-pulse rounded border border-[var(--admin-border)] bg-[var(--admin-surface)]"
              // Fade successive rows so the block reads as a list, not a slab.
              style={{ opacity: Math.max(0.25, 1 - i * 0.1) }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// Card-grid variant for the /admin overview, which is stat cards rather than a
// table.
export function AdminCardsSkeleton({ title }: { title: string }) {
  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-12 shrink-0 items-center border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-4">
        <h1 className="text-sm font-semibold">{title}</h1>
      </header>

      <div className="min-h-0 flex-1 overflow-hidden p-4">
        <div role="status" aria-live="polite" aria-busy="true">
          <span className="sr-only">Loading {title}</span>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded border border-[var(--admin-border)] bg-[var(--admin-surface)]"
              />
            ))}
          </div>
          <div className="mt-6 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-9 animate-pulse rounded border border-[var(--admin-border)] bg-[var(--admin-surface)]"
                style={{ opacity: Math.max(0.25, 1 - i * 0.15) }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
