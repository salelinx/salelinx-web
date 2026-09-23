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
  // (globals.css). A floating object is the strongest motion on the page, so
  // it honours the same preference rather than being the one exception.
  const [still, setStill] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setStill(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

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
        // Decorative: it should not be possible to fling the logo across
        // the hero and leave it there. The subtle cursor parallax stays.
        draggable={false}
        cursorOrbit={!still}
        width="100%"
        height="100%"
      />
    </div>
  );
}
