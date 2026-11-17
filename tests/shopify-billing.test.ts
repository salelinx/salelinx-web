import { describe, expect, it } from 'vitest';
import {
  type SubscriptionRow,
  currentPlan,
  liveStripeRow,
  paidThrough,
  planPageUrl,
  planWrite,
  storePlan,
} from '../supabase/functions/_shared/shopify-billing';

const NOW = Date.parse('2026-11-16T12:00:00Z');
const days = (n: number) => new Date(NOW + n * 24 * 60 * 60 * 1000).toISOString();

const row = (over: Partial<SubscriptionRow>): SubscriptionRow => ({
  id: 'sub-1',
  user_id: 'user-1',
  tier_id: 'starter',
  status: 'active',
  current_period_end: days(20),
  cancel_at_period_end: false,
  first_paid_at: days(-40),
  past_due_since: null,
  stripe_subscription_id: null,
  shopify_shop_id: null,
  created_at: days(-40),
  updated_at: days(-1),
  ...over,
});

describe("Shopify's activeSubscription", () => {
  it('reads no subscription as no plan', () => {
    expect(storePlan(null, NOW)).toEqual({ plan: null, unknown: false });
  });

  it('reads a trial: Shopify gives its end and no billing cycle', () => {
    const { plan } = storePlan(
      { trialEndsAt: days(14), currentBillingCycle: null, cancelAtEndOfCycle: false, items: [{ handle: 'starter' }] },
      NOW,
    );
    expect(plan).toEqual({
      tierId: 'starter',
      status: 'trialing',
      periodEnd: days(14),
      cancelAtPeriodEnd: false,
    });
  });

  it('reads a paid plan to the end of its billing cycle', () => {
    const { plan } = storePlan(
      {
        trialEndsAt: null,
        currentBillingCycle: { endTime: days(25) },
        cancelAtEndOfCycle: true,
        items: [{ handle: 'pro' }],
      },
      NOW,
    );
    expect(plan).toEqual({
      tierId: 'pro',
      status: 'active',
      periodEnd: days(25),
      cancelAtPeriodEnd: true,
    });
  });

  it('reads a trial end that has gone by as a paid plan', () => {
    const { plan } = storePlan(
      { trialEndsAt: days(-1), currentBillingCycle: { endTime: days(29) }, items: [{ handle: 'starter' }] },
      NOW,
    );
    expect(plan?.status).toBe('active');
    expect(plan?.periodEnd).toBe(days(29));
  });

  it('gives no tier to a handle SaleLinx does not sell', () => {
    expect(storePlan({ items: [{ handle: 'starter-annual' }] }, NOW)).toEqual({
      plan: null,
      unknown: true,
    });
  });
});

describe('a live Stripe plan', () => {
  it('is found while Stripe owns it, dunning included', () => {
    for (const status of ['active', 'trialing', 'past_due']) {
      expect(liveStripeRow([row({ status, stripe_subscription_id: 'sub_1' })], NOW)).not.toBeNull();
    }
  });

  it('is not an expired trial, an ended plan, a comp or a Shopify row', () => {
    expect(
      liveStripeRow(
        [
          row({ status: 'trialing', stripe_subscription_id: 'sub_1', current_period_end: days(-2) }),
          row({ status: 'canceled', stripe_subscription_id: 'sub_2' }),
          row({}),
          row({ shopify_shop_id: '123' }),
        ],
        NOW,
      ),
    ).toBeNull();
  });
});

describe("the store's row", () => {
  const trial = { tierId: 'starter', status: 'trialing' as const, periodEnd: days(14), cancelAtPeriodEnd: false };
  const paid = { tierId: 'pro', status: 'active' as const, periodEnd: days(30), cancelAtPeriodEnd: false };

  it('starts a trial with no payment stamped', () => {
    expect(planWrite(trial, null, new Date(NOW))).toMatchObject({
      tier_id: 'starter',
      status: 'trialing',
      current_period_end: days(14),
      first_paid_at: null,
    });
  });

  it('stamps the first payment once, and keeps it', () => {
    expect(planWrite(paid, null, new Date(NOW))?.first_paid_at).toBe(new Date(NOW).toISOString());
    const earlier = days(-60);
    expect(planWrite(paid, row({ first_paid_at: earlier }), new Date(NOW))?.first_paid_at).toBe(earlier);
  });

  it('ends a live row when the plan has gone', () => {
    expect(planWrite(null, row({ shopify_shop_id: '123' }), new Date(NOW))).toMatchObject({
      status: 'canceled',
      cancel_at_period_end: false,
    });
  });

  it('leaves nothing to write with no plan and no live row', () => {
    expect(planWrite(null, null, new Date(NOW))).toBeNull();
    expect(planWrite(null, row({ status: 'canceled' }), new Date(NOW))).toBeNull();
  });
});

describe("the account's plan", () => {
  it('is the newest entitled row, and who pays for it', () => {
    const shopify = row({ id: 'shop', shopify_shop_id: '123', created_at: days(-1) });
    const oldTrial = row({
      id: 'old',
      status: 'canceled',
      stripe_subscription_id: 'sub_1',
      created_at: days(-90),
    });
    const plan = currentPlan([oldTrial, shopify], NOW);
    expect(plan?.id).toBe('shop');
    expect(paidThrough(plan!)).toBe('shopify');
  });

  it("keeps a Shopify row past its cycle end, as it is a renewal date", () => {
    const shopify = row({ shopify_shop_id: '123', current_period_end: days(-1) });
    expect(currentPlan([shopify], NOW)).not.toBeNull();
  });

  it('is none when nothing is entitled', () => {
    expect(currentPlan([row({ status: 'canceled' })], NOW)).toBeNull();
  });

  it('names a comp and a Stripe plan', () => {
    expect(paidThrough(row({}))).toBe('comp');
    expect(paidThrough(row({ stripe_subscription_id: 'sub_1' }))).toBe('stripe');
  });
});

describe("Shopify's plan page", () => {
  it('is under the store handle and the app handle', () => {
    expect(planPageUrl('my-shop.myshopify.com', 'salelinx')).toBe(
      'https://admin.shopify.com/store/my-shop/charges/salelinx/pricing_plans',
    );
  });

  it('needs both', () => {
    expect(planPageUrl('my-shop.myshopify.com', null)).toBeNull();
    expect(planPageUrl('shop.example.com', 'salelinx')).toBeNull();
  });
});
