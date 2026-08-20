'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { LOCALES, type Locale } from '@/lib/i18n/locales';

export function LanguageSwitcher() {
  const locale = useLocale() as Locale;
  const t = useTranslations('LanguageSwitcher');
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function select(next: Locale) {
    setOpen(false);
    if (next === locale) return;
    startTransition(() => {
      router.replace(pathname, { locale: next });
    });
  }

  const nameKey: Record<Locale, 'english' | 'french' | 'spanish' | 'german'> = {
    en: 'english',
    fr: 'french',
    es: 'spanish',
    de: 'german',
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('label')}
        disabled={isPending}
        onClick={() => setOpen((v) => !v)}
        className="flex h-7 w-7 items-center justify-center rounded-full border border-black/10 transition-colors hover:bg-black/5 disabled:opacity-60 dark:border-white/15 dark:hover:bg-white/5"
      >
        <Flag code={locale} className="h-4 w-4" />
      </button>

      {open ? (
        <ul
          role="listbox"
          className="absolute right-0 top-full z-20 mt-2 min-w-[10rem] overflow-hidden rounded-xl border border-black/10 bg-white shadow-lg dark:border-white/10 dark:bg-zinc-950"
        >
          {LOCALES.map((code) => {
            const active = code === locale;
            return (
              <li key={code}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => select(code)}
                  className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-black/5 dark:hover:bg-white/5 ${
                    active ? 'font-medium' : 'text-zinc-700 dark:text-zinc-300'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Flag code={code} className="h-4 w-4" />
                    <span>{t(nameKey[code])}</span>
                  </span>
                  {active ? <CheckIcon className="h-3.5 w-3.5" /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

/* Tiny SVG flags kept inline so they render identically on every OS
   (emoji flags fall back to plain letters on Windows). Each draws on a
   30x20 canvas and is slice-cropped to a circle by the viewBox offset. */
function Flag({ code, className }: { code: Locale; className?: string }) {
  return (
    <span
      className={`inline-block shrink-0 overflow-hidden rounded-full ring-1 ring-black/10 dark:ring-white/20 ${className ?? ''}`}
      aria-hidden
    >
      <svg
        viewBox="5 0 20 20"
        preserveAspectRatio="xMidYMid slice"
        className="h-full w-full"
        aria-hidden
      >
        {code === 'en' ? (
          <>
            <rect width="30" height="20" fill="#012169" />
            <path d="M0 0 30 20M30 0 0 20" stroke="#ffffff" strokeWidth="4" />
            <path d="M0 0 30 20M30 0 0 20" stroke="#C8102E" strokeWidth="2" />
            <path d="M15 0v20M0 10h30" stroke="#ffffff" strokeWidth="6.5" />
            <path d="M15 0v20M0 10h30" stroke="#C8102E" strokeWidth="4" />
          </>
        ) : code === 'fr' ? (
          <>
            <rect width="10" height="20" fill="#002395" />
            <rect x="10" width="10" height="20" fill="#ffffff" />
            <rect x="20" width="10" height="20" fill="#ED2939" />
          </>
        ) : code === 'es' ? (
          <>
            <rect width="30" height="20" fill="#AA151B" />
            <rect y="5" width="30" height="10" fill="#F1BF00" />
          </>
        ) : (
          <>
            <rect width="30" height="6.67" fill="#000000" />
            <rect y="6.67" width="30" height="6.67" fill="#DD0000" />
            <rect y="13.33" width="30" height="6.67" fill="#FFCE00" />
          </>
        )}
      </svg>
    </span>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="m5 12 5 5 9-11" />
    </svg>
  );
}
