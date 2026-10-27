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

export function Logo3D() {
  // The rest of the page drops its motion under prefers-reduced-motion
  // (globals.css). A moving object is the strongest motion on the page, so
  // it honours the same preference rather than being the one exception.
  const [still, setStill] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setStill(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  // Never leave the logo hidden if WebGL fails and onReady never fires.
  useEffect(() => {
    const t = window.setTimeout(() => setReady(true), 2500);
    return () => clearTimeout(t);
  }, []);

  return (
    // The renderer arrives on its own chunk well after first paint, so the fade
    // keys off onReady rather than mount, or it would pop in at full size.
    <div
      aria-hidden
      // Fade only, never scale: the renderer measures this box once, and a
      // scaled box locked the canvas at 75% size in its top-left corner.
      className={`relative h-28 w-28 shrink-0 transition-opacity duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] sm:h-48 sm:w-48 ${
        ready || still ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <SVG3D
        svg={LOGO_SVG}
        smoothness={0.6}
        color="#000000"
        // Thin and matte so it reads like the flat logo with a slim edge,
        // rather than a glossy block.
        depth={0.45}
        metalness={0}
        roughness={0.6}
        // Default intro is a 2.5s dolly from zoom 18, which at this size
        // reads as the logo drifting in from somewhere far away long after
        // the headline has landed. Shorter, and starting much closer, so it
        // settles about when the rest of the hero finishes its stagger.
        intro={still ? 'none' : 'zoom'}
        introDuration={1.1}
        introFrom={{ zoom: 12, opacity: 0 }}
        animate={still ? 'none' : 'float'}
        animateSpeed={0.8}
        shadow={false}
        draggable={!still}
        cursorOrbit={false}
        width="100%"
        height="100%"
        onReady={() => setReady(true)}
      />
    </div>
  );
}
