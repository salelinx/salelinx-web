import { getTranslations } from 'next-intl/server';
import { Icon } from '@/components/Icon';

export async function SupportCard() {
  const t = await getTranslations('Docs.support');
  return (
    <div className="flex flex-col items-start gap-6 rounded-xl border border-black/10 bg-black/[0.03] p-8 sm:flex-row sm:items-center sm:justify-between dark:border-white/10 dark:bg-white/[0.03]">
      <div className="flex items-start gap-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-black/10 bg-white text-zinc-700 dark:border-white/10 dark:bg-zinc-950 dark:text-zinc-200">
          <Icon name="life-buoy" />
        </span>
        <div>
          <h3 className="text-lg font-semibold tracking-tight">
            {t('title')}
          </h3>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {t('body')}
          </p>
        </div>
      </div>
      <a
        href="mailto:support@salelinx.com"
        className="shrink-0 rounded-full bg-black px-5 py-2.5 text-sm font-medium text-white dark:bg-white dark:text-black"
      >
        {t('cta')}
      </a>
    </div>
  );
}
