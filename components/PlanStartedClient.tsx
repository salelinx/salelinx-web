"use client";

import { useEffect } from "react";
import { useRouter } from "@/i18n/navigation";

const COLORS = ["#34d399", "#fbbf24", "#60a5fa", "#f472b6", "#a78bfa"];

type Piece = {
  left: number;
  delay: number;
  duration: number;
  drift: number;
  spin: number;
  color: string;
  wide: boolean;
};

// Seeded so server and client render the same layout.
function rand(i: number, k: number) {
  const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

const PIECES: Piece[] = Array.from({ length: 36 }, (_, i) => ({
  left: rand(i, 1) * 100,
  delay: 0.25 + rand(i, 2) * 1.5,
  duration: 5 + rand(i, 3) * 3,
  drift: (rand(i, 4) - 0.5) * 160,
  spin: 180 + rand(i, 5) * 360,
  color: COLORS[i % COLORS.length],
  wide: rand(i, 6) > 0.5,
}));

export function Confetti() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-50 overflow-hidden [contain:strict] motion-reduce:hidden"
    >
      {PIECES.map((p, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={
            {
              left: `${p.left}%`,
              width: p.wide ? 8 : 5,
              height: p.wide ? 5 : 9,
              background: p.color,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
              "--drift": `${p.drift}px`,
              "--spin": `${p.spin}deg`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

/** Re-renders the page every 2s until Stripe's webhook has written the row. */
export function RefreshUntilReady() {
  const router = useRouter();
  useEffect(() => {
    let tries = 0;
    const id = setInterval(() => {
      if (++tries > 10) clearInterval(id);
      router.refresh();
    }, 2000);
    return () => clearInterval(id);
  }, [router]);
  return null;
}
