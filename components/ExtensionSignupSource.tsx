'use client';

import { useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';
import { storedSignupSource } from '@/lib/signup-source';

// Extension signups record source 'extension'. A visit to the site from before that signup is the
// truer first touch; later ones (the confirmation email link) are not.
export function ExtensionSignupSource() {
  useEffect(() => {
    const stored = storedSignupSource();
    if (!stored) return;
    const supabase = createBrowserClient();
    supabase.auth.getSession().then(({ data }) => {
      const current = data.session?.user.user_metadata?.signup_source;
      if (current?.source !== 'extension' || !(stored.at < current.at)) return;
      supabase.auth.updateUser({ data: { signup_source: stored } }).catch(() => {});
    });
  }, []);
  return null;
}
