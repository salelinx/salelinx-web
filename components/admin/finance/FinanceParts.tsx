// The pieces both Finance pages are built from (/admin/finance and
// /admin/finance/cancellations): figure tiles, titled boxes, row headings and
// money and date formatting. Server-safe, no hooks.

export function money(minor: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: currency.toUpperCase(),
      maximumFractionDigits: minor % 100 === 0 ? 0 : 2,
    }).format(minor / 100);
  } catch {
    return `${(minor / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

export function monthLabel(
  key: string,
  style: "short" | "full" | "year" = "short",
): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-GB", {
    month: style === "short" ? "short" : "long",
    timeZone: "UTC",
    ...(style === "year" ? { year: "numeric" } : {}),
  });
}

/** "4 Nov". */
export function day(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

export function Stat({
  label,
  value,
  hint,
  note,
  dot,
  onClick,
}: {
  label: string;
  value: string;
  hint?: string;
  // How the figure is worked out, on hover.
  note: string;
  // A chart colour (CSS value) tying the tile to its series.
  dot?: string;
  // Makes the tile a button, for a figure that opens its list.
  onClick?: () => void;
}) {
  const body = (
    <>
      <p className="flex items-center gap-1.5 text-xs text-zinc-500">
        {dot && (
          <span
            aria-hidden
            className="h-2 w-2 shrink-0 rounded-sm"
            style={{ background: dot }}
          />
        )}
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-zinc-400">{hint}</p>}
    </>
  );
  const box =
    "rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-3";
  if (onClick)
    return (
      <button
        type="button"
        title={note}
        onClick={onClick}
        className={`${box} w-full text-left hover:border-zinc-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400`}
      >
        {body}
      </button>
    );
  return (
    <div title={note} className={box}>
      {body}
    </div>
  );
}

export function Box({
  title,
  hint,
  children,
  flush = false,
}: {
  title: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
  // No body padding, for a table that runs to the edges.
  flush?: boolean;
}) {
  return (
    <section className="min-w-0 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1 border-b border-[var(--admin-border)] px-4 py-2.5">
        <h2 className="text-sm font-semibold">{title}</h2>
        {hint && <span className="text-xs text-zinc-400">{hint}</span>}
      </div>
      <div className={flush ? "" : "px-4 py-3"}>{children}</div>
    </section>
  );
}

export function RowTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="pt-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
      {children}
    </h2>
  );
}
