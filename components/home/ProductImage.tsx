import type { CSSProperties } from 'react';

export type ProductType =
  | 'sneaker'
  | 'boots'
  | 'tee'
  | 'jacket'
  | 'jeans'
  | 'jumper';

interface Silhouette {
  viewBox: string;
  paths: { d: string; opacity?: number }[];
  details?: { d: string; strokeWidth?: number }[];
}

// Hand-tuned silhouettes. Stroke details overlaid in white for highlights.
const SILHOUETTES: Record<ProductType, Silhouette> = {
  sneaker: {
    viewBox: '0 0 100 60',
    paths: [
      {
        d: 'M5 47 C 6 40, 16 36, 32 33 L 64 28 C 76 28, 88 32, 93 41 L 93 50 C 93 53, 89 55, 82 55 L 12 55 C 8 55, 5 51, 5 47 Z',
      },
    ],
    details: [
      { d: 'M5 52 L93 52', strokeWidth: 2 },
      { d: 'M32 38 L42 36', strokeWidth: 1.5 },
      { d: 'M44 35 L54 33', strokeWidth: 1.5 },
      { d: 'M56 32 L66 31', strokeWidth: 1.5 },
    ],
  },
  boots: {
    viewBox: '0 0 100 80',
    paths: [
      {
        d: 'M28 8 L62 8 L65 50 L92 52 L92 67 L88 72 L10 72 L6 67 L6 56 L22 50 Z',
      },
    ],
    details: [
      { d: 'M6 65 L92 65', strokeWidth: 2 },
      { d: 'M34 22 L56 22', strokeWidth: 1.5 },
      { d: 'M34 32 L56 32', strokeWidth: 1.5 },
      { d: 'M34 42 L56 42', strokeWidth: 1.5 },
    ],
  },
  tee: {
    viewBox: '0 0 100 80',
    paths: [
      {
        d: 'M30 14 L42 4 L58 4 L70 14 L86 24 L82 38 L72 34 L72 76 L28 76 L28 34 L18 38 L14 24 Z',
      },
    ],
    details: [{ d: 'M42 4 C 46 12, 54 12, 58 4', strokeWidth: 1.5 }],
  },
  jacket: {
    viewBox: '0 0 100 90',
    paths: [
      {
        d: 'M28 14 L44 4 L56 4 L72 14 L88 24 L84 50 L80 80 L70 84 L30 84 L20 80 L16 50 L12 24 Z',
      },
    ],
    details: [
      { d: 'M44 4 L50 36 L56 4', strokeWidth: 1.5 },
      { d: 'M50 36 L50 84', strokeWidth: 1.2 },
    ],
  },
  jeans: {
    viewBox: '0 0 100 100',
    paths: [
      { d: 'M22 4 L78 4 L80 20 L20 20 Z' },
      {
        d: 'M22 22 L20 95 L46 95 L49 32 L51 32 L54 95 L80 95 L78 22 Z',
      },
    ],
    details: [
      { d: 'M50 22 L50 95', strokeWidth: 1.5 },
      { d: 'M28 32 L34 32', strokeWidth: 1.5 },
      { d: 'M66 32 L72 32', strokeWidth: 1.5 },
    ],
  },
  jumper: {
    viewBox: '0 0 100 80',
    paths: [
      {
        d: 'M26 14 L42 4 L58 4 L74 14 L92 26 L86 40 L74 36 L74 76 L26 76 L26 36 L14 40 L8 26 Z',
      },
    ],
    details: [
      { d: 'M42 4 C 46 14, 54 14, 58 4', strokeWidth: 1.5 },
      { d: 'M26 50 L74 50', strokeWidth: 1.2 },
    ],
  },
};

interface ProductImageProps {
  type: ProductType;
  hue: number;
  /** Optional real-photo URL. When provided, renders the photo instead of
   *  the SVG silhouette. The silhouette is kept as a fallback so we always
   *  render something while the photo loads (or if it fails). */
  src?: string;
  className?: string;
}

export function ProductImage({ type, hue, src, className = '' }: ProductImageProps) {
  if (src) {
    return (
      <div
        className={`relative overflow-hidden bg-zinc-100 dark:bg-zinc-900 ${className}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary external product photo (no-referrer, lazy); next/image would need per-domain config */}
        <img
          src={src}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>
    );
  }

  const s = SILHOUETTES[type];
  const bgStyle: CSSProperties = {
    background: `linear-gradient(135deg, hsl(${hue} 78% 78%), hsl(${(hue + 32) % 360} 72% 58%))`,
  };
  const fillColor = `hsl(${hue} 60% 22%)`;

  return (
    <div className={`relative overflow-hidden ${className}`} style={bgStyle}>
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-1/3"
        style={{
          background: `linear-gradient(to top, hsl(${hue} 30% 28% / 0.18), transparent)`,
        }}
      />
      <svg
        viewBox={s.viewBox}
        preserveAspectRatio="xMidYMax meet"
        className="absolute inset-x-[12%] bottom-[10%] top-[15%]"
        aria-hidden="true"
      >
        {s.paths.map((p, i) => (
          <path key={i} d={p.d} fill={fillColor} opacity={p.opacity ?? 1} />
        ))}
        {s.details?.map((d, i) => (
          <path
            key={i}
            d={d.d}
            fill="none"
            stroke="rgba(255,255,255,0.45)"
            strokeWidth={d.strokeWidth ?? 1.5}
            strokeLinecap="round"
          />
        ))}
      </svg>
    </div>
  );
}
