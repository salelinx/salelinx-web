"use client";

// Manual status controls for the public status page.
//
// Every target is AUTOMATIC by default; a row in status_overrides switches it
// to manual, and manual wins until cleared. That asymmetry is deliberate: an
// admin declaring an incident usually knows something telemetry cannot see (a
// marketplace announcement, a single loud user report, a fix mid-deploy), so
// the numbers must not silently overrule them. The cost is a stale override
// lingering, which is why each one shows its age here.
//
// Writes go through the is_admin()-gated RPCs in 011_status_overrides.sql, which are the
// security boundary and write their own audit entries.

import { useState, useTransition } from "react";
import type { FeatureStatus } from "@/lib/admin/feature-status";
import {
  setStatusOverride,
  clearStatusOverride,
} from "@/app/admin/health/actions";

export type OverrideRow = {
  target: string;
  state: string;
  note: string | null;
  updated_at: string;
};

type Props = {
  features: FeatureStatus[];
  overrides: OverrideRow[];
};

const STATES = ["ok", "degraded", "down"] as const;

const STATE_LABEL: Record<string, string> = {
  ok: "Operational",
  degraded: "Degraded",
  down: "Down",
};

function ageLabel(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function StatusOverrideControls({ features, overrides }: Props) {
  const byTarget = new Map(overrides.map((o) => [o.target, o]));

  // Platforms first: a marketplace-wide outage is the bigger claim, and it has
  // no automatic signal of its own (see lib/docs/status.ts).
  const targets: Array<{ target: string; label: string; sub: string }> = [
    { target: "platform:vinted", label: "Vinted", sub: "Whole marketplace" },
    { target: "platform:depop", label: "Depop", sub: "Whole marketplace" },
    ...features.map((f) => ({
      target: `feature:${f.key}`,
      label: f.label,
      sub: f.platform === "vinted" ? "Vinted" : "Depop",
    })),
  ];

  const activeCount = overrides.length;

  return (
    <section className="border-b border-[var(--admin-border)] px-4 py-4">
      <div className="mb-1 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">Manual status</h2>
        <p className="text-xs text-zinc-500">
          {activeCount === 0
            ? "All automatic"
            : `${activeCount} manually set`}
        </p>
      </div>
      <p className="mb-3 max-w-2xl text-xs text-zinc-500">
        Everything is automatic unless switched to manual here. A manual status
        overrides telemetry on the public status page until it is cleared, and
        takes up to a minute to appear there.
      </p>

      <div className="divide-y divide-[var(--admin-border)] rounded-md border border-[var(--admin-border)]">
        {targets.map((t) => (
          <OverrideRowControl
            key={t.target}
            target={t.target}
            label={t.label}
            sub={t.sub}
            override={byTarget.get(t.target)}
          />
        ))}
      </div>
    </section>
  );
}

function OverrideRowControl({
  target,
  label,
  sub,
  override,
}: {
  target: string;
  label: string;
  sub: string;
  override: OverrideRow | undefined;
}) {
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState(override?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const manual = !!override;

  const apply = (state: string) => {
    setError(null);
    startTransition(async () => {
      const res = await setStatusOverride(target, state, note);
      if (!res.ok) setError(res.error ?? "Failed");
    });
  };

  const clear = () => {
    setError(null);
    startTransition(async () => {
      const res = await clearStatusOverride(target);
      if (!res.ok) setError(res.error ?? "Failed");
      else setNote("");
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2">
      <div className="min-w-[150px]">
        <span className="text-sm font-medium">{label}</span>
        <span className="ml-2 text-[11px] uppercase tracking-wide text-zinc-400">
          {sub}
        </span>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={clear}
          disabled={pending || !manual}
          className={
            !manual
              ? "rounded-md bg-zinc-900 px-2.5 py-1 text-xs font-medium text-white"
              : "rounded-md px-2.5 py-1 text-xs text-zinc-600 hover:bg-zinc-100 disabled:opacity-50"
          }
        >
          Auto
        </button>
        {STATES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => apply(s)}
            disabled={pending}
            className={
              manual && override?.state === s
                ? "rounded-md bg-zinc-900 px-2.5 py-1 text-xs font-medium text-white"
                : "rounded-md px-2.5 py-1 text-xs text-zinc-600 hover:bg-zinc-100 disabled:opacity-50"
            }
          >
            {STATE_LABEL[s]}
          </button>
        ))}
      </div>

      {/* Public note. Only meaningful while manual, so it is hidden otherwise
          rather than inviting text that would never be shown. */}
      {manual && (
        <input
          type="text"
          value={note}
          maxLength={280}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => {
            if ((override?.note ?? "") !== note) apply(override!.state);
          }}
          placeholder="Public note (optional)"
          disabled={pending}
          className="min-w-[200px] flex-1 rounded-md border border-[var(--admin-border)] px-2 py-1 text-xs"
        />
      )}

      {manual && override && (
        <span className="text-[11px] text-zinc-400">
          set {ageLabel(override.updated_at)}
        </span>
      )}

      {error && <span className="text-[11px] text-red-600">{error}</span>}
    </div>
  );
}
