"use client";

// Window + denominator controls for the Feature adoption page. Every choice
// lives in the URL (?months=, ?to=, ?base=, ?range=, ?from=, resolved by
// lib/admin/adoption.ts resolveAdoptionWindow) so the server page computes
// the period keys and the view is shareable.
//
// Three families of window, in one select:
//   - trailing presets (last 5 minutes to last 72 hours), exact, from
//     usage_events; shared with the usage pages (WINDOW_PRESETS)
//   - month runs (one / 3 / 6 / all time) anchored by a month input
//   - a custom UTC hour range, two datetime inputs snapped to the hour, read
//     from the hour buckets

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AdoptionBase, AdoptionPreset } from "@/lib/admin/adoption";
import { WINDOW_PRESETS } from "@/lib/admin/usage-range";
import type { UsageRangeBounds } from "@/lib/admin/usage-range";

const MONTH_PRESETS = new Set<AdoptionPreset>(["1", "3", "6", "all"]);

const PRESETS: { value: AdoptionPreset; label: string }[] = [
  ...(Object.entries(WINDOW_PRESETS) as [AdoptionPreset, { label: string }][]).map(
    ([value, { label }]) => ({ value, label }),
  ),
  { value: "1", label: "One month" },
  { value: "3", label: "Last 3 months" },
  { value: "6", label: "Last 6 months" },
  { value: "all", label: "All time" },
  { value: "custom", label: "Custom range (UTC hours)" },
];

const BASES: { value: AdoptionBase; label: string }[] = [
  { value: "active", label: "of active users" },
  { value: "paid", label: "of paying users" },
  { value: "all", label: "of all accounts" },
];

type Props = {
  preset: AdoptionPreset;
  anchor: string; // YYYY-MM
  base: AdoptionBase;
  min: string; // earliest selectable month (epoch)
  max: string; // current month
  // Hour keys seeding the custom inputs, plus the span that has hour rows.
  from: string;
  to: string;
  bounds: UsageRangeBounds;
  basePath?: string;
};

const inputClass =
  "rounded-md border border-[var(--admin-border)] bg-white px-2 py-1 text-xs outline-none focus:border-zinc-400";

const toInputHour = (key: string) => `${key}:00`;
const fromInputHour = (value: string) => value.slice(0, 13);

export function AdoptionPicker({
  preset,
  anchor,
  base,
  min,
  max,
  from,
  to,
  bounds,
  basePath = "/admin/usage/features",
}: Props) {
  const router = useRouter();
  const [custom, setCustom] = useState(preset === "custom");
  const [draft, setDraft] = useState({
    from: toInputHour(from),
    to: toInputHour(to),
  });

  const push = (q: URLSearchParams) => {
    const qs = q.toString();
    router.push(qs ? `${basePath}?${qs}` : basePath);
  };

  const navigate = (next: {
    preset?: AdoptionPreset;
    anchor?: string;
    base?: AdoptionBase;
  }) => {
    const p = next.preset ?? preset;
    const a = next.anchor ?? anchor;
    const b = next.base ?? base;
    const q = new URLSearchParams();
    if (MONTH_PRESETS.has(p)) {
      if (p !== "1") q.set("months", p);
      if (a !== max) q.set("to", a);
    } else if (p === "custom") {
      // Base changes while a custom range is shown keep the range.
      q.set("from", fromInputHour(draft.from));
      q.set("to", fromInputHour(draft.to));
    } else {
      q.set("range", p);
    }
    if (b !== "active") q.set("base", b);
    push(q);
  };

  const onPreset = (value: AdoptionPreset) => {
    if (value === "custom") {
      setCustom(true);
      return;
    }
    setCustom(false);
    navigate({ preset: value });
  };

  const canApply = Boolean(draft.from && draft.to);
  const applyCustom = () => {
    if (!canApply) return;
    const q = new URLSearchParams();
    q.set("from", fromInputHour(draft.from));
    q.set("to", fromInputHour(draft.to));
    if (base !== "active") q.set("base", base);
    push(q);
  };

  const shown: AdoptionPreset = custom ? "custom" : preset;

  return (
    <div className="flex items-center gap-2">
      <select
        value={shown}
        onChange={(e) => onPreset(e.target.value as AdoptionPreset)}
        className={inputClass}
        aria-label="Window length"
      >
        {PRESETS.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>
      {MONTH_PRESETS.has(shown) && shown !== "all" && (
        <>
          <span className="text-xs text-zinc-400">ending</span>
          <input
            type="month"
            value={anchor}
            min={min}
            max={max}
            onChange={(e) => {
              if (e.target.value) navigate({ anchor: e.target.value });
            }}
            className={inputClass}
            aria-label="Last month in window"
          />
        </>
      )}
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
      <select
        value={base}
        onChange={(e) => navigate({ base: e.target.value as AdoptionBase })}
        className={inputClass}
        aria-label="Adoption denominator"
      >
        {BASES.map((b) => (
          <option key={b.value} value={b.value}>
            {b.label}
          </option>
        ))}
      </select>
    </div>
  );
}
