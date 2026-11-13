'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { createBrowserClient } from '@/lib/supabase/client';
import { CHROME_WEB_STORE_URL } from '@/lib/site';

// The website's half of connecting a Shopify store: the app's page in the store's admin made the
// code (shopify-public), and the shopify function's claimStore checks it and gives the store to
// the signed-in account. See app/[locale]/shopify/connect/page.tsx.

const PRIMARY =
  'inline-flex items-center justify-center rounded-full bg-black px-7 py-3.5 text-base font-medium text-white transition hover:bg-zinc-800 disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-zinc-200';
const SECONDARY =
  'inline-flex items-center justify-center rounded-full border border-black/10 px-7 py-3.5 text-base font-medium transition hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10';

// The store's admin, which the function names as the way back.
const ADMIN_RE = /^https:\/\/[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com\/admin\//;

/** The store a code names, read for display only: claimStore checks the signature. */
function storeIn(code: string): string | null {
  try {
    const b64 = code.split('.')[0].replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
    const p = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
    if (typeof p.n === 'string' && p.n) return p.n;
    return typeof p.d === 'string' ? p.d : null;
  } catch {
    return null;
  }
}

type Failure = 'noCode' | 'alreadyLinked' | 'alreadyTrialed' | 'failed';

function failureOf(code: unknown): Failure {
  if (code === 'ALREADY_LINKED_ELSEWHERE') return 'alreadyLinked';
  if (code === 'ALREADY_TRIALED') return 'alreadyTrialed';
  if (code === 'expired' || code === 'bad_signature' || code === 'bad_request') return 'noCode';
  return 'failed';
}

export function ShopifyConnect() {
  const t = useTranslations('ShopifyConnect');
  const code = useSearchParams().get('code') ?? '';
  const store = useMemo(() => (code ? storeIn(code) : null), [code]);
  // undefined while the session is read, null when signed out.
  const [email, setEmail] = useState<string | null | undefined>(undefined);
  const [step, setStep] = useState<'ready' | 'connecting' | 'done'>('ready');
  const [failure, setFailure] = useState<Failure | null>(store ? null : 'noCode');
  const [appUrl, setAppUrl] = useState<string | null>(null);

  useEffect(() => {
    createBrowserClient()
      .auth.getUser()
      .then(({ data }) => setEmail(data.user?.email ?? null))
      .catch(() => setEmail(null));
  }, []);

  async function connect() {
    setStep('connecting');
    setFailure(null);
    try {
      const {
        data: { session },
      } = await createBrowserClient().auth.getSession();
      if (!session) {
        setEmail(null);
        setStep('ready');
        return;
      }
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/shopify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action: 'claimStore', code }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFailure(failureOf(body?.code));
        setStep('ready');
        return;
      }
      setAppUrl(typeof body?.appUrl === 'string' && ADMIN_RE.test(body.appUrl) ? body.appUrl : null);
      setStep('done');
    } catch {
      setFailure('failed');
      setStep('ready');
    }
  }

  const name = store ?? 'Shopify';

  if (step === 'done') {
    return (
      <>
        <p className="mt-4 text-zinc-600 dark:text-zinc-400">{t('done', { store: name })}</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {appUrl && (
            <a href={appUrl} className={PRIMARY}>
              {t('back')}
            </a>
          )}
          <a href={CHROME_WEB_STORE_URL} target="_blank" rel="noopener" className={SECONDARY}>
            {t('getExtension')}
          </a>
        </div>
      </>
    );
  }

  if (failure && failure !== 'failed') {
    return <p className="mt-4 text-zinc-600 dark:text-zinc-400">{t(failure)}</p>;
  }

  if (email === undefined) return null;

  if (email === null) {
    const next = `/shopify/connect?code=${encodeURIComponent(code)}`;
    return (
      <>
        <p className="mt-4 text-zinc-600 dark:text-zinc-400">{t('signedOut', { store: name })}</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href={`/auth/login?next=${encodeURIComponent(next)}`} className={PRIMARY}>
            {t('login')}
          </Link>
          <Link href="/auth/signup" className={SECONDARY}>
            {t('signup')}
          </Link>
        </div>
        <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">{t('signupHint')}</p>
      </>
    );
  }

  return (
    <>
      <p className="mt-4 text-zinc-600 dark:text-zinc-400">
        {t('confirm', { store: name, email })}
      </p>
      {failure === 'failed' && <p className="mt-4 text-sm text-red-600">{t('failed')}</p>}
      <button
        type="button"
        onClick={connect}
        disabled={step === 'connecting'}
        className={`${PRIMARY} mt-8`}
      >
        {step === 'connecting' ? t('connecting') : t('connect')}
      </button>
    </>
  );
}
