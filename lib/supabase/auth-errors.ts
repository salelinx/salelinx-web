import type { AuthError } from "@supabase/supabase-js";

/**
 * Did `getUser()` fail because we could not REACH auth, rather than because
 * the caller has no session?
 *
 * The distinction matters because every gated page treats a null user the
 * same way: redirect to /auth/login. During the 2026-09-16 outage that meant
 * signed-in users were bounced to a login page they then could not use —
 * indistinguishable, from their side, from being silently logged out. The
 * error that would have explained it was being discarded at the call site.
 *
 * Callers throw on true, so the locale error boundary can check the health
 * probe and say "we're temporarily down" instead.
 *
 * Deliberately conservative: only the statuses that genuinely mean "auth
 * answered, and the answer is that you are not signed in" count as a real
 * absence of session. Anything else — a transport failure (no status at all),
 * a 5xx, a gateway timeout — is treated as unreachable, because wrongly
 * showing an outage notice is a much smaller harm than wrongly telling
 * someone they are logged out.
 */
export function isAuthUnreachable(error: AuthError | null | undefined): boolean {
  if (!error) return false;
  if (error.name === "AuthSessionMissingError") return false;
  const status = error.status;
  if (status === 400 || status === 401 || status === 403) return false;
  return true;
}
