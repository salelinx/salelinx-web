import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Icon } from '@/components/Icon';

export async function DocsFAQLink() {
  const t = await getTranslations('Docs');
  return (
    <div className="flex justify-center text-center">
      <Link
        href="/faq"
        className="group inline-flex flex-wrap items-center justify-center gap-x-2 text-sm text-zinc-600 transition hover:text-black dark:text-zinc-400 dark:hover:text-white"
      >
        <span>{t('faqLinkPrompt')}</span>
        <span className="inline-flex items-center gap-1 font-medium text-zinc-900 underline-offset-4 group-hover:underline dark:text-zinc-100">
          {t('faqLinkCta')}
          <Icon
            name="arrow-right"
            className="h-4 w-4 transition group-hover:translate-x-0.5"
          />
        </span>
      </Link>
    </div>
  );
}
