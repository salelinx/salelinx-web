"use client";

// Period selector for the usage pages. Presets navigate immediately; "Custom
// range" reveals from/to inputs applied on demand, at day resolution (date
// inputs) or hour resolution (datetime inputs snapped to the hour, read as
// UTC). The selection lives in the URL (?range= or ?from=&to=, resolved by
// lib/admin/usage-range.ts) so the server page resolves the period keys and
// the view is shareable / refreshable.
//
// Hour keys are 'YYYY-MM-DDTHH'; a datetime-local input's value is
// 'YYYY-MM-DDTHH:MM', so the two convert by slicing / appending ':00'. The
// browser shows datetime-local values in no particular zone (it is a naive
// timestamp), and the buckets are UTC, so the inputs are labelled UTC.

import { useState } from "react";
import { useRouter } from "next/navigation";
import type {
  UsageRangeBounds,
  UsageRangePreset,
  UsageRangeResolution,
} from "@/lib/admin/usage-range";

const PRESETS: { value: UsageRangePreset; label: string }[] = [
  { value: "current", label: "Current period" },
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "all", label: "All time" },
  { value: "custom", label: "Custom range" },
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
  const [draftResolution, setDraftResolution] =
    useState<UsageRangeResolution>(resolution);
  // Drafts for each resolution are kept apart so switching between them does
  // not leave a day key in an hour input (or the reverse).
  const [dayDraft, setDayDraft] = useState(() =>
    resolution === "day"
      ? { from, to }
      : { from: from.slice(0, 10), to: to.slice(0, 10) },
  );
  const [hourDraft, setHourDraft] = useState(() =>
    resolution === "hour"
      ? { from: toInputHour(from), to: toInputHour(to) }
      : { from: toInputHour(bounds.hourMin), to: toInputHour(bounds.hourMax) },
  );

  const onPreset = (value: string) => {
    if (value === "custom") {
      setCustom(true);
      return;
    }
    setCustom(false);
    router.push(value === "current" ? basePath : `${basePath}?range=${value}`);
  };

  const draft = draftResolution === "day" ? dayDraft : hourDraft;
  const canApply = Boolean(draft.from && draft.to);

  const applyCustom = () => {
    if (!canApply) return;
    const fromKey =
      draftResolution === "day" ? dayDraft.from : fromInputHour(hourDraft.from);
    const toKey =
      draftResolution === "day" ? dayDraft.to : fromInputHour(hourDraft.to);
    router.push(`${basePath}?from=${fromKey}&to=${toKey}`);
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
          <select
            value={draftResolution}
            onChange={(e) =>
              setDraftResolution(e.target.value as UsageRangeResolution)
            }
            className={inputClass}
            aria-label="Range resolution"
          >
            <option value="day">Days</option>
            <option value="hour">Hours (UTC)</option>
          </select>
          {draftResolution === "day" ? (
            <>
              <input
                type="date"
                value={dayDraft.from}
                min={bounds.dayMin}
                max={dayDraft.to || bounds.dayMax}
                onChange={(e) =>
                  setDayDraft((d) => ({ ...d, from: e.target.value }))
                }
                className={inputClass}
                aria-label="From date"
              />
              <span className="text-xs text-zinc-400">to</span>
              <input
                type="date"
                value={dayDraft.to}
                min={dayDraft.from || bounds.dayMin}
                max={bounds.dayMax}
                onChange={(e) =>
                  setDayDraft((d) => ({ ...d, to: e.target.value }))
                }
                className={inputClass}
                aria-label="To date"
              />
            </>
          ) : (
            <>
              <input
                type="datetime-local"
                step={3600}
                value={hourDraft.from}
                min={toInputHour(bounds.hourMin)}
                max={hourDraft.to || toInputHour(bounds.hourMax)}
                onChange={(e) =>
                  setHourDraft((d) => ({ ...d, from: e.target.value }))
                }
                className={inputClass}
                aria-label="From hour (UTC)"
              />
              <span className="text-xs text-zinc-400">to</span>
              <input
                type="datetime-local"
                step={3600}
                value={hourDraft.to}
                min={hourDraft.from || toInputHour(bounds.hourMin)}
                max={toInputHour(bounds.hourMax)}
                onChange={(e) =>
                  setHourDraft((d) => ({ ...d, to: e.target.value }))
                }
                className={inputClass}
                aria-label="To hour (UTC)"
              />
            </>
          )}
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
