import type { SupabaseClient } from '@supabase/supabase-js';

// Whether a user wants marketing email (the trial reminders and win-back
// offers sent by the trial-nudge Edge Function). The answer lives in auth
// user metadata as `marketing_opt_out`, the key trial_nudge_due() and
// winback_due() read (migration 028):
//
//   true     said no    never emailed
//   false    said yes
//   absent   not asked yet. MarketingChoicePrompt asks on the next signed-in
//            visit; until then the soft opt-in in docs/GDPR.md applies.
//
// Every account is asked: the signup page will not submit without an answer,
// and anyone who got an account another way (Google from the login page, the
// extension, accounts older than the question) is asked by the prompt.

export type MarketingChoice = 'yes' | 'no' | null;

export function marketingChoice(
  metadata: Record<string, unknown> | null | undefined,
): MarketingChoice {
  const optOut = metadata?.marketing_opt_out;
  if (optOut === true) return 'no';
  if (optOut === false) return 'yes';
  return null;
}

// The metadata written for an answer. The timestamp is the evidence of when
// the choice was made, like terms_accepted_at.
export function marketingChoiceMetadata(wanted: boolean, now: Date = new Date()) {
  return {
    marketing_opt_out: !wanted,
    marketing_choice_at: now.toISOString(),
  };
}

// Pages where the prompt stays out of the way: the legal pages (it links to
// the privacy policy, which has to stay readable before answering) and the
// auth flows (nobody should be walled halfway through a password reset or an
// MFA challenge). Takes the locale-less pathname from next-intl's usePathname.
export function isMarketingPromptExempt(pathname: string): boolean {
  return ['/legal', '/auth'].some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

// Stores an answer for the signed-in user. A yes also clears an earlier
// unsubscribe made from an email link, which the user cannot do directly
// (trial_nudges has no client policies), so it goes through an RPC.
export async function saveMarketingChoice(
  supabase: SupabaseClient,
  wanted: boolean,
): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.updateUser({
    data: marketingChoiceMetadata(wanted),
  });
  if (error) return { error: error.message };
  if (wanted) {
    const { error: rpcError } = await supabase.rpc('clear_marketing_unsubscribe');
    if (rpcError) return { error: rpcError.message };
  }
  return { error: null };
}
