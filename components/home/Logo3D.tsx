'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { LOGO_SVG } from './logo-3d-svg';

// three, @react-three/fiber and @react-three/drei come to roughly a megabyte
// before gzip, so the renderer is loaded on its own chunk rather than in the
// page bundle, and only once this component mounts. ssr:false because it
// needs a WebGL context; next/dynamic only allows that inside a Client
// Component, which is why this wrapper exists at all.
const SVG3D = dynamic(() => import('3dsvg').then((m) => m.SVG3D), {
  ssr: false,
  loading: () => <div aria-hidden className="h-full w-full" />,
});

const SPIN_EVERY_MS = 5_000;
const SPIN_MS = 1_600;
const TAU = Math.PI * 2;
const WIND_UP = 0.22;
const OVERSHOOT = 0.16;

const easeOut = (t: number) => 1 - (1 - t) ** 3;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

// Wind up against the turn, whip round past a full rotation, settle back.
function turnAt(p: number) {
  if (p < 0.18) return WIND_UP * easeOut(p / 0.18);
  if (p < 0.8) return WIND_UP - (TAU + OVERSHOOT + WIND_UP) * easeInOut((p - 0.18) / 0.62);
  return -TAU - OVERSHOOT + OVERSHOOT * easeOut((p - 0.8) / 0.2);
}

export function Logo3D() {
  // The rest of the page drops its motion under prefers-reduced-motion
  // (globals.css). A moving object is the strongest motion on the page, so
  // it honours the same preference rather than being the one exception.
  const [still, setStill] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [tilt, setTilt] = useState(0);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setStill(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  // Tweened here because 3dsvg writes rotationY straight onto the mesh: a bare
  // +2PI jump lands where it started and nothing visibly turns. Direction
  // alternates and the gap wanders a little so it never reads as a metronome.
  useEffect(() => {
    if (still) return;
    let frame = 0;
    let timer = 0;
    let dir = 1;
    const schedule = () => {
      timer = window.setTimeout(spin, SPIN_EVERY_MS * (0.8 + Math.random() * 0.5));
    };
    const spin = () => {
      if (document.hidden) return schedule();
      const start = performance.now();
      const step = (now: number) => {
        const p = Math.min(1, (now - start) / SPIN_MS);
        setRotation(dir * turnAt(p));
        setTilt(-0.2 * Math.sin(Math.PI * p));
        if (p < 1) frame = requestAnimationFrame(step);
        else {
          dir = -dir;
          schedule();
        }
      };
      frame = requestAnimationFrame(step);
    };
    schedule();
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, [still]);

  return (
    <div aria-hidden className="h-32 w-32 shrink-0 sm:h-48 sm:w-48">
      <SVG3D
        svg={LOGO_SVG}
        smoothness={0.6}
        color="#000000"
        // Default intro is a 2.5s dolly from zoom 18, which at this size
        // reads as the logo drifting in from somewhere far away long after
        // the headline has landed. Shorter, and starting much closer, so it
        // settles about when the rest of the hero finishes its stagger.
        intro={still ? 'none' : 'zoom'}
        introDuration={1.1}
        introFrom={{ zoom: 12, opacity: 0 }}
        animate={still ? 'none' : 'float'}
        rotationX={tilt}
        rotationY={rotation}
        draggable={!still}
        cursorOrbit={false}
        width="100%"
        height="100%"
      />
    </div>
  );
}
