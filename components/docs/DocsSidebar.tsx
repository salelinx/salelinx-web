import { getLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { CATEGORIES } from '@/lib/docs/categories';
import { listAllArticles } from '@/lib/docs/getArticle';
import type { CategorySlug } from '@/lib/docs/types';
import type { Locale } from '@/lib/i18n/locales';

export async function DocsSidebar({
  activeCategory,
  activeSlug,
}: {
  activeCategory?: CategorySlug;
  activeSlug?: string;
}) {
  const [t, locale] = await Promise.all([getTranslations('Docs'), getLocale()]);
  const all = listAllArticles(locale as Locale);
  const byCat = new Map<CategorySlug, typeof all>();
  for (const m of all) {
    const key = m.metadata.category;
    if (!byCat.has(key)) byCat.set(key, []);
    byCat.get(key)!.push(m);
  }

  return (
    <aside className="w-full shrink-0 lg:w-64" aria-label={t('sidebarAria')}>
      <nav className="flex flex-col gap-6 text-sm">
        {CATEGORIES.map((cat) => {
          const articles = byCat.get(cat.slug) ?? [];
          return (
            <div key={cat.slug}>
              <Link
                href={`/docs/${cat.slug}`}
                className={`font-mono text-[0.68rem] uppercase tracking-[0.12em] ${
                  activeCategory === cat.slug
                    ? 'text-black dark:text-white'
                    : 'text-zinc-600 hover:text-black dark:hover:text-white dark:text-zinc-400'
                }`}
              >
                {t(`category.${cat.slug}.title`)}
              </Link>
              <ul className="mt-3 space-y-2 border-l border-black/10 pl-4 dark:border-white/10">
                {articles.map((a) => {
                  const isActive =
                    activeCategory === cat.slug &&
                    activeSlug === a.metadata.slug;
                  return (
                    <li key={a.metadata.slug}>
                      <Link
                        href={`/docs/${a.metadata.category}/${a.metadata.slug}`}
                        className={`block leading-snug transition ${
                          isActive
                            ? 'text-black dark:text-white'
                            : 'text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-white'
                        }`}
                      >
                        {a.metadata.title}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
