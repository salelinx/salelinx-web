"use client";

// The Stats pages' charts, inline SVG drawn at the container's own width
// so text stays at its real size on a phone. Thin marks, hairline solid grids,
// 4px rounded data ends with a 2px surface gap between stacked parts, a 2px
// surface ring on dots, and a hover readout on every mark. Colours are CSS
// variables (app/admin/admin.css), so the light/dark switch repaints them;
// each chart's numbers are also in its card's Table view.

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { indexCellClass } from "@/components/admin/social/IndexBadge";
import { formatIndex } from "@/lib/social/overview";

/** A share of 0 to 1 as a CSS percentage, rounded so the server and browser write the same string. */
const cssPct = (f: number) => `${Math.round(f * 10000) / 100}%`;

/** Tick labels on a doubling scale: 1/16x, 0.25x, 0.5x, 2x, 32x. */
export const indexTick = (x: number) =>
  x >= 0.25 ? `${Number(x.toFixed(2))}x` : `1/${Math.round(1 / x)}x`;

const GRID = "var(--admin-chart-grid)";
const AXIS = "var(--admin-chart-axis)";
const FAINT = "var(--admin-chart-faint)";

/** The element's width, following resizes; `fallback` until it is measured. */
function useWidth<T extends HTMLElement>(
  fallback = 640,
): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(Math.round(w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

/** Round tick values covering min..max, about `count` steps apart. */
export function niceTicks(
  min: number,
  max: number,
  count = 4,
  integer = false,
): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
  if (max <= min) max = min + (integer ? 1 : Math.abs(min) || 1);
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  let step =
    [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  if (integer) step = Math.max(1, Math.round(step));
  const lo = Math.floor(min / step + 1e-9) * step;
  const hi = Math.ceil(max / step - 1e-9) * step;
  const out: number[] = [];
  for (let i = 0; lo + i * step <= hi + step / 1e6; i++)
    out.push(Number((lo + i * step).toFixed(10)));
  return out;
}

function Tooltip({
  x,
  width,
  top = 8,
  children,
}: {
  x: number;
  width: number;
  top?: number;
  children: ReactNode;
}) {
  const right = x > width / 2;
  return (
    <div
      className="pointer-events-none absolute z-10 min-w-36 max-w-64 rounded-md border border-[var(--admin-border)] bg-white px-2.5 py-2 text-xs shadow-md"
      style={right ? { right: width - x + 10, top } : { left: x + 10, top }}
    >
      {children}
    </div>
  );
}

function Swatch({ color }: { color: string }) {
  return (
    <span
      className="inline-block h-2 w-2 shrink-0 rounded-sm"
      style={{ background: color }}
    />
  );
}

export type ColumnSeries = {
  key: string;
  label: string;
  color: string;
  values: number[];
};

/**
 * Columns per label, the series stacked on each (negatives below zero, for net
 * followers). Hover a column for every series' value there.
 */
export function StackedColumns({
  labels,
  series,
  format,
  name,
  height = 200,
  tickLabel = (l) => l,
  tooltipLabel = (l) => l,
  integer = false,
  legend,
}: {
  labels: string[];
  series: ColumnSeries[];
  format: (n: number) => string;
  name: string;
  height?: number;
  tickLabel?: (l: string) => string;
  tooltipLabel?: (l: string) => string;
  integer?: boolean;
  // Defaults to a swatch per series when there are two or more.
  legend?: ReactNode;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const n = labels.length;
  if (!n) return null;

  const sumAt = (i: number, sign: 1 | -1) =>
    series.reduce(
      (s, se) => s + (Math.sign(se.values[i] ?? 0) === sign ? se.values[i] : 0),
      0,
    );
  const pos = labels.map((_, i) => sumAt(i, 1));
  const neg = labels.map((_, i) => sumAt(i, -1));
  const ticks = niceTicks(Math.min(0, ...neg), Math.max(0, ...pos), 4, integer);
  const lo = ticks[0];
  const hi = ticks[ticks.length - 1];

  const pad = { top: 10, right: 6, bottom: 22, left: 46 };
  const plotW = Math.max(40, width - pad.left - pad.right);
  const plotH = height - pad.top - pad.bottom;
  const y = (v: number) => pad.top + ((hi - v) / (hi - lo || 1)) * plotH;
  const slot = plotW / n;
  const colW = Math.max(1, Math.min(24, slot * 0.72));
  const left = (i: number) => pad.left + slot * i + (slot - colW) / 2;
  const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(plotW / 64))));

  const shapes: ReactNode[] = [];
  labels.forEach((_, i) => {
    const x = left(i);
    for (const sign of [1, -1] as const) {
      const parts = series.filter(
        (se) => Math.sign(se.values[i] ?? 0) === sign,
      );
      let acc = 0;
      parts.forEach((se, j) => {
        const v = se.values[i];
        const a = y(acc);
        const b = y(acc + v);
        acc += v;
        // A 2px surface gap between this part and the one it sits on.
        const gap = j > 0 ? 2 : 0;
        const top = Math.min(a, b);
        const h = Math.abs(a - b) - gap;
        if (h <= 0.5) return;
        const end = j === parts.length - 1;
        const r = end ? Math.min(4, h / 2, colW / 2) : 0;
        const y0 = sign === 1 ? top : top + gap;
        const d =
          sign === 1
            ? `M${x} ${y0 + h} V${y0 + r} a${r} ${r} 0 0 1 ${r} -${r} H${x + colW - r} a${r} ${r} 0 0 1 ${r} ${r} V${y0 + h} Z`
            : `M${x} ${y0} V${y0 + h - r} a${r} ${r} 0 0 0 ${r} ${r} H${x + colW - r} a${r} ${r} 0 0 0 ${r} -${r} V${y0} Z`;
        shapes.push(
          <path
            key={`${i}-${se.key}`}
            d={d}
            fill={se.color}
            opacity={hover === null || hover === i ? 1 : 0.55}
          />,
        );
      });
    }
  });

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const i = Math.floor((e.clientX - box.left - pad.left) / slot);
    setHover(i >= 0 && i < n ? i : null);
  }

  const total =
    hover === null
      ? 0
      : series.reduce((s, se) => s + (se.values[hover] ?? 0), 0);

  return (
    <div className="space-y-2">
      <div ref={ref} className="relative">
        <div className="overflow-hidden">
          <svg
            width={width}
            height={height}
            className="block touch-none select-none"
            role="img"
            aria-label={name}
            onPointerMove={onMove}
            onPointerDown={onMove}
            onPointerLeave={() => setHover(null)}
          >
            {ticks.map((t) => (
              <g key={t}>
                <line
                  x1={pad.left}
                  x2={width - pad.right}
                  y1={Math.round(y(t)) + 0.5}
                  y2={Math.round(y(t)) + 0.5}
                  stroke={t === 0 ? FAINT : GRID}
                />
                <text
                  x={pad.left - 6}
                  y={y(t) + 4}
                  textAnchor="end"
                  fontSize={11}
                  fill={AXIS}
                  className="tabular-nums"
                >
                  {format(t)}
                </text>
              </g>
            ))}
            {hover !== null && (
              <rect
                x={pad.left + slot * hover}
                y={pad.top}
                width={slot}
                height={plotH}
                fill={GRID}
                opacity={0.6}
              />
            )}
            {shapes}
            {labels.map((l, i) =>
              // Every `every`th label, plus the last when it clears the one before.
              i % every === 0 ||
              (i === n - 1 && (n - 1) % every >= every / 2) ? (
                <text
                  key={l}
                  x={left(i) + colW / 2}
                  y={height - 6}
                  textAnchor="middle"
                  fontSize={11}
                  fill={AXIS}
                >
                  {tickLabel(l)}
                </text>
              ) : null,
            )}
          </svg>
        </div>
        {hover !== null && (
          <Tooltip x={left(hover) + colW / 2} width={width}>
            <p className="mb-1 text-zinc-500">{tooltipLabel(labels[hover])}</p>
            {series.length > 1 && (
              <p className="mb-1 flex justify-between gap-3 font-semibold text-zinc-900">
                <span>Total</span>
                <span className="tabular-nums">{format(total)}</span>
              </p>
            )}
            {series.map((se) => (
              <p key={se.key} className="flex items-center gap-1.5">
                <Swatch color={se.color} />
                <span className="truncate text-zinc-600">{se.label}</span>
                <span className="ml-auto pl-3 font-medium tabular-nums text-zinc-900">
                  {format(se.values[hover] ?? 0)}
                </span>
              </p>
            ))}
          </Tooltip>
        )}
      </div>
      {legend ??
        (series.length > 1 && (
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600">
            {series.map((se) => (
              <li key={se.key} className="flex items-center gap-1.5">
                <Swatch color={se.color} />
                {se.label}
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}

export type LineSeries = {
  key: string;
  label: string;
  color: string;
  values: (number | null)[];
};

/**
 * Lines over evenly spaced labels, with a crosshair that snaps to the nearest
 * one and lists every line there. `fit` zooms the y axis to the data (for
 * follower counts, which move little against their size); otherwise it starts
 * at zero.
 */
export function LineChart({
  labels,
  series,
  format,
  name,
  height = 200,
  tickLabel = (l) => l,
  tooltipLabel = (l) => l,
  fit = false,
  area = false,
  integer = false,
  legend,
}: {
  labels: string[];
  series: LineSeries[];
  format: (n: number) => string;
  name: string;
  height?: number;
  tickLabel?: (l: string) => string;
  tooltipLabel?: (l: string) => string;
  fit?: boolean;
  // A 10% wash under a single line.
  area?: boolean;
  // Whole-number ticks, for counts.
  integer?: boolean;
  legend?: ReactNode;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const n = labels.length;
  const all = series
    .flatMap((s) => s.values)
    .filter((v): v is number => v !== null && Number.isFinite(v));
  if (!n || !all.length)
    return (
      <p className="py-6 text-center text-sm text-zinc-500">No figures yet.</p>
    );

  const min = Math.min(...all);
  const max = Math.max(...all);
  const spread = max - min || Math.abs(max) * 0.1 || 1;
  // Zoomed in, but never below zero for numbers that can't be negative.
  const floor = min >= 0 ? Math.max(0, min - spread * 0.1) : min - spread * 0.1;
  const ticks = fit
    ? niceTicks(floor, max + spread * 0.1, 3, integer)
    : niceTicks(Math.min(0, min), max, 4, integer);
  const lo = ticks[0];
  const hi = ticks[ticks.length - 1];

  const pad = { top: 10, right: 14, bottom: 22, left: 50 };
  const plotW = Math.max(40, width - pad.left - pad.right);
  const plotH = height - pad.top - pad.bottom;
  const x = (i: number) =>
    pad.left + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v: number) => pad.top + ((hi - v) / (hi - lo || 1)) * plotH;
  const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(plotW / 64))));

  const runs = (values: (number | null)[]) => {
    const out: { i: number; v: number }[][] = [];
    let cur: { i: number; v: number }[] = [];
    values.forEach((v, i) => {
      if (v === null || !Number.isFinite(v)) {
        if (cur.length) out.push(cur);
        cur = [];
      } else cur.push({ i, v });
    });
    if (cur.length) out.push(cur);
    return out;
  };

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const i =
      n === 1
        ? 0
        : Math.round(((e.clientX - box.left - pad.left) / plotW) * (n - 1));
    setHover(i >= 0 && i < n ? i : null);
  }

  const readout =
    hover === null
      ? []
      : series
          .map((s) => ({ s, v: s.values[hover] }))
          .filter(
            (r): r is { s: LineSeries; v: number } =>
              r.v !== null && r.v !== undefined,
          )
          .sort((a, b) => b.v - a.v);

  return (
    <div className="space-y-2">
      <div ref={ref} className="relative">
        <div className="overflow-hidden">
          <svg
            width={width}
            height={height}
            className="block touch-none select-none"
            role="img"
            aria-label={name}
            onPointerMove={onMove}
            onPointerDown={onMove}
            onPointerLeave={() => setHover(null)}
          >
            {ticks.map((t) => (
              <g key={t}>
                <line
                  x1={pad.left}
                  x2={width - pad.right}
                  y1={Math.round(y(t)) + 0.5}
                  y2={Math.round(y(t)) + 0.5}
                  stroke={GRID}
                />
                <text
                  x={pad.left - 6}
                  y={y(t) + 4}
                  textAnchor="end"
                  fontSize={11}
                  fill={AXIS}
                >
                  {format(t)}
                </text>
              </g>
            ))}
            {labels.map((l, i) =>
              i % every === 0 ? (
                <text
                  key={l}
                  x={x(i)}
                  y={height - 6}
                  textAnchor="middle"
                  fontSize={11}
                  fill={AXIS}
                >
                  {tickLabel(l)}
                </text>
              ) : null,
            )}
            {series.map((s) =>
              runs(s.values).map((run, k) => {
                const pts = run.map((p) => `${x(p.i)},${y(p.v)}`).join(" ");
                return (
                  <g key={`${s.key}-${k}`}>
                    {area && series.length === 1 && run.length > 1 && (
                      <polygon
                        points={`${x(run[0].i)},${y(Math.max(lo, 0))} ${pts} ${x(run[run.length - 1].i)},${y(Math.max(lo, 0))}`}
                        fill={s.color}
                        opacity={0.1}
                      />
                    )}
                    {run.length > 1 ? (
                      <polyline
                        points={pts}
                        fill="none"
                        stroke={s.color}
                        strokeWidth={2}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                      />
                    ) : (
                      <circle
                        cx={x(run[0].i)}
                        cy={y(run[0].v)}
                        r={2.5}
                        fill={s.color}
                      />
                    )}
                  </g>
                );
              }),
            )}
            {series.map((s) => {
              const last = [...s.values.keys()]
                .reverse()
                .find((i) => s.values[i] !== null);
              if (last === undefined) return null;
              return (
                <circle
                  key={s.key}
                  cx={x(last)}
                  cy={y(s.values[last]!)}
                  r={4}
                  fill={s.color}
                  stroke="var(--admin-surface)"
                  strokeWidth={2}
                />
              );
            })}
            {hover !== null && (
              <g>
                <line
                  x1={x(hover)}
                  x2={x(hover)}
                  y1={pad.top}
                  y2={pad.top + plotH}
                  stroke="var(--admin-chart-crosshair)"
                />
                {readout.map(({ s, v }) => (
                  <circle
                    key={s.key}
                    cx={x(hover)}
                    cy={y(v)}
                    r={4}
                    fill={s.color}
                    stroke="var(--admin-surface)"
                    strokeWidth={2}
                  />
                ))}
              </g>
            )}
          </svg>
        </div>
        {hover !== null && readout.length > 0 && (
          <Tooltip x={x(hover)} width={width}>
            <p className="mb-1 text-zinc-500">{tooltipLabel(labels[hover])}</p>
            {readout.map(({ s, v }) => (
              <p key={s.key} className="flex items-center gap-1.5">
                <Swatch color={s.color} />
                <span className="truncate text-zinc-600">{s.label}</span>
                <span className="ml-auto pl-3 font-medium tabular-nums text-zinc-900">
                  {format(v)}
                </span>
              </p>
            ))}
          </Tooltip>
        )}
      </div>
      {legend ??
        (series.length > 1 && (
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600">
            {series.map((s) => (
              <li key={s.key} className="flex items-center gap-1.5">
                <span
                  className="inline-block w-4"
                  style={{ borderTop: `2px solid ${s.color}` }}
                />
                {s.label}
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}

export type Dot = {
  key: string;
  value: number;
  color: string;
  label: string;
  sub?: string;
  href?: string;
};
export type DotRow = {
  key: string;
  label: ReactNode;
  dots: Dot[];
  median: number | null;
  right?: ReactNode;
};
export type DotScale = { kind: "log" | "linear"; min: number; max: number };

/** A spread of 0 to 1 for where a value sits on the scale. */
function place(v: number, s: DotScale): number {
  const f =
    s.kind === "log"
      ? (Math.log(Math.max(v, s.min)) - Math.log(s.min)) /
        (Math.log(s.max) - Math.log(s.min))
      : (v - s.min) / (s.max - s.min || 1);
  return Math.max(0, Math.min(1, f));
}

// The same post always sits at the same height, so dots that share a value don't hide each other.
function jitter(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return Math.round(((Math.abs(h) % 1000) / 1000 - 0.5) * 160) / 10;
}

/**
 * One row per group: a dot per post, a dark bar at the group's median, and an
 * optional faint reference line (1.0x, or everything's median). Hover or focus
 * a dot for the post; it links to the video's page.
 */
export function DotRows({
  rows,
  scale,
  format,
  ticks,
  reference,
  tickFormat,
  rightClass = "sm:w-56",
}: {
  rows: DotRow[];
  scale: DotScale;
  format: (x: number) => string;
  ticks: number[];
  // Defaults to `format`.
  tickFormat?: (x: number) => string;
  reference?: { value: number; label: string };
  // Fixed width for the right-hand column, so the strips line up with the ticks.
  rightClass?: string;
}) {
  const [hover, setHover] = useState<{ row: string; dot: Dot } | null>(null);
  const pct = (v: number) => cssPct(place(v, scale));
  return (
    <div className="space-y-1">
      {rows.map((r) => (
        <div
          key={r.key}
          className="flex flex-col gap-x-3 gap-y-0.5 border-b border-[var(--admin-border)] pb-1 last:border-b-0 sm:flex-row sm:items-center"
        >
          <div className="min-w-0 text-sm sm:w-40 sm:shrink-0">{r.label}</div>
          <div className="relative h-10 w-full min-w-0 shrink-0 sm:w-auto sm:flex-1">
            {reference && (
              <span
                className="absolute inset-y-1 w-px bg-zinc-300"
                style={{ left: pct(reference.value) }}
                aria-hidden
              />
            )}
            {r.dots.map((d) => {
              const body = (
                <span
                  className="block h-3 w-3 rounded-full ring-2 ring-[var(--admin-surface)]"
                  style={{ background: d.color }}
                />
              );
              const props = {
                className:
                  "absolute flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full hover:scale-125 focus:scale-125 focus:outline-none",
                style: {
                  left: pct(d.value),
                  top: `calc(50% + ${jitter(d.key)}px)`,
                },
                onMouseEnter: () => setHover({ row: r.key, dot: d }),
                onMouseLeave: () => setHover(null),
                onFocus: () => setHover({ row: r.key, dot: d }),
                onBlur: () => setHover(null),
                "aria-label": `${d.label}: ${format(d.value)}`,
              };
              return d.href ? (
                <Link key={d.key} href={d.href} {...props}>
                  {body}
                </Link>
              ) : (
                <span key={d.key} tabIndex={0} {...props}>
                  {body}
                </span>
              );
            })}
            {r.median !== null && (
              <span
                className="pointer-events-none absolute inset-y-1.5 w-0.5 -translate-x-1/2 rounded bg-zinc-900"
                style={{ left: pct(r.median) }}
                aria-hidden
              />
            )}
            {hover?.row === r.key && (
              <div
                className="pointer-events-none absolute bottom-full z-10 mb-1 max-w-64 -translate-x-1/2 rounded-md border border-[var(--admin-border)] bg-white px-2.5 py-1.5 text-xs shadow-md"
                style={{
                  left: `clamp(6rem, ${pct(hover.dot.value)}, calc(100% - 6rem))`,
                }}
              >
                <p className="line-clamp-2 font-medium text-zinc-900">
                  {hover.dot.label}
                </p>
                <p className="text-zinc-500">
                  {format(hover.dot.value)}
                  {hover.dot.sub ? ` · ${hover.dot.sub}` : ""}
                </p>
              </div>
            )}
          </div>
          <div className={`text-xs sm:shrink-0 ${rightClass}`}>{r.right}</div>
        </div>
      ))}
      <div className="flex gap-x-3 text-[11px] text-zinc-500">
        <div className="hidden sm:block sm:w-40 sm:shrink-0" />
        <div className="relative h-4 flex-1">
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute -translate-x-1/2 tabular-nums"
              style={{ left: pct(t) }}
            >
              {reference && Math.abs(t - reference.value) < 1e-9
                ? reference.label
                : (tickFormat ?? format)(t)}
            </span>
          ))}
        </div>
        <div className={`hidden sm:block sm:shrink-0 ${rightClass}`} />
      </div>
    </div>
  );
}

/**
 * A grid of cells, each a median index with the number of posts behind it.
 * Cells with fewer than `minN` posts are greyed: too few to read anything into.
 */
export function Heatmap({
  rows,
  cols,
  cell,
  minN = 3,
}: {
  rows: string[];
  cols: string[];
  cell: (row: string, col: string) => { value: number | null; n: number };
  minN?: number;
}) {
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-separate border-spacing-[3px] text-xs">
          <thead>
            <tr>
              <th />
              {cols.map((c) => (
                <th
                  key={c}
                  className="pb-1 text-center font-medium text-zinc-500"
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r}>
                <th className="pr-2 text-left font-medium text-zinc-500">
                  {r}
                </th>
                {cols.map((c) => {
                  const { value, n } = cell(r, c);
                  const solid = value !== null && n >= minN;
                  return (
                    <td
                      key={c}
                      title={`${r} ${c}: ${value === null ? "no posts" : `${formatIndex(value)} from ${n} post${n === 1 ? "" : "s"}`}`}
                      className={`h-12 rounded-md text-center align-middle ${
                        solid
                          ? indexCellClass(value)
                          : "border border-dashed border-[var(--admin-border)] text-zinc-400"
                      }`}
                    >
                      <span className="block text-sm font-semibold tabular-nums">
                        {value === null ? "" : formatIndex(value)}
                      </span>
                      <span
                        className={`block text-[10px] ${solid ? "opacity-80" : ""}`}
                      >
                        {n ? `${n} post${n === 1 ? "" : "s"}` : ""}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <IndexScaleKey minN={minN} />
    </div>
  );
}

export function IndexScaleKey({ minN = 3 }: { minN?: number }) {
  const steps: [number, string][] = [
    [0.5, "Under 0.67x"],
    [0.8, "0.67 to 0.9x"],
    [1, "Typical"],
    [1.2, "1.1 to 1.5x"],
    [2, "1.5x and up"],
  ];
  return (
    <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-500">
      {steps.map(([v, label]) => (
        <li key={label} className="flex items-center gap-1.5">
          <span
            className={`inline-block h-3 w-5 rounded-sm ${indexCellClass(v)}`}
          />
          {label}
        </li>
      ))}
      <li className="flex items-center gap-1.5">
        <span className="inline-block h-3 w-5 rounded-sm border border-dashed border-zinc-400" />
        Under {minN} posts
      </li>
    </ul>
  );
}

/**
 * Columns that rise above typical (1.0x) or drop below it, on a doubling
 * scale so 2x and 0.5x are the same height. Greyed under `minN` posts.
 */
export function IndexColumns({
  items,
  name,
  minN = 3,
  height = 200,
}: {
  items: { label: string; median: number | null; n: number }[];
  name: string;
  minN?: number;
  height?: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const n = items.length;
  if (!n) return null;
  const logs = items.map((it) =>
    it.median !== null && it.median > 0 ? Math.log2(it.median) : null,
  );
  const reach = Math.min(
    3,
    Math.max(1, Math.ceil(Math.max(0, ...logs.map((l) => Math.abs(l ?? 0))))),
  );

  const pad = { top: 18, right: 6, bottom: 34, left: 46 };
  const plotW = Math.max(40, width - pad.left - pad.right);
  const plotH = height - pad.top - pad.bottom;
  const y = (l: number) => pad.top + ((reach - l) / (2 * reach)) * plotH;
  const slot = plotW / n;
  const colW = Math.max(2, Math.min(24, slot * 0.6));
  const left = (i: number) => pad.left + slot * i + (slot - colW) / 2;
  const ticks = Array.from({ length: 2 * reach + 1 }, (_, i) => reach - i);
  const showEvery = Math.max(
    1,
    Math.ceil(n / Math.max(2, Math.floor(plotW / 44))),
  );

  return (
    <div ref={ref} className="relative">
      <div className="overflow-hidden">
        <svg
          width={width}
          height={height}
          className="block select-none"
          role="img"
          aria-label={name}
          onPointerLeave={() => setHover(null)}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={pad.left}
                x2={width - pad.right}
                y1={Math.round(y(t)) + 0.5}
                y2={Math.round(y(t)) + 0.5}
                stroke={t === 0 ? FAINT : GRID}
              />
              <text
                x={pad.left - 6}
                y={y(t) + 4}
                textAnchor="end"
                fontSize={11}
                fill={AXIS}
              >
                {t === 0 ? "typical" : indexTick(2 ** t)}
              </text>
            </g>
          ))}
          {items.map((it, i) => {
            const l = logs[i];
            const x = left(i);
            const solid = l !== null && it.n >= minN;
            const fill = !solid
              ? "var(--admin-chart-column)"
              : it.median! >= 1.1
                ? "var(--color-blue-500)"
                : it.median! <= 0.9
                  ? "var(--color-orange-500)"
                  : FAINT;
            let shape: ReactNode = null;
            if (l !== null) {
              const top = Math.min(y(l), y(0));
              const h = Math.max(2, Math.abs(y(l) - y(0)));
              const r = Math.min(4, h / 2, colW / 2);
              const d =
                l >= 0
                  ? `M${x} ${top + h} V${top + r} a${r} ${r} 0 0 1 ${r} -${r} H${x + colW - r} a${r} ${r} 0 0 1 ${r} ${r} V${top + h} Z`
                  : `M${x} ${top} V${top + h - r} a${r} ${r} 0 0 0 ${r} ${r} H${x + colW - r} a${r} ${r} 0 0 0 ${r} -${r} V${top} Z`;
              shape = (
                <path
                  d={d}
                  fill={fill}
                  opacity={hover === null || hover === i ? 1 : 0.55}
                />
              );
            }
            const labelled = i % showEvery === 0;
            return (
              <g key={it.label} onPointerEnter={() => setHover(i)}>
                <rect
                  x={pad.left + slot * i}
                  y={pad.top}
                  width={slot}
                  height={plotH + pad.bottom}
                  fill="transparent"
                />
                {shape}
                {l !== null && solid && slot >= 30 && (
                  <text
                    x={x + colW / 2}
                    y={l >= 0 ? y(l) - 4 : y(l) + 12}
                    textAnchor="middle"
                    fontSize={10}
                    fill="var(--admin-chart-label)"
                    className="tabular-nums"
                  >
                    {formatIndex(it.median)}
                  </text>
                )}
                {labelled && (
                  <>
                    <text
                      x={x + colW / 2}
                      y={height - 18}
                      textAnchor="middle"
                      fontSize={11}
                      fill={AXIS}
                    >
                      {it.label}
                    </text>
                    <text
                      x={x + colW / 2}
                      y={height - 5}
                      textAnchor="middle"
                      fontSize={10}
                      fill={FAINT}
                    >
                      {it.n}
                    </text>
                  </>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      {hover !== null && (
        <Tooltip x={left(hover) + colW / 2} width={width}>
          <p className="font-medium text-zinc-900">{items[hover].label}</p>
          <p className="text-zinc-600">
            {items[hover].median === null
              ? "No posts"
              : `${formatIndex(items[hover].median)} from ${items[hover].n} post${items[hover].n === 1 ? "" : "s"}`}
            {items[hover].n > 0 && items[hover].n < minN
              ? ", too few to read into"
              : ""}
          </p>
        </Tooltip>
      )}
      <p className="mt-1 text-[11px] text-zinc-400">
        Median post against typical; the small number is how many posts. Grey:
        under {minN}.
      </p>
    </div>
  );
}

export type Segment = {
  key: string;
  label: string;
  value: number;
  color: string;
  ink: "light" | "dark";
};

/** One whole split into parts: shares printed inside the parts wide enough to hold them. */
export function SegmentedBar({
  parts,
  format,
  name,
}: {
  parts: Segment[];
  format: (n: number) => string;
  name: string;
}) {
  const total = parts.reduce((s, p) => s + Math.max(0, p.value), 0);
  if (total <= 0) return <p className="text-xs text-zinc-500">Nothing yet.</p>;
  const shown = parts.filter((p) => p.value > 0);
  return (
    <div className="space-y-2">
      <div
        className="flex h-7 w-full gap-[2px]"
        role="img"
        aria-label={`${name}: ${shown.map((p) => `${p.label} ${format(p.value)}`).join(", ")}`}
      >
        {shown.map((p) => {
          const share = p.value / total;
          return (
            <div
              key={p.key}
              tabIndex={0}
              title={`${p.label}: ${format(p.value)} (${Math.round(share * 100)}%)`}
              className="flex min-w-[3px] items-center overflow-hidden rounded px-1.5 text-[11px] font-semibold focus:outline-2 focus:outline-zinc-900"
              style={{
                width: cssPct(share),
                background: p.color,
                color: p.ink === "light" ? "#ffffff" : "#18181b",
              }}
            >
              {share >= 0.1 && `${Math.round(share * 100)}%`}
            </div>
          );
        })}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600">
        {shown.map((p) => (
          <li key={p.key} className="flex items-center gap-1.5">
            <Swatch color={p.color} />
            {p.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A thin bar under a number in a table, against the column's largest. */
export function InlineBar({
  value,
  max,
  color = "var(--admin-chart-accent)",
}: {
  value: number | null;
  max: number;
  color?: string;
}) {
  if (value === null || max <= 0) return null;
  return (
    <span className="mt-0.5 block h-1 w-full rounded-full bg-zinc-100">
      <span
        className="block h-1 rounded-full"
        style={{
          width: cssPct(Math.max(0.02, value / max)),
          background: color,
        }}
      />
    </span>
  );
}
