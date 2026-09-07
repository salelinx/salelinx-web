// Tiny inline-SVG sparkline for the admin console. One series, no axes: the
// line sits in the de-emphasis gray and only the latest point carries the
// accent, so the eye lands on "where are we now" rather than the whole shape.
// Pure presentation; the values and their labels are passed in and the point
// list is repeated in a <title> so the numbers are reachable without hover.

type Props = {
  values: number[];
  // Same length as values; used for the accessible title ("Apr 3, May 5").
  labels?: string[];
  width?: number;
  height?: number;
  // Rendered before the point list in the title, e.g. "Users".
  name?: string;
};

export function Sparkline({
  values,
  labels,
  width = 84,
  height = 24,
  name,
}: Props) {
  const n = values.length;
  const pad = 4;
  const max = Math.max(0, ...values);

  const points = values.map((v, i) => {
    const x = n === 1 ? width / 2 : pad + (i / (n - 1)) * (width - 2 * pad);
    const y =
      max === 0 ? height - pad : pad + (1 - v / max) * (height - 2 * pad);
    return [x, y] as const;
  });
  const d = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(" ");
  const last = points[n - 1];

  const title = values
    .map((v, i) => `${labels?.[i] ?? i + 1} ${v.toLocaleString("en-US")}`)
    .join(", ");

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={name ? `${name}: ${title}` : title}
      className="shrink-0 overflow-visible"
    >
      <title>{name ? `${name}: ${title}` : title}</title>
      {n > 1 && (
        <path
          d={d}
          fill="none"
          stroke="#a1a1aa"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}
      {last && (
        <circle
          cx={last[0]}
          cy={last[1]}
          r={3.5}
          fill="#2563eb"
          stroke="#ffffff"
          strokeWidth={2}
        />
      )}
    </svg>
  );
}
