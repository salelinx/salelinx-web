"use client";

// Period selector for the Extension usage page. Presets navigate immediately;
// "Custom range" reveals from/to date inputs applied on demand. The selection
// lives in the URL (?range= or ?from=&to=) so the server page resolves the
// period keys and the view is shareable / refreshable.

import { useState } from "react";
import { useRouter } from "next/navigation";

const PRESETS = [
  { value: "current", label: "Current period" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "all", label: "All time" },
  { value: "custom", label: "Custom range" },
] as const;

export type UsageRangePreset = (typeof PRESETS)[number]["value"];

type Props = {
  preset: UsageRangePreset;
  from: string; // YYYY-MM-DD, seeds the custom inputs
  to: string;
  min: string; // earliest selectable day (USAGE_EPOCH)
  max: string; // today
};

const inputClass =
  "rounded-md border border-[var(--admin-border)] bg-white px-2 py-1 text-xs outline-none focus:border-zinc-400";

export function UsageRangePicker({ preset, from, to, min, max }: Props) {
  const router = useRouter();
  const [custom, setCustom] = useState(preset === "custom");
  const [fromDraft, setFromDraft] = useState(from);
  const [toDraft, setToDraft] = useState(to);

  const onPreset = (value: string) => {
    if (value === "custom") {
      setCustom(true);
      return;
    }
    setCustom(false);
    router.push(
      value === "current" ? "/admin/usage" : `/admin/usage?range=${value}`,
    );
  };

  const applyCustom = () => {
    if (!fromDraft || !toDraft) return;
    router.push(`/admin/usage?from=${fromDraft}&to=${toDraft}`);
  };

  return (
    <div className="flex items-center gap-2">
      <select
        value={custom ? "custom" : preset}
        onChange={(e) => onPreset(e.target.value)}
        className={inputClass}
        aria-label="Usage period"
      >
        {PRESETS.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>
      {custom && (
        <>
          <input
            type="date"
            value={fromDraft}
            min={min}
            max={toDraft || max}
            onChange={(e) => setFromDraft(e.target.value)}
            className={inputClass}
            aria-label="From date"
          />
          <span className="text-xs text-zinc-400">to</span>
          <input
            type="date"
            value={toDraft}
            min={fromDraft || min}
            max={max}
            onChange={(e) => setToDraft(e.target.value)}
            className={inputClass}
            aria-label="To date"
          />
          <button
            type="button"
            onClick={applyCustom}
            disabled={!fromDraft || !toDraft}
            className="rounded-md border border-[var(--admin-border)] px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-100 disabled:opacity-40"
          >
            Apply
          </button>
        </>
      )}
    </div>
  );
}
