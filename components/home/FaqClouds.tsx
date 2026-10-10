'use client';

import { useEffect, useRef, useState } from 'react';

const MAX = 10;
const LEAVE_MS = 1200;

type Cloud = {
  id: number;
  x: number;
  y: number;
  s: number;
  tilt: number;
  d: number;
  vis: string;
  state: 'born' | 'in' | 'out';
};

// x/y are % of the section, s the width in px, d the float delay in seconds.
const SEED: Cloud[] = [
  { x: 6, y: 14, s: 76, d: 0, tilt: -8, vis: 'hidden sm:block' },
  { x: 14, y: 58, s: 52, d: -3.2, tilt: 6, vis: 'hidden lg:block' },
  { x: 4, y: 82, s: 60, d: -5.1, tilt: -4, vis: 'hidden lg:block' },
  { x: 86, y: 10, s: 58, d: -1.6, tilt: 7, vis: 'hidden sm:block' },
  { x: 90, y: 46, s: 84, d: -4.4, tilt: -6, vis: 'hidden lg:block' },
  { x: 81, y: 78, s: 50, d: -2.5, tilt: 5, vis: 'hidden lg:block' },
].map((c, id) => ({ ...c, id, state: 'in' as const }));

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const gutter = (x: number): [number, number] => (x < 50 ? [1, 16] : [81, 94]);

// Best of a few random gutter spots, by distance to the nearest other cloud.
function pickSpot(others: Cloud[], left: boolean, near: number) {
  let best = { x: 0, y: 0, gap: -1 };
  for (let i = 0; i < 12; i++) {
    const x = left ? rand(2, 14) : rand(82, 93);
    const y = clamp(near + rand(-30, 30), 4, 86);
    const gap = Math.min(100, ...others.map((c) => Math.hypot(c.x - x, (c.y - y) * 0.6)));
    if (gap > best.gap) best = { x, y, gap };
  }
  return best;
}

function QuestionBubble({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 64 58" width={size} height={(size * 58) / 64} aria-hidden="true">
      <path
        d="M14 1h36a13 13 0 0 1 13 13v18a13 13 0 0 1-13 13H26l-11 11v-11h-1A13 13 0 0 1 1 32V14A13 13 0 0 1 14 1z"
        className="fill-white/80 stroke-black/[0.08] dark:fill-zinc-900/80 dark:stroke-white/10"
        strokeWidth="1.5"
      />
      <text
        x="32"
        y="31"
        textAnchor="middle"
        dominantBaseline="middle"
        className="fill-zinc-400 dark:fill-zinc-500"
        style={{ font: '600 24px var(--font-sans, system-ui)' }}
      >
        ?
      </text>
    </svg>
  );
}

export function FaqClouds() {
  const ref = useRef<HTMLDivElement>(null);
  const [clouds, setClouds] = useState(SEED);

  useEffect(() => {
    const section = ref.current!.parentElement!;
    let nextId = SEED.length;
    let lastLeft = false;
    const timers = new Set<number>();
    const later = (fn: () => void, ms: number) => {
      const t = window.setTimeout(() => {
        timers.delete(t);
        fn();
      }, ms);
      timers.add(t);
    };

    // toggle does not bubble, so listen in the capture phase.
    const onToggle = (e: Event) => {
      const details = e.target as HTMLDetailsElement;
      if (!(details instanceof HTMLDetailsElement) || !details.open) return;
      const sec = section.getBoundingClientRect();
      const row = details.querySelector('summary')!.getBoundingClientRect();
      // Strictly alternate, and at the cap evict the oldest on the same side,
      // so both gutters always hold the same number.
      const left = !lastLeft;
      lastLeft = left;
      const size = Math.round(rand(46, 80));
      const ox = (((left ? row.left : row.right - size) - sec.left) / sec.width) * 100;
      const oy = ((row.top + row.height / 2 - sec.top) / sec.height) * 100;
      const id = nextId++;

      setClouds((prev) => {
        const moved = prev.map((c) => {
          if (c.state !== 'in') return c;
          const [lo, hi] = gutter(c.x);
          const away = Math.sign(c.y - oy || 1) * rand(1.5, 4);
          return { ...c, x: clamp(c.x + rand(-1.5, 1.5), lo, hi), y: clamp(c.y + away, 3, 88) };
        });
        const born: Cloud = {
          id,
          x: ox,
          y: oy,
          s: size,
          d: -rand(0, 7),
          tilt: rand(-9, 9),
          vis: 'hidden lg:block',
          state: 'born',
        };
        const next = [...moved, born];
        const live = next.filter((c) => c.state !== 'out');
        if (live.length > MAX) {
          const oldest = live.find((c) => c.id !== id && c.x < 50 === left)!.id;
          later(() => setClouds((cur) => cur.filter((c) => c.id !== oldest)), LEAVE_MS);
          return next.map((c) => (c.id === oldest ? { ...c, state: 'out' } : c));
        }
        return next;
      });

      // Two frames so the born position paints before it flies to its spot.
      requestAnimationFrame(() =>
        requestAnimationFrame(() =>
          setClouds((cur) => {
            const others = cur.filter((c) => c.id !== id && c.state !== 'out');
            const { x, y } = pickSpot(others, left, oy);
            return cur.map((c) => (c.id === id ? { ...c, state: 'in', x, y } : c));
          }),
        ),
      );
    };

    section.addEventListener('toggle', onToggle, true);
    return () => {
      section.removeEventListener('toggle', onToggle, true);
      timers.forEach(clearTimeout);
    };
  }, []);

  return (
    <div ref={ref} aria-hidden className="pointer-events-none absolute inset-0">
      {clouds.map((c) => (
        <div
          key={c.id}
          className={`faq-cloud absolute inset-0 ${c.vis}`}
          style={{ translate: `${c.x}% ${c.y}%` }}
        >
          <div className={`faq-cloud-pop ${c.state === 'in' ? '' : 'is-hidden'} ${c.state === 'out' ? 'is-leaving' : ''}`}>
            <div
              className="faq-bubble drop-shadow-[0_8px_20px_rgb(0_0_0/0.06)]"
              style={{ animationDelay: `${c.d}s`, rotate: `${c.tilt}deg` }}
            >
              <QuestionBubble size={c.s} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
