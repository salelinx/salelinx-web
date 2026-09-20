"use server";

import { createServerClient } from "@/lib/supabase/server";

// Server action behind the Redeem button on /redeem/[code].
//
// The real boundary is the redeem_creator_code RPC (migration 021), which is
// SECURITY DEFINER, scopes everything to auth.uid() and marks the code spent in
// the same transaction as the comp row it writes. This wrapper only turns the
// Postgres error into something a person can read.

export type RedeemResult =
  | { ok: true; tierId: string; expiresAt: string | null }
  | { ok: false; error: string };

// Postgres raises these by name from the RPC. Anything else is a bug or an
// outage, and says so rather than guessing on the user's behalf.
const MESSAGES: Record<string, string> = {
  invalid_code: "That code is not valid. Check it against the email it came in.",
  already_redeemed: "That code has already been used.",
  already_subscribed:
    "You already have a subscription, so this code would be wasted. Email support@salelinx.com and we will apply it by hand.",
  "not authenticated": "Sign in first, then open this link again.",
};

export async function redeemCode(code: string): Promise<RedeemResult> {
  const supabase = await createServerClient();

  const { data, error } = await supabase.rpc("redeem_creator_code", {
    p_code: code,
  });

  if (error) {
    const known = Object.keys(MESSAGES).find((key) =>
      error.message.includes(key),
    );
    return {
      ok: false,
      error: known
        ? MESSAGES[known]
        : "Something went wrong redeeming that code. Try again, or email support@salelinx.com.",
    };
  }

  const result = data as { tier_id?: string; expires_at?: string } | null;
  return {
    ok: true,
    tierId: result?.tier_id ?? "",
    expiresAt: result?.expires_at ?? null,
  };
}
