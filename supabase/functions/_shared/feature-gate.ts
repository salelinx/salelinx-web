// Does the caller's plan include this feature? The server's check, for calls a
// script could make without the extension, whose own check reads local state a
// user can patch. Follows the same plan rules as crosslist-gate.ts.
//
// Reads go through the caller's user-scoped client on purpose, so the "own read"
// RLS policies apply and this can only ever see the caller's own rows.

import { isSubscriptionEntitled } from './entitlement.ts';

// Statuses worth fetching. Entitlement is then decided by isSubscriptionEntitled.
const ENTITLED_STATUSES = ['active', 'trialing', 'past_due'];

export type FeatureGate =
  { ok: true } | { ok: false; status: 403 | 500; body: { error: string; code?: string } };

const FAILED: FeatureGate = {
  ok: false,
  status: 500,
  body: { error: 'Entitlement check failed' },
};
const REFUSED: FeatureGate = {
  ok: false,
  status: 403,
  body: {
    error: 'Your plan does not include this feature',
    code: 'upgrade_required',
  },
};

/** The same rule as the extension's checkFeature: the key must be exactly true. */
export async function checkFeatureAllowed(
  // deno-lint-ignore no-explicit-any
  userScoped: any,
  userId: string,
  feature: string,
  tag: string,
): Promise<FeatureGate> {
  const { data: sub, error: subErr } = await userScoped
    .from('subscriptions')
    // stripe_subscription_id and current_period_end are what let
    // isSubscriptionEntitled expire a comp row.
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

  let included = false;
  if (sub && isSubscriptionEntitled(sub)) {
    // A trialing row resolves to the 'trial' tier, not the tier Stripe billed it
    // against, as in the extension's utils/cloud/subscription.ts.
    const isTrialing = sub.status === 'trialing';
    const { data: tier, error: tierErr } = await userScoped
      .from('tier_limits')
      .select('features')
      .eq('tier_id', isTrialing ? 'trial' : sub.tier_id)
      .eq('version', isTrialing ? 1 : sub.tier_version)
      .maybeSingle();
    if (tierErr) {
      console.error(`[${tag}] tier lookup failed:`, tierErr.message);
      return FAILED;
    }
    included = tier?.features?.[feature] === true;
  }

  // The extension grants admins full access locally, so without this the panel
  // shows a feature unlocked and every call fails here. Not is_admin(): that
  // requires AAL2 and the extension has no MFA flow.
  const { data: adminRow, error: adminErr } = await userScoped
    .from('admin_users')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (adminErr) {
    console.error(`[${tag}] admin lookup failed:`, adminErr.message);
    return FAILED;
  }

  return included || adminRow ? { ok: true } : REFUSED;
}
