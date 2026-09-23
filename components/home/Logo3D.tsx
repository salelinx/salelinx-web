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

/** Gap between idle spins. Long enough that it reads as the logo having a
 *  character rather than as a loop you are being shown. */
const SPIN_EVERY_MS = 19_000;

export function Logo3D() {
  // The rest of the page drops its motion under prefers-reduced-motion
  // (globals.css). A floating object is the strongest motion on the page, so
  // it honours the same preference rather than being the one exception.
  const [still, setStill] = useState(false);
  const [turns, setTurns] = useState(0);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setStill(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  // The occasional full turn.
  //
  // Driven through rotationY rather than by switching `animate` to spin or
  // spinFloat. Those two own position.y as well, at a different frequency and
  // amplitude to float, so swapping mid-flight steps the bob. rotationY feeds
  // SmoothControls, which owns rotation while float owns position, so the two
  // never touch: the logo keeps bobbing right through the spin. SmoothControls
  // eases to the new target at damping 0.08, which lands a turn in about a
  // second without needing any animation of our own.
  useEffect(() => {
    if (still) return;
    const id = setInterval(() => {
      // Nothing to see on a hidden tab, and the timer would otherwise queue up
      // turns while backgrounded and spend them all at once on return.
      if (document.hidden) return;
      setTurns((n) => n + 1);
    }, SPIN_EVERY_MS);
    return () => clearInterval(id);
  }, [still]);

  return (
    <div aria-hidden className="h-20 w-20 shrink-0 sm:h-32 sm:w-32">
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
        rotationY={turns * Math.PI * 2}
        draggable={!still}
        cursorOrbit={!still}
        width="100%"
        height="100%"
      />
    </div>
  );
}
