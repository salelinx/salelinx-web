// Account deletion's Shopify step (cancelAccountStorePlans), against a stand-in Partner API: each
// store is read first and cancelled only while Shopify bills it, and a cancel that fails stops the
// deletion.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cancelAccountStorePlans } from '../supabase/functions/_shared/shopify-billing';

const SECRETS: Record<string, string> = {
  SHOPIFY_PARTNER_ID: '111',
  SHOPIFY_PARTNER_TOKEN: 'token',
  SHOPIFY_APP_ID: '222',
};

/** The account's subscriptions rows, as the service role reads them. */
const adminWith = (rows: Record<string, unknown>[]) => ({
  from: () => ({ select: () => ({ eq: async () => ({ data: rows, error: null }) }) }),
});

const PLAN = { trialEndsAt: null, currentBillingCycle: { endTime: '2026-12-16T00:00:00Z' }, items: [{ handle: 'pro' }] };

/** Shopify's answers: which stores have a plan, and what a cancel says. */
function partnerApi(billed: Set<string>, cancelErrors: { message: string }[] = []) {
  const calls: { kind: 'read' | 'cancel'; shop: string }[] = [];
  const fetchMock = vi.fn(async (_url: string, init: { body: string }) => {
    const { query, variables } = JSON.parse(init.body);
    const shop = String(variables.shopId).split('/').pop()!;
    if (query.includes('appSubscriptionCancel')) {
      calls.push({ kind: 'cancel', shop });
      return new Response(JSON.stringify({ data: { appSubscriptionCancel: { userErrors: cancelErrors } } }));
    }
    calls.push({ kind: 'read', shop });
    return new Response(JSON.stringify({ data: { activeSubscription: billed.has(shop) ? PLAN : null } }));
  });
  return { calls, fetchMock };
}

describe('cancelling Shopify plans on account deletion', () => {
  beforeEach(() => {
    vi.stubGlobal('Deno', { env: { get: (k: string) => SECRETS[k] } });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('cancels only the stores Shopify still bills', async () => {
    const { calls, fetchMock } = partnerApi(new Set(['1']));
    vi.stubGlobal('fetch', fetchMock);
    const rows = [
      { shopify_shop_id: '1', status: 'active' },
      { shopify_shop_id: '2', status: 'canceled' },
      { stripe_subscription_id: 'sub_1', shopify_shop_id: null, status: 'canceled' },
      { shopify_shop_id: null, status: 'active' },
    ];
    expect(await cancelAccountStorePlans(adminWith(rows), 'user-1')).toBe(1);
    expect(calls).toEqual([
      { kind: 'read', shop: '1' },
      { kind: 'cancel', shop: '1' },
      { kind: 'read', shop: '2' },
    ]);
  });

  it('asks Shopify nothing for an account with no store', async () => {
    const { fetchMock } = partnerApi(new Set());
    vi.stubGlobal('fetch', fetchMock);
    expect(await cancelAccountStorePlans(adminWith([{ status: 'active' }]), 'user-1')).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('stops the deletion when Shopify refuses to cancel a plan it still bills', async () => {
    const { fetchMock } = partnerApi(new Set(['1']), [{ message: 'nope' }]);
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      cancelAccountStorePlans(adminWith([{ shopify_shop_id: '1', status: 'active' }]), 'user-1'),
    ).rejects.toThrow('nope');
  });

  it('stops the deletion when billing is not set up but a store row exists', async () => {
    vi.stubGlobal('Deno', { env: { get: () => undefined } });
    await expect(
      cancelAccountStorePlans(adminWith([{ shopify_shop_id: '1', status: 'active' }]), 'user-1'),
    ).rejects.toThrow('not set up');
  });
});
