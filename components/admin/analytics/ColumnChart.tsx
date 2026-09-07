// Small inline-SVG column chart for the Analytics dashboard boxes. One series,
// no axes or gridlines: with a handful of columns the value on each cap IS
// the axis. Past periods sit in the de-emphasis gray and the highlighted
// period (normally the current, partial one) carries the accent, so the eye
// lands on "now" and reads the rest as context. Server-safe, no hooks.

type Props = {
  values: number[];
  // Same length as values; drawn under each column.
  labels: string[];
  // Which column gets the accent (default: the last).
  highlightIndex?: number;
  // A label for the accessible title, e.g. "Active users".
  name: string;
  height?: number;
};

const COLUMN_MAX_WIDTH = 24;
const CAP_LABEL_H = 14;
const AXIS_LABEL_H = 16;

export function ColumnChart({
  values,
  labels,
  highlightIndex,
  name,
  height = 120,
}: Props) {
  const n = values.length;
  if (n === 0) return null;
  const hi = highlightIndex ?? n - 1;
  const max = Math.max(1, ...values);

  // Width is nominal; the SVG scales to its container via viewBox.
  const width = Math.max(160, n * 44);
  const slot = width / n;
  const colW = Math.min(COLUMN_MAX_WIDTH, slot * 0.6);
  const plotTop = CAP_LABEL_H;
  const plotBottom = height - AXIS_LABEL_H;
  const plotH = plotBottom - plotTop;

  const title = `${name}: ${values
    .map((v, i) => `${labels[i] ?? i + 1} ${v.toLocaleString("en-US")}`)
    .join(", ")}`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-auto w-full"
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      {/* Baseline: one hairline, recessive. */}
      <line
        x1={0}
        x2={width}
        y1={plotBottom + 0.5}
        y2={plotBottom + 0.5}
        stroke="#e4e4e7"
        strokeWidth={1}
      />
      {values.map((v, i) => {
        const x = slot * i + (slot - colW) / 2;
        const h = v === 0 ? 0 : Math.max(2, (v / max) * plotH);
        const y = plotBottom - h;
        const r = Math.min(4, h / 2);
        const accent = i === hi;
        // Rounded top, square at the baseline.
        const d =
          h === 0
            ? ""
            : `M${x} ${plotBottom} V${y + r} a${r} ${r} 0 0 1 ${r} -${r} H${x + colW - r} a${r} ${r} 0 0 1 ${r} ${r} V${plotBottom} Z`;
        return (
          <g key={i}>
            {d && <path d={d} fill={accent ? "#2563eb" : "#d4d4d8"} />}
            <text
              x={x + colW / 2}
              y={y - 4}
              textAnchor="middle"
              fontSize={11}
              fontFamily="var(--font-geist-mono), ui-monospace, monospace"
              fill={accent ? "#18181b" : "#71717a"}
            >
              {v.toLocaleString("en-US")}
            </text>
            <text
              x={x + colW / 2}
              y={height - 3}
              textAnchor="middle"
              fontSize={10}
              fill={accent ? "#18181b" : "#a1a1aa"}
            >
              {labels[i] ?? ""}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
