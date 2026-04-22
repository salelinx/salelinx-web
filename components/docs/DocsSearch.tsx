'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Fuse from 'fuse.js';
import { Link, useRouter } from '@/i18n/navigation';
import { Icon } from '@/components/Icon';

type SearchRecord = {
  title: string;
  description?: string;
  category: string;
  slug: string;
  url: string;
  updated?: string;
  status?: string;
  tags?: string[];
  marketplaces?: string[];
  excerpt?: string;
};

const FUSE_OPTIONS = {
  includeScore: true,
  threshold: 0.35,
  ignoreLocation: true,
  keys: [
    { name: 'title', weight: 3 },
    { name: 'description', weight: 2 },
    { name: 'category', weight: 1.5 },
    { name: 'tags', weight: 1.5 },
    { name: 'marketplaces', weight: 1 },
    { name: 'excerpt', weight: 0.8 },
  ],
};

export function DocsSearch() {
  const t = useTranslations('Docs.search');
  const locale = useLocale();
  const router = useRouter();
  const [records, setRecords] = useState<SearchRecord[] | null>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (records !== null || !open) return;
    let cancelled = false;
    fetch(`/docs/search-index.${locale}.json`)
      .then((r) => (r.ok ? r.json() : { records: [] }))
      .then((data) => {
        if (!cancelled) setRecords(data.records ?? []);
      })
      .catch(() => {
        if (!cancelled) setRecords([]);
      });
    return () => {
      cancelled = true;
    };
  }, [locale, open, records]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const fuse = useMemo(() => {
    if (!records) return null;
    return new Fuse(records, FUSE_OPTIONS);
  }, [records]);

  const results = useMemo(() => {
    if (!fuse || query.trim().length < 2) return [];
    return fuse.search(query.trim()).slice(0, 8);
  }, [fuse, query]);

  function onChangeQuery(next: string) {
    setQuery(next);
    setActiveIndex(0);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      const hit = results[activeIndex];
      if (hit) {
        router.push(hit.item.url);
        setOpen(false);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  const showResults = open && query.trim().length >= 2;
  const hasResults = results.length > 0;

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-3 rounded-2xl border border-black/10 bg-white px-5 py-4 shadow-sm dark:border-white/10 dark:bg-zinc-950">
        <Icon
          name="search"
          className="h-5 w-5 shrink-0 text-zinc-400 dark:text-zinc-500"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => onChangeQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={t('placeholder')}
          className="flex-1 bg-transparent text-base outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
          aria-label={t('aria')}
          aria-controls="docs-search-results"
        />
      </div>

      {showResults ? (
        <div
          id="docs-search-results"
          className="absolute inset-x-0 top-full z-20 mt-2 overflow-hidden rounded-xl border border-black/10 bg-white shadow-lg dark:border-white/10 dark:bg-zinc-950"
        >
          {hasResults ? (
            <ul>
              {results.map((hit, i) => (
                <li key={hit.item.url}>
                  <Link
                    href={hit.item.url}
                    onClick={() => setOpen(false)}
                    className={`block px-5 py-3 ${
                      i === activeIndex
                        ? 'bg-black/[0.04] dark:bg-white/[0.04]'
                        : ''
                    }`}
                    onMouseEnter={() => setActiveIndex(i)}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate font-medium">
                        {hit.item.title}
                      </span>
                      <span className="shrink-0 font-mono text-[0.68rem] uppercase tracking-[0.12em] text-zinc-500">
                        {hit.item.category.replace(/-/g, ' ')}
                      </span>
                    </div>
                    {hit.item.description ? (
                      <p className="mt-0.5 line-clamp-1 text-sm text-zinc-600 dark:text-zinc-400">
                        {hit.item.description}
                      </p>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-5 py-6 text-sm text-zinc-500">
              {t('noResults', { query })}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
