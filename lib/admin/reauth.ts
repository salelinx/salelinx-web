import { createBrowserClient } from "@/lib/supabase/client";

// Step-up re-authentication for destructive admin actions (ticket delete,
// Stripe plan change, account deletion).
//
// With a TOTP factor enrolled, the step-up is an MFA re-verification: the
// admin enters a fresh 6-digit code, which proves possession of the second
// factor and keeps (or restores) the session at AAL2 - required by
// is_admin() and the admin Edge Functions since migration 009.
//
// Without a factor (pre-enrollment only), it falls back to re-entering the
// password. NOTE the fallback's sharp edge: signInWithPassword issues a
// FRESH session at AAL1, so once MFA enforcement is live an enrolled admin
// must never take this path - and cannot, because the factor check runs
// first. Callers use getReauthKind() to label the prompt correctly.
//
// Returns true on success; throws so callers can surface the error and abort
// the destructive action.

export type ReauthKind = "totp" | "password";

export async function getReauthKind(): Promise<ReauthKind> {
  const supabase = createBrowserClient();
  const { data } = await supabase.auth.mfa.listFactors();
  return data?.totp.some((f) => f.status === "verified") ? "totp" : "password";
}

export async function requireReauth(secret: string): Promise<boolean> {
  const supabase = createBrowserClient();

  const { data: factors } = await supabase.auth.mfa.listFactors();
  const totp = factors?.totp.find((f) => f.status === "verified");

  if (totp) {
    const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge(
      { factorId: totp.id },
    );
    if (chErr || !challenge) {
      throw new Error("Could not start verification. Please try again.");
    }
    const { error } = await supabase.auth.mfa.verify({
      factorId: totp.id,
      challengeId: challenge.id,
      code: secret.trim(),
    });
    if (error) {
      throw new Error("Incorrect code.");
    }
    return true;
  }

  const { data, error: userErr } = await supabase.auth.getUser();
  const email = data.user?.email;
  if (userErr || !email) {
    throw new Error("Could not verify your session. Please sign in again.");
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: secret,
  });
  if (error) {
    throw new Error("Incorrect password.");
  }

  return true;
}
