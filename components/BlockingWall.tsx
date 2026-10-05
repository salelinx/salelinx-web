'use client';

import { useEffect, useRef } from 'react';

// Full-screen layer behind a choice the visitor has to make before going on
// (cookies on a first visit, marketing emails on a first signed-in visit).
// Blurs the page and makes everything else in <body> inert (no clicks, no Tab
// stops, hidden from screen readers) and unscrollable. Unmounting undoes all
// of it.
//
// Only one wall may be mounted at a time: each makes its siblings inert, so
// two would lock each other out. MarketingChoicePrompt waits for the cookie
// choice for that reason.
//
// Deliberately no close button and no Escape handler. A wall has to offer the
// "no" answer as prominently as the "yes" one instead.
export function BlockingWall({ label, children }: { label: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wall = ref.current;
    if (!wall) return;
    const siblings = Array.from(wall.parentElement?.children ?? []).filter(
      (el): el is HTMLElement => el instanceof HTMLElement && el !== wall && !el.inert,
    );
    siblings.forEach((el) => {
      el.inert = true;
    });
    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    root.style.overflow = 'hidden';
    // Focus the dialog itself, not a button: preselecting an answer would
    // nudge the choice.
    wall.focus();
    return () => {
      siblings.forEach((el) => {
        el.inert = false;
      });
      root.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      tabIndex={-1}
      className="fixed inset-0 z-[60] flex overflow-y-auto overscroll-contain bg-black/25 p-4 outline-none backdrop-blur-sm"
    >
      {children}
    </div>
  );
}
