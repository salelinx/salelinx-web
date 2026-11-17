'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { createBrowserClient } from '@/lib/supabase/client';
import {
  EBAY_CONSENT_RE,
  SHOPIFY_ADMIN_RE,
  type EbayFailure,
  ebayFailureOf,
  matchesMaskedEmail,
} from '@/lib/ebay-connect';

// The website's eBay connect page. eBay's sign-in starts and ends here, with the seller's own
// SaleLinx login, so an eBay account only ever joins the account signed in on this browser: a link
// someone else made can't connect a seller's eBay to theirs. The Shopify app's page in a store's
// admin opens it in a new tab, with `return` (the way back to it) and `account` (the store's
// account, masked, to warn about a different login). It calls `ebay-web`, the ebay function's code
// under its own name, so nothing deployed for this page reaches the extension's `ebay`. Its
// consentUrl and link take client 'web', which picks EBAY_RUNAME_WEB, whose accept URL is this
// page. See docs/EDGE-FUNCTIONS.md "eBay".

const PRIMARY =
  'inline-flex items-center justify-center rounded-full bg-black px-7 py-3.5 text-base font-medium text-white transition hover:bg-zinc-800 disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-zinc-200';
const SECONDARY =
  'inline-flex items-center justify-center rounded-full border border-black/10 px-7 py-3.5 text-base font-medium transition hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10';

// Kept through eBay's sign-in, which comes back to this page in the same tab.
const STATE_KEY = 'salelinx.ebayConnect.state';
const RETURN_KEY = 'salelinx.ebayConnect.return';

function stored(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function store(key: string, value: string | null): void {
  try {
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, value);
  } catch {
    // Storage blocked: the return then reads as expired, and the seller starts again.
  }
}

interface Saved {
  state: string | null;
  back: string | null;
}

// What this tab stored before it left for eBay, read once per page load: the page clears the state
// as it uses it, and must still know what it was. Browser only, so the server and hydration see
// null (useSyncExternalStore's server snapshot), as reading it in an effect would be a cascading
// render.
let saved: Saved | null = null;
const readSaved = (): Saved => {
  if (!saved) {
    const back = stored(RETURN_KEY);
    saved = { state: stored(STATE_KEY), back: back && SHOPIFY_ADMIN_RE.test(back) ? back : null };
  }
  return saved;
};
const noChanges = () => () => {};

/** The ebay-web function as the signed-in seller, or null when no one is signed in. */
async function ebayCall(
  body: Record<string, unknown>,
): Promise<{ ok: boolean; body: Record<string, unknown> } | null> {
  const {
    data: { session },
  } = await createBrowserClient().auth.getSession();
  if (!session) return null;
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/ebay-web`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ ...body, client: 'web' }),
  });
  return { ok: res.ok, body: await res.json().catch(() => ({})) };
}

type Linked = { username: string | null } | { failure: EbayFailure; signedOut?: boolean };

export function EbayConnect() {
  const t = useTranslations('EbayConnect');
  const params = useSearchParams();
  // eBay's return (its code and our state, or a sign-in the seller cancelled), kept from the first
  // render: the address loses them once they are used.
  const [ret] = useState(() => ({
    code: params.get('code'),
    state: params.get('state'),
    declined: params.get('declined') === '1' || params.has('error'),
  }));
  const returnParam = params.get('return');
  const accountMask = params.get('account');
  const before = useSyncExternalStore(noChanges, readSaved, () => null);

  // undefined while the session is read, null when signed out.
  const [email, setEmail] = useState<string | null | undefined>(undefined);
  const [linked, setLinked] = useState<Linked | null>(null);
  const [starting, setStarting] = useState(false);
  // Once the seller presses Connect, an earlier return's message goes.
  const [acted, setActed] = useState(false);
  const [startFailure, setStartFailure] = useState<EbayFailure | null>(null);
  const finished = useRef(false);

  const outcome = ret.declined
    ? 'declined'
    : !ret.code
      ? 'none'
      : !before
        ? 'pending'
        : before.state && before.state === ret.state
          ? 'link'
          : 'expired';

  useEffect(() => {
    createBrowserClient()
      .auth.getUser()
      .then(({ data }) => setEmail(data.user?.email ?? null))
      .catch(() => setEmail(null));
  }, []);

  // Back from eBay: the code is used once, so this runs once, and the address loses it.
  useEffect(() => {
    if (outcome === 'none' || outcome === 'pending' || finished.current) return;
    finished.current = true;
    store(STATE_KEY, null);
    window.history.replaceState(null, '', window.location.pathname);
    if (outcome !== 'link') return;
    ebayCall({ action: 'link', code: ret.code })
      .then((r) => {
        if (!r) setLinked({ failure: 'expired', signedOut: true });
        else if (!r.ok) setLinked({ failure: ebayFailureOf(r.body?.code) });
        else setLinked({ username: typeof r.body?.username === 'string' ? r.body.username : null });
      })
      .catch(() => setLinked({ failure: 'failed' }));
  }, [outcome, ret.code]);

  async function start() {
    setActed(true);
    setStarting(true);
    setStartFailure(null);
    try {
      const nonce = crypto.randomUUID();
      const r = await ebayCall({ action: 'consentUrl', state: nonce });
      if (!r) {
        setEmail(null);
        setStarting(false);
        return;
      }
      const url = r.body?.url;
      if (!r.ok || typeof url !== 'string' || !EBAY_CONSENT_RE.test(url)) {
        setStartFailure('failed');
        setStarting(false);
        return;
      }
      store(STATE_KEY, nonce);
      store(RETURN_KEY, returnParam && SHOPIFY_ADMIN_RE.test(returnParam) ? returnParam : null);
      window.location.assign(url);
    } catch {
      setStartFailure('failed');
      setStarting(false);
    }
  }

  const back = before?.back ?? null;

  /** Closes the tab the Shopify app's page opened; one that won't close goes back instead. */
  function backToShopify() {
    window.close();
    if (back) setTimeout(() => window.location.assign(back), 300);
  }

  if (linked && 'username' in linked) {
    return (
      <>
        <p className="mt-4 text-zinc-600 dark:text-zinc-400">
          {linked.username ? t('done', { username: linked.username }) : t('doneNoName')}
        </p>
        {back && (
          <>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{t('doneHint')}</p>
            <button type="button" onClick={backToShopify} className={`${PRIMARY} mt-8`}>
              {t('back')}
            </button>
          </>
        )}
      </>
    );
  }

  if ((outcome === 'link' && !linked) || outcome === 'pending') {
    return <p className="mt-4 text-zinc-600 dark:text-zinc-400">{t('linking')}</p>;
  }

  if (email === undefined) return null;

  const returnFailure: EbayFailure | null =
    linked && 'failure' in linked
      ? linked.failure
      : outcome === 'expired' || outcome === 'declined'
        ? outcome
        : null;
  const failure = startFailure ?? (acted ? null : returnFailure);
  const failureText = failure && <p className="mt-4 text-sm text-red-600">{t(failure)}</p>;

  if (email === null || (linked && 'signedOut' in linked && linked.signedOut && !acted)) {
    const query = new URLSearchParams();
    if (returnParam) query.set('return', returnParam);
    if (accountMask) query.set('account', accountMask);
    const qs = query.toString();
    const next = `/ebay/connect${qs ? `?${qs}` : ''}`;
    return (
      <>
        {failureText}
        <p className="mt-4 text-zinc-600 dark:text-zinc-400">{t('signedOut')}</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href={`/auth/login?next=${encodeURIComponent(next)}`} className={PRIMARY}>
            {t('login')}
          </Link>
          <Link href="/auth/signup" className={SECONDARY}>
            {t('signup')}
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      {failureText}
      <p className="mt-4 text-zinc-600 dark:text-zinc-400">{t('confirm', { email })}</p>
      {accountMask && !matchesMaskedEmail(email, accountMask) && (
        <p className="mt-4 text-sm text-amber-700 dark:text-amber-400">
          {t('otherAccount', { email, account: accountMask })}
        </p>
      )}
      <button type="button" onClick={start} disabled={starting} className={`${PRIMARY} mt-8`}>
        {starting ? t('starting') : failure ? t('tryAgain') : t('connect')}
      </button>
    </>
  );
}
