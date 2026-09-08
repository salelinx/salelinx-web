"use client";

// Period selector for the usage pages. Presets navigate immediately; "Custom
// range" reveals from/to datetime inputs, always in UTC and always at hour
// resolution (snapped to the hour), applied on demand. The selection lives in
// the URL (?range= or ?from=&to=, resolved by lib/admin/usage-range.ts) so
// the server page resolves the period keys and the view is shareable /
// refreshable.
//
// Hour keys are 'YYYY-MM-DDTHH'; a datetime-local input's value is
// 'YYYY-MM-DDTHH:MM', so the two convert by slicing / appending ':00'. The
// browser shows datetime-local values in no particular zone (it is a naive
// timestamp), and the buckets are UTC, so the inputs are labelled UTC.
//
// The resolver still accepts day-shaped ?from=&to= for old links, but the
// picker no longer offers a day mode: custom ranges are UTC hours, full stop.
// Day-resolution views are the presets (7 / 30 days, all time).

import { useState } from "react";
import { useRouter } from "next/navigation";
import { WINDOW_PRESETS } from "@/lib/admin/usage-range";
import type {
  UsageRangeBounds,
  UsageRangePreset,
  UsageRangeResolution,
} from "@/lib/admin/usage-range";

// Trailing-window presets come from the resolver's table so the option list
// and the resolution stay in step; they are exact windows ending now, read
// from usage_events (see WINDOW_PRESETS).
const PRESETS: { value: UsageRangePreset; label: string }[] = [
  { value: "current", label: "Current period" },
  ...(Object.entries(WINDOW_PRESETS) as [UsageRangePreset, { label: string }][]).map(
    ([value, { label }]) => ({ value, label }),
  ),
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "all", label: "All time" },
  { value: "custom", label: "Custom range (UTC)" },
];

type Props = {
  preset: UsageRangePreset;
  resolution: UsageRangeResolution;
  // Day keys at day resolution, hour keys at hour resolution; seed the inputs.
  from: string;
  to: string;
  bounds: UsageRangeBounds;
  // The page the selection navigates on; both usage pages share this picker.
  basePath?: string;
};

const inputClass =
  "rounded-md border border-[var(--admin-border)] bg-white px-2 py-1 text-xs outline-none focus:border-zinc-400";

const toInputHour = (key: string) => `${key}:00`;
const fromInputHour = (value: string) => value.slice(0, 13);
const clampHourKey = (key: string, bounds: UsageRangeBounds) =>
  key < bounds.hourMin ? bounds.hourMin : key > bounds.hourMax ? bounds.hourMax : key;

export function UsageRangePicker({
  preset,
  resolution,
  from,
  to,
  bounds,
  basePath = "/admin/usage",
}: Props) {
  const router = useRouter();
  const [custom, setCustom] = useState(preset === "custom");
  // Seed from the current selection. A window selection (ISO timestamps) is
  // snapped to its hours; a day-resolution selection (a preset or an old
  // day-shaped link) is widened to whole UTC days. Both are then clamped to
  // the window that has hour rows.
  const [draft, setDraft] = useState(() => {
    const fromKey =
      resolution === "hour"
        ? from
        : resolution === "window"
          ? from.slice(0, 13)
          : `${from}T00`;
    const toKey =
      resolution === "hour"
        ? to
        : resolution === "window"
          ? to.slice(0, 13)
          : `${to}T23`;
    return {
      from: toInputHour(clampHourKey(fromKey, bounds)),
      to: toInputHour(clampHourKey(toKey, bounds)),
    };
  });

  const onPreset = (value: string) => {
    if (value === "custom") {
      setCustom(true);
      return;
    }
    setCustom(false);
    router.push(value === "current" ? basePath : `${basePath}?range=${value}`);
  };

  const canApply = Boolean(draft.from && draft.to);

  const applyCustom = () => {
    if (!canApply) return;
    router.push(
      `${basePath}?from=${fromInputHour(draft.from)}&to=${fromInputHour(draft.to)}`,
    );
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
            type="datetime-local"
            step={3600}
            value={draft.from}
            min={toInputHour(bounds.hourMin)}
            max={draft.to || toInputHour(bounds.hourMax)}
            onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))}
            className={inputClass}
            aria-label="From hour (UTC)"
          />
          <span className="text-xs text-zinc-400">to</span>
          <input
            type="datetime-local"
            step={3600}
            value={draft.to}
            min={draft.from || toInputHour(bounds.hourMin)}
            max={toInputHour(bounds.hourMax)}
            onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))}
            className={inputClass}
            aria-label="To hour (UTC)"
          />
          <span className="text-xs text-zinc-400">UTC</span>
          <button
            type="button"
            onClick={applyCustom}
            disabled={!canApply}
            className="rounded-md border border-[var(--admin-border)] px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-100 disabled:opacity-40"
          >
            Apply
          </button>
        </>
      )}
    </div>
  );
}
