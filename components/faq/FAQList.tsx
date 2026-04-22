'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Icon } from '@/components/Icon';
import type { FAQGroup } from '@/lib/faq';

const MONO = 'font-mono text-[0.68rem] uppercase tracking-[0.12em]';

function matches(
  query: string,
  fields: Array<string | string[] | undefined>,
): boolean {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return true;
  for (const f of fields) {
    if (!f) continue;
    const text = (Array.isArray(f) ? f.join(' ') : f).toLowerCase();
    if (text.includes(q)) return true;
  }
  return false;
}

export function FAQList({ groups }: { groups: FAQGroup[] }) {
  const t = useTranslations('Faq.search');
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const filteredGroups = useMemo(() => {
    return groups
      .map((g) => ({
        ...g,
        items: g.items.filter((item) =>
          matches(query, [item.q, item.keywords, g.title]),
        ),
      }))
      .filter((g) => g.items.length > 0);
  }, [groups, query]);

  const empty = query.trim().length >= 2 && filteredGroups.length === 0;

  return (
    <div>
      <div className="flex items-center gap-3 rounded-2xl border border-black/10 bg-white px-5 py-4 shadow-sm dark:border-white/10 dark:bg-zinc-950">
        <Icon
          name="search"
          className="h-5 w-5 shrink-0 text-zinc-400 dark:text-zinc-500"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('placeholder')}
          className="flex-1 bg-transparent text-base outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
          aria-label={t('aria')}
        />
      </div>

      {empty ? (
        <p className="mt-10 text-center text-sm text-zinc-500">
          {t('noResults', { query })}
        </p>
      ) : (
        <div className="mt-10 space-y-14">
          {filteredGroups.map((group) => (
            <section key={group.slug} id={group.slug}>
              <div>
                <span className={`${MONO} text-zinc-500`}>{group.slug}</span>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                  {group.title}
                </h2>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                  {group.blurb}
                </p>
              </div>
              <ul className="mt-6 divide-y divide-black/10 overflow-hidden rounded-xl border border-black/10 dark:divide-white/10 dark:border-white/10">
                {group.items.map((item) => {
                  const isOpen = openId === item.id;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => setOpenId(isOpen ? null : item.id)}
                        aria-expanded={isOpen}
                        aria-controls={`faq-a-${item.id}`}
                        className="flex w-full items-center justify-between gap-6 bg-white px-5 py-4 text-left transition hover:bg-black/[0.03] dark:bg-zinc-950 dark:hover:bg-white/[0.03]"
                      >
                        <span
                          className="font-medium"
                          dangerouslySetInnerHTML={{ __html: item.q }}
                        />
                        <span
                          className={`shrink-0 text-zinc-500 transition ${
                            isOpen ? 'rotate-45' : ''
                          }`}
                          aria-hidden
                        >
                          +
                        </span>
                      </button>
                      {isOpen ? (
                        <div
                          id={`faq-a-${item.id}`}
                          className="bg-black/[0.02] px-5 py-5 text-sm leading-relaxed text-zinc-700 dark:bg-white/[0.02] dark:text-zinc-300"
                        >
                          {item.a}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
