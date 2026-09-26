'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { trackPurchaseConversion, trackSignupConversion } from '@/lib/tracking';

// Fires Ads conversions from URL markers: ?checkout=success (Stripe Checkout
// return, keyed by session_id) and ?signup=google (first Google sign-in, set by
// /auth/callback). Mounted once in the locale layout; invisible.
//
// The params survive reloads and the account page's success banner depends on
// checkout=success, so they are not stripped; sessionStorage dedupes instead.

function fireOnce(key: string, fire: () => void) {
  try {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
  } catch {
    // Storage unavailable (private mode restrictions): still fire once.
  }
  fire();
}

function Tracker() {
  const params = useSearchParams();
  const checkout = params.get('checkout') === 'success';
  const sessionId = params.get('session_id');
  const googleSignup = params.get('signup') === 'google';

  useEffect(() => {
    if (checkout) fireOnce(`slx_purchase_tracked_${sessionId ?? 'unknown'}`, trackPurchaseConversion);
    if (googleSignup) fireOnce('slx_signup_tracked', () => trackSignupConversion('google'));
  }, [checkout, sessionId, googleSignup]);

  return null;
}

export function ConversionTracker() {
  // useSearchParams needs a Suspense boundary during prerender.
  return (
    <Suspense fallback={null}>
      <Tracker />
    </Suspense>
  );
}
