import { createServerClient } from "./server";

export type ReferralStatus =
  | "pending"
  | "converted"
  | "rewarding"
  | "rewarded"
  | "void";

type ReferralRow = {
  status: ReferralStatus;
  reward_amount_cents: number | null;
  reward_currency: string | null;
};

export type ReferralSummary = {
  code: string | null;
  // Signed up through the link, hasn't paid yet
  pending: number;
  // First paid invoice seen; reward inside the 7-day hold or being granted
  converting: number;
  // Free months already credited
  rewarded: number;
  rewardedTotalCents: number;
  rewardCurrency: string | null;
};

// Loads (and lazily creates) the user's share code plus their referral
// stats for the /account card. The referrals SELECT runs under the
// "referrals referrer read" RLS policy, so it only ever sees the caller's
// own rows.
export async function getReferralSummary(): Promise<ReferralSummary> {
  const supabase = await createServerClient();

  const [{ data: code }, { data: rows }] = await Promise.all([
    supabase.rpc("get_or_create_referral_code"),
    supabase
      .from("referrals")
      .select("status, reward_amount_cents, reward_currency"),
  ]);

  const summary: ReferralSummary = {
    code: typeof code === "string" ? code : null,
    pending: 0,
    converting: 0,
    rewarded: 0,
    rewardedTotalCents: 0,
    rewardCurrency: null,
  };

  for (const row of (rows ?? []) as ReferralRow[]) {
    if (row.status === "pending") summary.pending += 1;
    if (row.status === "converted" || row.status === "rewarding") {
      summary.converting += 1;
    }
    if (row.status === "rewarded") {
      summary.rewarded += 1;
      summary.rewardedTotalCents += row.reward_amount_cents ?? 0;
      summary.rewardCurrency = row.reward_currency ?? summary.rewardCurrency;
    }
  }

  return summary;
}
