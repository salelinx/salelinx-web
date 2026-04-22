'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { LOCALES, LOCALE_LABELS, type Locale } from '@/lib/i18n/locales';

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
        className="flex h-8 items-center gap-1 rounded-full border border-black/10 px-2.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-black/5 disabled:opacity-60 dark:border-white/15 dark:text-zinc-300 dark:hover:bg-white/5"
      >
        <span>{LOCALE_LABELS[locale].short}</span>
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} />
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
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-[0.68rem] uppercase tracking-[0.12em] text-zinc-500">
                      {LOCALE_LABELS[code].short}
                    </span>
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

function ChevronDown({ className }: { className?: string }) {
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
      <path d="m6 9 6 6 6-6" />
    </svg>
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
