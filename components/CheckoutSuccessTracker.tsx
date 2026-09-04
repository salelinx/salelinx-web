'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { trackPurchaseConversion } from '@/lib/tracking';

// Fires the purchase conversion when Stripe Checkout lands the customer back
// on /account?checkout=success. Rendered by the account page (a Server
// Component); invisible.
//
// The URL param survives reloads and the server-rendered success banner
// depends on it, so it is not stripped; instead sessionStorage dedupes the
// event, keyed by Stripe's session_id when present (create-checkout-session
// appends it) so a reload or a second checkout in the same tab both count
// exactly once.

function Tracker() {
  const params = useSearchParams();
  const success = params.get('checkout') === 'success';
  const sessionId = params.get('session_id');

  useEffect(() => {
    if (!success) return;
    const key = `slx_purchase_tracked_${sessionId ?? 'unknown'}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch {
      // Storage unavailable (private mode restrictions): still fire once.
    }
    trackPurchaseConversion();
  }, [success, sessionId]);

  return null;
}

export function CheckoutSuccessTracker() {
  // useSearchParams needs a Suspense boundary during prerender.
  return (
    <Suspense fallback={null}>
      <Tracker />
    </Suspense>
  );
}
