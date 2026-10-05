'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { createBrowserClient } from '@/lib/supabase/client';
import { BlockingWall } from '@/components/BlockingWall';
import { CONSENT_DECIDED_EVENT, cookieChoicePending } from '@/components/CookieConsent';
import {
  isMarketingPromptExempt,
  marketingChoice,
  saveMarketingChoice,
} from '@/lib/marketing-choice';

// Asks a signed-in user who has never answered whether they want marketing
// email, and walls the page until they pick. The signup form asks the same
// question, so this catches everyone it could not: Google sign-ups from the
// login page, accounts made in the extension, and accounts older than the
// question. See lib/marketing-choice.ts for where the answer is stored.
//
// Yes and No share one style on purpose. Consent only counts if refusing is
// as easy as agreeing, and nothing else on the site depends on the answer.
//
// Shows after the cookie wall, never with it: two BlockingWalls would make
// each other inert.
export function MarketingChoicePrompt() {
  const t = useTranslations('EmailChoice');
  const pathname = usePathname();
  const router = useRouter();
  // Signed-in user whose session copy of the metadata holds no answer.
  const [candidate, setCandidate] = useState<string | null>(null);
  // The same user once the server agrees. The session copy can be up to an
  // hour stale, and asking someone who answered on another device would be
  // worse than one extra request for the few who have not answered at all.
  const [unanswered, setUnanswered] = useState<string | null>(null);
  const [cookiePending, setCookiePending] = useState<boolean>(
    () => typeof document !== 'undefined' && cookieChoicePending(),
  );
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const supabase = createBrowserClient();
    // Fires on subscribe with the current session, then on sign-in and on
    // USER_UPDATED, which is how a saved answer closes the prompt.
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user;
      setCandidate(user && marketingChoice(user.user_metadata) === null ? user.id : null);
    });
    const cookieDecided = () => setCookiePending(false);
    window.addEventListener(CONSENT_DECIDED_EVENT, cookieDecided);
    return () => {
      data.subscription.unsubscribe();
      window.removeEventListener(CONSENT_DECIDED_EVENT, cookieDecided);
    };
  }, []);

  useEffect(() => {
    if (!candidate) return;
    let cancelled = false;
    // Not inside the onAuthStateChange callback: supabase-js deadlocks on
    // auth calls made from there.
    createBrowserClient()
      .auth.getUser()
      .then(({ data }) => {
        const user = data.user;
        if (cancelled || !user || user.id !== candidate) return;
        if (marketingChoice(user.user_metadata) === null) setUnanswered(candidate);
      });
    return () => {
      cancelled = true;
    };
  }, [candidate]);

  if (
    !candidate ||
    unanswered !== candidate ||
    cookiePending ||
    isMarketingPromptExempt(pathname)
  ) {
    return null;
  }

  async function answer(wanted: boolean) {
    setBusy(true);
    setFailed(false);
    const { error } = await saveMarketingChoice(createBrowserClient(), wanted);
    setBusy(false);
    if (error) {
      setFailed(true);
      return;
    }
    setUnanswered(null);
    // So the Email preferences card on /account shows the answer.
    router.refresh();
  }

  const buttonClass =
    'rounded-full bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-zinc-200';

  return (
    <BlockingWall label={t('title')}>
      <div className="m-auto w-full max-w-md rounded-2xl border border-black/10 bg-white p-4 shadow-2xl shadow-black/10 motion-safe:animate-[popIn_0.45s_ease-out] dark:border-white/15 dark:bg-zinc-900 dark:shadow-black/40">
        <h2 className="text-center font-mono text-[0.68rem] uppercase tracking-[0.12em] text-zinc-600 dark:text-zinc-400">
          {t('title')}
        </h2>
        <p className="mt-2 text-center text-sm leading-snug text-zinc-600 dark:text-zinc-400">
          {t('body')}{' '}
          <Link
            href="/legal/privacy"
            className="underline underline-offset-2 transition hover:text-black dark:hover:text-white"
          >
            {t('privacyLink')}
          </Link>
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <button type="button" disabled={busy} onClick={() => answer(true)} className={buttonClass}>
            {t('yes')}
          </button>
          <button type="button" disabled={busy} onClick={() => answer(false)} className={buttonClass}>
            {t('no')}
          </button>
        </div>
        {failed ? (
          <p role="alert" className="mt-3 text-center text-sm text-red-600">
            {t('error')}
          </p>
        ) : null}
      </div>
    </BlockingWall>
  );
}
