'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { createBrowserClient } from '@/lib/supabase/client';

// Exit survey on /uninstall, where chrome.runtime.setUninstallURL lands
// people the moment they remove the extension. One click on a reason chip is
// the whole ask; the comment is optional. Deliberately anonymous (see
// 013_uninstall_feedback.sql): no auth, no email field, nothing identifying.
const REASONS = [
  'too_expensive',
  'missing_feature',
  'not_working',
  'stopped_selling',
  'switched_tool',
  'other',
] as const;

type Reason = (typeof REASONS)[number];

export function UninstallSurvey() {
  const t = useTranslations('Uninstall');
  const [reason, setReason] = useState<Reason | null>(null);
  const [comment, setComment] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>(
    'idle',
  );

  async function submit() {
    if (!reason || state === 'sending') return;
    setState('sending');
    // Version and locale ride in from the uninstall URL the extension set.
    const params = new URLSearchParams(window.location.search);
    const { error } = await createBrowserClient()
      .from('uninstall_feedback')
      .insert({
        reason,
        comment: comment.trim().slice(0, 500) || null,
        version: params.get('v')?.slice(0, 20) || null,
        locale: params.get('lang')?.slice(0, 10) || null,
      });
    setState(error ? 'error' : 'done');
  }

  if (state === 'done') {
    return (
      <p className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-4 text-sm font-medium text-emerald-700 dark:text-emerald-400">
        {t('thanks')}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {REASONS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setReason(r)}
            aria-pressed={reason === r}
            className={`rounded-full border px-4 py-2 text-sm transition-colors ${
              reason === r
                ? 'border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900'
                : 'border-zinc-300 text-zinc-700 hover:border-zinc-500 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-500'
            }`}
          >
            {t(`reason.${r}`)}
          </button>
        ))}
      </div>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        maxLength={500}
        rows={3}
        placeholder={t('commentPlaceholder')}
        className="w-full rounded-xl border border-zinc-300 bg-transparent px-4 py-3 text-sm placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:placeholder:text-zinc-500"
      />

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={!reason || state === 'sending'}
          className="rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white transition-opacity disabled:opacity-40 dark:bg-white dark:text-zinc-900"
        >
          {state === 'sending' ? t('sending') : t('send')}
        </button>
        {state === 'error' && (
          <p className="text-sm text-red-600 dark:text-red-400">
            {t('error')}
          </p>
        )}
      </div>
    </div>
  );
}
