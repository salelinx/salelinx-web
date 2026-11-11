"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createBrowserClient } from "@/lib/supabase/client";

export function useIsAuthed() {
  const [authed, setAuthed] = useState(false);
  useEffect(() => {
    const { data } = createBrowserClient().auth.onAuthStateChange((_event, session) =>
      setAuthed(Boolean(session)),
    );
    return () => data.subscription.unsubscribe();
  }, []);
  return authed;
}

export function AuthSwitch({ signedIn, signedOut }: { signedIn: ReactNode; signedOut: ReactNode }) {
  return useIsAuthed() ? signedIn : signedOut;
}
