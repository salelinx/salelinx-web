'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useHydrated } from '@/lib/use-hydrated';

type Theme = 'light' | 'dark';

// View Transitions API isn't in the default TS DOM lib yet.
interface ViewTransition {
  finished: Promise<void>;
}
type StartViewTransition = (callback: () => void) => ViewTransition;

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function getInitialTheme(): Theme {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

function writeThemeCookie(theme: Theme) {
  document.cookie = `theme=${theme}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

function hasThemeCookie(): boolean {
  return document.cookie.split('; ').some((c) => c.startsWith('theme='));
}

export function ThemeToggle() {
  // Lazily read the real theme from the DOM on first client render (SSR returns
  // 'light' from the typeof-document guard). Doing this in the useState
  // initializer instead of a mount effect avoids a synchronous setState in an
  // effect body, which the React lint rule flags as a cascading render.
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const mounted = useHydrated();
  const transitioning = useRef(false);
  const t = useTranslations('ThemeToggle');

  useEffect(() => {
    // Persist system-preferred theme on first visit so the server can render
    // the right class on subsequent loads and soft navigations (e.g. locale
    // change). No setState here - just an external write.
    if (!hasThemeCookie()) writeThemeCookie(getInitialTheme());
  }, []);

  function toggle() {
    if (transitioning.current) return;
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    const root = document.documentElement;

    const applyTheme = () => {
      root.classList.toggle('dark', next === 'dark');
      try {
        localStorage.setItem('theme', next);
      } catch {}
      writeThemeCookie(next);
    };

    setTheme(next);

    // View Transitions API drives a diagonal clip-path wipe. Direction is keyed
    // off `data-theme-sweep` on <html> so the CSS picks the right diagonal:
    // light -> dark sweeps top-left to bottom-right, dark -> light the reverse.
    const startViewTransition = (
      document as Document & { startViewTransition?: StartViewTransition }
    ).startViewTransition;
    if (typeof startViewTransition !== 'function') {
      applyTheme();
      return;
    }

    transitioning.current = true;
    root.dataset.themeSweep = next;

    const transition = startViewTransition.call(document, () => {
      applyTheme();
    });

    transition.finished
      .catch(() => {})
      .finally(() => {
        delete root.dataset.themeSweep;
        transitioning.current = false;
      });
  }

  const label = theme === 'dark' ? t('switchToLight') : t('switchToDark');

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className="flex h-8 w-8 items-center justify-center rounded-full border border-black/10 text-zinc-700 transition-colors hover:bg-black/5 dark:border-white/15 dark:text-zinc-300 dark:hover:bg-white/5"
    >
      {mounted && theme === 'dark' ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

function SunIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden
    >
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
    </svg>
  );
}
