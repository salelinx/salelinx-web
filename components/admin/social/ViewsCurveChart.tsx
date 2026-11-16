"use client";

// Views against hours since posting, one 2px line per video. Lines are
// coloured by experiment variant (fixed order, so B is always orange), or a
// grey line marks the typical video on a video's own page. A vertical
// crosshair snaps to the nearest hour and the tooltip lists every line there,
// so nobody has to aim at a 2px line. The members table under each chart is
// its table view.

import { useMemo, useRef, useState } from "react";
import { curveAt } from "@/lib/social/experiments";

// Categorical slots 1-5 of the reference palette, as CSS variables so the
// dark theme can swap in its own steps (app/admin/admin.css). A variant keeps
// its colour whatever else is shown.
export const VARIANT_COLORS: Record<string, string> = {
  A: "var(--viz-1)",
  B: "var(--viz-2)",
  C: "var(--viz-3)",
  D: "var(--viz-4)",
  E: "var(--viz-5)",
};
const BENCHMARK = "var(--admin-chart-faint)";
const GRID = "var(--admin-chart-grid)";
const AXIS = "var(--admin-chart-axis)";

export type CurveLine = {
  id: string;
  label: string;
  // A variant key, or "benchmark" for the typical-video line.
  series: string;
  curve: { h: number; views: number }[];
};

const W = 640;
const H = 240;
const PAD = { top: 12, right: 12, bottom: 26, left: 48 };

function niceMax(v: number): number {
  if (v <= 10) return 10;
  const mag = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * mag >= v) return m * mag;
  return 10 * mag;
}

const fmt = (n: number) =>
  n >= 10000 ? `${Math.round(n / 1000)}k` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n));

export function ViewsCurveChart({
  lines,
  maxHours,
  legend,
}: {
  lines: CurveLine[];
  maxHours: number;
  // Shown under the chart: one entry per series, e.g. A "Question hook".
  legend: { series: string; label: string }[];
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverH, setHoverH] = useState<number | null>(null);

  const yMax = useMemo(() => {
    let max = 0;
    for (const l of lines) for (const p of l.curve) if (p.h <= maxHours) max = Math.max(max, p.views);
    return niceMax(max);
  }, [lines, maxHours]);

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const x = (h: number) => PAD.left + (h / maxHours) * plotW;
  const y = (v: number) => PAD.top + plotH - (v / yMax) * plotH;
  const color = (series: string) => (series === "benchmark" ? BENCHMARK : (VARIANT_COLORS[series] ?? BENCHMARK));

  const xTicks = maxHours <= 72 ? [0, 6, 12, 24, 48, 72] : [0, 24, 48, 72, 96, 120, 144, 168];
  const yTicks = [0, yMax / 2, yMax];

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const box = svgRef.current?.getBoundingClientRect();
    if (!box) return;
    const vx = ((e.clientX - box.left) / box.width) * W;
    const h = Math.round(((vx - PAD.left) / plotW) * maxHours);
    setHoverH(h < 0 || h > maxHours ? null : h);
  }

  const readout =
    hoverH === null
      ? []
      : lines
          .map((l) => ({ l, v: curveAt(l.curve, hoverH) }))
          .filter((r): r is { l: CurveLine; v: number } => r.v !== null)
          .sort((a, b) => b.v - a.v);

  if (!lines.some((l) => l.curve.length > 1))
    return <p className="px-1 py-6 text-sm text-zinc-500">No hourly snapshots yet. They start with the first sync after a video goes up.</p>;

  return (
    <div className="space-y-2">
      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full touch-none select-none"
          role="img"
          aria-label={`Views over the first ${maxHours} hours for ${lines.length} videos`}
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={() => setHoverH(null)}
        >
          {yTicks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(t) + 0.5} y2={y(t) + 0.5} stroke={GRID} />
              <text x={PAD.left - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill={AXIS}>
                {fmt(t)}
              </text>
            </g>
          ))}
          {xTicks.map((t) => (
            <text key={t} x={x(t)} y={H - 8} textAnchor="middle" fontSize={11} fill={AXIS}>
              {t === 0 ? "0" : t % 24 === 0 && maxHours > 72 ? `${t / 24}d` : `${t}h`}
            </text>
          ))}
          {/* Benchmark first, so the variants draw over it. */}
          {[...lines]
            .sort((a, b) => (a.series === "benchmark" ? -1 : b.series === "benchmark" ? 1 : 0))
            .map((l) => {
              const pts = l.curve.filter((p) => p.h <= maxHours);
              if (pts.length < 2) return null;
              return (
                <polyline
                  key={l.id}
                  points={pts.map((p) => `${x(p.h)},${y(p.views)}`).join(" ")}
                  fill="none"
                  stroke={color(l.series)}
                  strokeWidth={2}
                  strokeDasharray={l.series === "benchmark" ? "4 3" : undefined}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              );
            })}
          {hoverH !== null && (
            <g>
              <line x1={x(hoverH)} x2={x(hoverH)} y1={PAD.top} y2={PAD.top + plotH} stroke="var(--admin-chart-crosshair)" strokeWidth={1} />
              {readout.map(({ l, v }) => (
                <circle key={l.id} cx={x(hoverH)} cy={y(v)} r={4} fill={color(l.series)} stroke="var(--admin-surface)" strokeWidth={2} />
              ))}
            </g>
          )}
        </svg>
        {hoverH !== null && readout.length > 0 && (
          <div
            className="pointer-events-none absolute top-2 z-10 max-w-64 rounded-md border border-[var(--admin-border)] bg-white px-2.5 py-2 text-xs shadow-md"
            style={x(hoverH) > W / 2 ? { right: `${100 - (x(hoverH) / W) * 100 + 2}%` } : { left: `${(x(hoverH) / W) * 100 + 2}%` }}
          >
            <p className="mb-1 text-zinc-500">{hoverH < 48 ? `${hoverH}h` : `${(hoverH / 24).toFixed(1)}d`} after posting</p>
            {readout.slice(0, 8).map(({ l, v }) => (
              <p key={l.id} className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: color(l.series) }} />
                <span className="font-semibold tabular-nums text-zinc-900">{Math.round(v).toLocaleString("en-GB")}</span>
                <span className="truncate text-zinc-500">{l.label}</span>
              </p>
            ))}
          </div>
        )}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600">
        {legend.map((g) => (
          <li key={g.series} className="flex items-center gap-1.5">
            <span
              className="inline-block w-4"
              style={{ borderTop: `2px ${g.series === "benchmark" ? "dashed" : "solid"} ${color(g.series)}` }}
            />
            {g.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
