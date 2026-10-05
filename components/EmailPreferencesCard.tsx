'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { createBrowserClient } from '@/lib/supabase/client';
import { type MarketingChoice, saveMarketingChoice } from '@/lib/marketing-choice';

// The standing place to change the marketing email answer given at signup or
// in MarketingChoicePrompt. Turning it back on also undoes an unsubscribe
// made from an email link (see saveMarketingChoice).
export function EmailPreferencesCard({ choice }: { choice: MarketingChoice }) {
  const t = useTranslations('EmailPreferences');
  const router = useRouter();
  const [wanted, setWanted] = useState(choice === 'yes');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function change(next: boolean) {
    setBusy(true);
    setFailed(false);
    setWanted(next);
    const { error } = await saveMarketingChoice(createBrowserClient(), next);
    setBusy(false);
    if (error) {
      setWanted(!next);
      setFailed(true);
      return;
    }
    router.refresh();
  }

  return (
    <section
      id="emails"
      className="mt-6 scroll-mt-24 rounded-2xl border border-black/10 p-6 dark:border-white/10"
    >
      <h2 className="text-xl font-semibold">{t('title')}</h2>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{t('body')}</p>
      <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={wanted}
          disabled={busy}
          onChange={(e) => change(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-black dark:accent-white"
        />
        <span className="font-medium">{t('toggle')}</span>
      </label>
      {failed ? (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {t('error')}
        </p>
      ) : null}
    </section>
  );
}
