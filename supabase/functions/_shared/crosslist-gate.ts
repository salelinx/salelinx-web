// Can this user crosslist right now? The server-side crosslist paywall.
//
// Every server path that produces a crosslist must call this: resolve-category
// (no crosslist can get a category without it) and the ebay function's `add`
// (which posts the eBay copy itself, so without this check anyone could post
// to eBay past their plan by calling the function directly). The extension
// gates client-side too, but that check reads local state a user can patch.
//
// The rule: the caller's tier must allow crosslisting, and they must not have
// used up their monthly crosslist allowance. Admins pass at the Business
// allowance (unlimited). Nothing is counted here: the extension increments the
// counter after a crosslist succeeds.
//
// Reads go through the caller's user-scoped client on purpose, so the "own
// read" RLS policies apply and this can only ever see the caller's own rows.

import { isSubscriptionEntitled } from './entitlement.ts';

// Statuses worth fetching. Entitlement is then decided by
// isSubscriptionEntitled, which additionally refuses a past_due row that has
// never paid or has run past its grace window. Mirrors ENTITLED_STATUSES in the
// extension's utils/cloud/subscription.ts and CURRENT_STATUSES in
// lib/supabase/subscription.ts.
const ENTITLED_STATUSES = ['active', 'trialing', 'past_due'];

export type CrosslistGate =
  | { ok: true }
  | { ok: false; status: 403 | 500; body: { error: string; code?: string } };

/** UTC month key, matching what increment_usage_counter writes. */
export function monthKey(now: Date = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

const FAILED: CrosslistGate = { ok: false, status: 500, body: { error: 'Entitlement check failed' } };

// deno-lint-ignore no-explicit-any
export async function checkCrosslistAllowed(userScoped: any, userId: string, tag: string): Promise<CrosslistGate> {
  const { data: sub, error: subErr } = await userScoped
    .from('subscriptions')
    // stripe_subscription_id and current_period_end are what let
    // isSubscriptionEntitled expire a comp row. Without both, a comped month
    // would keep crosslisting working after the website said it had ended.
    .select(
      'tier_id, tier_version, status, first_paid_at, past_due_since, stripe_subscription_id, current_period_end',
    )
    .in('status', ENTITLED_STATUSES)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (subErr) {
    console.error(`[${tag}] subscription lookup failed:`, subErr.message);
    return FAILED;
  }

  // No entitled subscription at all means no plan: cap stays 0 and the
  // request is refused below. There is no free tier to fall back to.
  //
  // A past_due row reaching here is not automatically entitled: a first-ever
  // charge that failed (a trial that never converted) is refused outright,
  // and an established customer gets a bounded grace window. See
  // entitlement.ts.
  let monthlyCap: number | null = 0;
  if (sub && isSubscriptionEntitled(sub)) {
    // A trialing row resolves to the 'trial' tier, not the Starter tier Stripe
    // billed it against: the trial is capped tighter than Starter on purpose.
    // Mirrors the extension's utils/cloud/subscription.ts and the website's
    // lib/supabase/subscription.ts - all three must agree or the server would
    // grant a trialing user Starter's allowance.
    const isTrialing = sub.status === 'trialing';
    const tierId = isTrialing ? 'trial' : sub.tier_id;
    const tierVersion = isTrialing ? 1 : sub.tier_version;

    const { data: tier, error: tierErr } = await userScoped
      .from('tier_limits')
      .select('limits')
      .eq('tier_id', tierId)
      .eq('version', tierVersion)
      .maybeSingle();
    if (tierErr) {
      console.error(`[${tag}] tier lookup failed:`, tierErr.message);
      return FAILED;
    }
    // null = unlimited; a missing key is treated as unlimited to match the
    // extension's gate, which reads an absent key as "not applicable".
    const limits = tier?.limits ?? {};
    monthlyCap = 'crosslists_per_month' in limits ? limits.crosslists_per_month : null;
  }

  // Admins crosslist without a plan, at the Business allowance, which is
  // unlimited. The extension already grants them full access locally
  // (utils/cloud/subscription.ts, ADMIN_DEFAULT_TIER_ID = 'business'), so
  // without this the panel shows crosslisting unlocked and every call fails
  // here with upgrade_required.
  //
  // The "admin_users self read" policy is auth.uid() = user_id, so this can
  // only ever return the caller's own row and a non-admin gets nothing back.
  //
  // Not is_admin(): that requires AAL2 (003_support.sql) and the extension has
  // no MFA flow, so gating on it would refuse every admin forever.
  const { data: adminRow, error: adminErr } = await userScoped
    .from('admin_users')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (adminErr) {
    console.error(`[${tag}] admin lookup failed:`, adminErr.message);
    return FAILED;
  }
  // null is "unlimited" to the cap check below, so this both clears the
  // refusal and skips the monthly counter, matching Business exactly.
  if (adminRow) monthlyCap = null;

  if (monthlyCap === 0) {
    return {
      ok: false,
      status: 403,
      body: { error: 'Your plan does not include crosslisting', code: 'upgrade_required' },
    };
  }

  if (typeof monthlyCap === 'number') {
    const { data: usage, error: usageErr } = await userScoped
      .from('usage_counters')
      .select('count')
      .eq('user_id', userId)
      .eq('feature', 'crosslist')
      .eq('period_key', monthKey())
      .maybeSingle();
    if (usageErr) {
      console.error(`[${tag}] usage lookup failed:`, usageErr.message);
      return FAILED;
    }
    if ((usage?.count ?? 0) >= monthlyCap) {
      return {
        ok: false,
        status: 403,
        body: { error: 'Monthly crosslist limit reached', code: 'limit_reached' },
      };
    }
  }

  return { ok: true };
}
