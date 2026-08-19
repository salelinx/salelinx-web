"use client";

// Feature-level status, rolled up from the per-endpoint telemetry below it.
//
// This is the "what would a user notice" view: endpoints are how we measure,
// features are what people actually use. Each card is as healthy as the WORST
// endpoint that feature depends on.
//
// "No data" is shown in its own muted style rather than as a green tick.
// Silence is not evidence of health - a feature broken badly enough that
// nobody can use it has zero traffic, which is indistinguishable from a
// feature nobody happened to touch today.

import type { FeatureStatus } from "@/lib/admin/feature-status";

type Props = {
  features: FeatureStatus[];
};

const CARD_TONE: Record<FeatureStatus["status"], string> = {
  ok: "border-emerald-200 bg-emerald-50",
  warn: "border-amber-200 bg-amber-50",
  broken: "border-red-200 bg-red-50",
  unknown: "border-[var(--admin-border)] bg-zinc-50",
};

const DOT_TONE: Record<FeatureStatus["status"], string> = {
  ok: "bg-emerald-500",
  warn: "bg-amber-500",
  broken: "bg-red-500",
  unknown: "bg-zinc-300",
};

const STATUS_LABEL: Record<FeatureStatus["status"], string> = {
  ok: "Operational",
  warn: "Degraded",
  broken: "Broken",
  unknown: "No data",
};

const PLATFORM_LABEL: Record<FeatureStatus["platform"], string> = {
  depop: "Depop",
  vinted: "Vinted",
};

export function FeatureStatusGrid({ features }: Props) {
  const broken = features.filter((f) => f.status === "broken");
  const degraded = features.filter((f) => f.status === "warn");

  return (
    <section className="border-b border-[var(--admin-border)] px-4 py-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">Feature status</h2>
        <p className="text-xs text-zinc-500">
          {broken.length > 0
            ? `${broken.length} broken`
            : degraded.length > 0
              ? `${degraded.length} degraded`
              : "Nothing reported broken"}
        </p>
      </div>

      {/* Grouped by marketplace, because that is how these actually break: a
          Vinted schema change takes out Vinted crosslisting while Depop keeps
          working, and the first question is always "which one". */}
      {(["vinted", "depop"] as const).map((platform) => {
        const group = features.filter((f) => f.platform === platform);
        if (group.length === 0) return null;

        return (
          <div key={platform} className="mb-4 last:mb-0">
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
              {PLATFORM_LABEL[platform]}
            </h3>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-2">
              {group.map((f) => (
                <FeatureCard key={f.key} feature={f} />
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}

function FeatureCard({ feature: f }: { feature: FeatureStatus }) {
  return (
    <div className={`rounded-md border px-3 py-2.5 ${CARD_TONE[f.status]}`}>
      <div className="flex items-center gap-2">
        <span
          className={`inline-block h-2 w-2 shrink-0 rounded-full ${DOT_TONE[f.status]}`}
          aria-hidden="true"
        />
        <span className="truncate text-sm font-medium">{f.label}</span>
      </div>

      <div className="mt-1">
        <span
          className={
            f.status === "unknown"
              ? "text-xs text-zinc-400"
              : "text-xs text-zinc-600"
          }
        >
          {STATUS_LABEL[f.status]}
        </span>
      </div>

      {f.status === "unknown" ? (
        <p className="mt-1 text-[11px] text-zinc-400">
          No calls in this window
        </p>
      ) : (
        <p className="mt-1 text-[11px] tabular-nums text-zinc-500">
          {f.totalCalls.toLocaleString("en-US")} calls
          {f.failureRate !== null && f.failureRate > 0
            ? ` - ${f.failureRate}% failing`
            : ""}
          {/* Coverage, so a green card backed by one of ten endpoints does not
              read as a full all-clear. */}
          {f.endpointsSeen < f.endpointsTotal
            ? ` (${f.endpointsSeen}/${f.endpointsTotal} endpoints seen)`
            : ""}
        </p>
      )}

      {f.worstEndpoint && (
        <p
          className="mt-1 truncate font-mono text-[10px] text-zinc-500"
          title={f.worstEndpoint}
        >
          {f.worstEndpoint}
        </p>
      )}
    </div>
  );
}
