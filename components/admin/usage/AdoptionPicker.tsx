"use client";

// Window + denominator controls for the Feature adoption page. Every choice
// lives in the URL (?months=, ?to=, ?base=, resolved by
// lib/admin/adoption.ts resolveAdoptionWindow) so the server page computes
// the period keys and the view is shareable. Month granularity only: the
// activity counters are month buckets, so a day picker would promise a
// precision the data does not have.

import { useRouter } from "next/navigation";
import type { AdoptionBase, AdoptionPreset } from "@/lib/admin/adoption";

const PRESETS: { value: AdoptionPreset; label: string }[] = [
  { value: "1", label: "One month" },
  { value: "3", label: "Last 3 months" },
  { value: "6", label: "Last 6 months" },
  { value: "all", label: "All time" },
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
  basePath?: string;
};

const inputClass =
  "rounded-md border border-[var(--admin-border)] bg-white px-2 py-1 text-xs outline-none focus:border-zinc-400";

export function AdoptionPicker({
  preset,
  anchor,
  base,
  min,
  max,
  basePath = "/admin/usage/features",
}: Props) {
  const router = useRouter();

  const navigate = (next: {
    preset?: AdoptionPreset;
    anchor?: string;
    base?: AdoptionBase;
  }) => {
    const p = next.preset ?? preset;
    const a = next.anchor ?? anchor;
    const b = next.base ?? base;
    const q = new URLSearchParams();
    if (p !== "1") q.set("months", p);
    if (a !== max) q.set("to", a);
    if (b !== "active") q.set("base", b);
    const qs = q.toString();
    router.push(qs ? `${basePath}?${qs}` : basePath);
  };

  return (
    <div className="flex items-center gap-2">
      <select
        value={preset}
        onChange={(e) => navigate({ preset: e.target.value as AdoptionPreset })}
        className={inputClass}
        aria-label="Window length"
      >
        {PRESETS.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>
      {preset !== "all" && (
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
