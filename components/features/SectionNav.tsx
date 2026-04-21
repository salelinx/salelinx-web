'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

type TabId = 'features' | 'pricing' | 'roadmap';

type Tab = {
  id: TabId;
  number: string;
  label: string;
};

const TABS: Tab[] = [
  { id: 'features', number: '01', label: 'Features' },
  { id: 'pricing', number: '02', label: 'Pricing' },
  { id: 'roadmap', number: '03', label: 'Roadmap' },
];

export function SectionNav() {
  const [active, setActive] = useState<TabId>('features');
  const [indicator, setIndicator] = useState({ left: 0, width: 0, ready: false });
  const containerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef(new Map<TabId, HTMLAnchorElement>());
  const isScrollingProgrammatically = useRef(false);

  const measureIndicator = useCallback((id: TabId) => {
    const el = tabRefs.current.get(id);
    const container = containerRef.current;
    if (!el || !container) return;
    const elRect = el.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    setIndicator({
      left: elRect.left - containerRect.left,
      width: elRect.width,
      ready: true,
    });
  }, []);

  useLayoutEffect(() => {
    measureIndicator(active);
  }, [active, measureIndicator]);

  useEffect(() => {
    const onResize = () => measureIndicator(active);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [active, measureIndicator]);

  useEffect(() => {
    const sections = TABS.map((t) => document.getElementById(t.id)).filter(
      (el): el is HTMLElement => Boolean(el),
    );
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (isScrollingProgrammatically.current) return;
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          const id = visible[0].target.id as TabId;
          setActive(id);
          if (window.location.hash !== `#${id}`) {
            history.replaceState(null, '', `#${id}`);
          }
        }
      },
      {
        rootMargin: '-30% 0px -55% 0px',
        threshold: 0,
      },
    );

    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, []);

  const onClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, id: TabId) => {
      e.preventDefault();
      const section = document.getElementById(id);
      if (!section) return;

      isScrollingProgrammatically.current = true;
      setActive(id);
      history.replaceState(null, '', `#${id}`);

      section.scrollIntoView({ behavior: 'smooth', block: 'start' });

      window.setTimeout(() => {
        isScrollingProgrammatically.current = false;
      }, 900);
    },
    [],
  );

  return (
    <div className="sticky top-0 z-40 border-b border-black/10 bg-white/75 backdrop-blur-md supports-[backdrop-filter]:bg-white/60 dark:border-white/10 dark:bg-zinc-950/75 dark:supports-[backdrop-filter]:bg-zinc-950/60">
      <div className="mx-auto w-full max-w-7xl px-6">
        <div
          ref={containerRef}
          className="relative flex items-center gap-8 overflow-x-auto"
          role="tablist"
          aria-label="Page sections"
        >
          {TABS.map((tab) => {
            const isActive = active === tab.id;
            return (
              <a
                key={tab.id}
                href={`#${tab.id}`}
                ref={(el) => {
                  if (el) {
                    tabRefs.current.set(tab.id, el);
                  } else {
                    tabRefs.current.delete(tab.id);
                  }
                }}
                onClick={(e) => onClick(e, tab.id)}
                role="tab"
                aria-current={isActive ? 'true' : undefined}
                className={`group flex shrink-0 items-baseline gap-2.5 py-4 transition-colors duration-200 ${
                  isActive
                    ? 'text-black dark:text-white'
                    : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-500 dark:hover:text-zinc-200'
                }`}
              >
                <span
                  className={`font-mono text-[0.68rem] uppercase tracking-[0.12em] tabular-nums ${
                    isActive
                      ? 'text-zinc-600 dark:text-zinc-400'
                      : 'text-zinc-400 dark:text-zinc-600'
                  }`}
                >
                  {tab.number}
                </span>
                <span className="text-[0.95rem] font-semibold tracking-tight">
                  {tab.label}
                </span>
              </a>
            );
          })}

          <span
            aria-hidden
            className={`pointer-events-none absolute bottom-0 h-[2px] bg-black transition-[left,width,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] dark:bg-white ${
              indicator.ready ? 'opacity-100' : 'opacity-0'
            }`}
            style={{ left: indicator.left, width: indicator.width }}
          />
        </div>
      </div>
    </div>
  );
}
