'use client';

import { useSyncExternalStore } from 'react';

// Whether we have hydrated on the client. Implemented with
// useSyncExternalStore (server snapshot false, client snapshot true) instead of
// a mount-effect setState, so it reads as a client-only value without
// triggering a cascading render. Used to gate UI that can only be computed on
// the client (theme icon, cookie banner visibility) without a hydration
// mismatch.
const noopSubscribe = () => () => {};

export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}
