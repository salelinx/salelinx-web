'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { createBrowserClient } from '@/lib/supabase/client';
import { InstallExtensionButton } from '@/components/InstallExtensionButton';

// Touch-first devices (phones, tablets) cannot install Chrome extensions.
const TOUCH = '(hover: none) and (pointer: coarse)';
const SENT_KEY = 'slx_install_link_sent';

function subscribe(onChange: () => void) {
  const m = matchMedia(TOUCH);
  m.addEventListener('change', onChange);
  return () => m.removeEventListener('change', onChange);
}

async function emailInstallLink(locale: string): Promise<boolean> {
  const {
    data: { session },
  } = await createBrowserClient().auth.getSession();
  if (!session) return false;
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-install-link`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ locale }),
      },
    );
    return res.ok;
  } catch {
    return false;
  }
}

export function GetStartedInstall({ buttonClassName }: { buttonClassName: string }) {
  const t = useTranslations('GetStarted');
  const locale = useLocale();
  const isTouch = useSyncExternalStore(subscribe, () => matchMedia(TOUCH).matches, () => false);
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  function send() {
    setStatus('sending');
    emailInstallLink(locale).then((ok) => setStatus(ok ? 'sent' : 'error'));
  }

  // Sent once per browser session without asking, so a reload does not resend.
  useEffect(() => {
    if (!isTouch) return;
    try {
      if (sessionStorage.getItem(SENT_KEY)) return;
      sessionStorage.setItem(SENT_KEY, '1');
    } catch {}
    emailInstallLink(locale).then((ok) => setStatus(ok ? 'sent' : 'error'));
  }, [isTouch, locale]);

  if (!isTouch) {
    return (
      <>
        <p className="mt-3 text-zinc-600 dark:text-zinc-400">{t('subtitle')}</p>
        <InstallExtensionButton label={t('addToChrome')} className={buttonClassName} />
      </>
    );
  }

  return (
    <>
      <p className="mt-3 text-zinc-600 dark:text-zinc-400">{t('phoneSubtitle')}</p>
      {status === 'sent' && (
        <p className="mt-6 text-sm text-emerald-600 dark:text-emerald-400">{t('phoneSent')}</p>
      )}
      {status === 'error' && <p className="mt-6 text-sm text-red-600">{t('phoneError')}</p>}
      <button
        type="button"
        onClick={send}
        disabled={status === 'sending'}
        className={`${buttonClassName} disabled:opacity-60`}
      >
        {status === 'sending'
          ? t('phoneSending')
          : t(status === 'sent' ? 'phoneResend' : 'phoneEmailLink')}
      </button>
    </>
  );
}
