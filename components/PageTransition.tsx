'use client';

import { ViewTransition, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';

// Keyed by path so a navigation is an exit plus an enter (a fade) rather than
// one group morphing between two page heights. Same-page updates don't animate.
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition key={usePathname()} enter="page-enter" exit="page-exit" default="none">
      {children}
    </ViewTransition>
  );
}
