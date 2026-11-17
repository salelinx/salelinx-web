// The hourly plan sweep (syncDueStores) and the rule every write goes through (writeFor), against
// a stand-in database and Partner API.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type SubscriptionRow,
  dueStores,
  syncDueStores,
  writeFor,
} from '../supabase/functions/_shared/shopify-billing';

const NOW = Date.parse('2026-11-17T12:00:00Z');
const days = (n: number) => new Date(NOW + n * 24 * 60 * 60 * 1000).toISOString();

const row = (shop: string, over: Partial<SubscriptionRow> = {}): SubscriptionRow => ({
  id: `sub-${shop}`,
  user_id: `user-${shop}`,
  tier_id: 'starter',
  status: 'active',
  current_period_end: days(10),
  cancel_at_period_end: false,
  first_paid_at: days(-30),
  past_due_since: null,
  stripe_subscription_id: null,
  shopify_shop_id: shop,
  created_at: days(-30),
  updated_at: days(-1),
  ...over,
});

describe('which stores a run reads', () => {
  it('takes lapsed periods first, then the stalest, one per store, up to the limit', () => {
    const lapsed = [row('1'), row('2')];
    const stale = [row('2'), row('3'), row('4')];
    expect(dueStores(lapsed, stale, 3).map((r) => r.shopify_shop_id)).toEqual(['1', '2', '3']);
  });
});

describe('what a store plan writes', () => {
  const plan = { tierId: 'pro', status: 'active' as const, periodEnd: days(30), cancelAtPeriodEnd: false };

  it('never writes a live Shopify plan over a live Stripe one', () => {
    expect(writeFor(plan, row('1'), true, new Date(NOW))).toBeNull();
  });

  it('still ends a Shopify row whose plan has gone, Stripe or not', () => {
    expect(writeFor(null, row('1'), true, new Date(NOW))).toMatchObject({ status: 'canceled' });
  });

  it('writes the plan when Stripe owns nothing', () => {
    expect(writeFor(plan, null, false, new Date(NOW))).toMatchObject({ tier_id: 'pro', status: 'active' });
  });
});

/** A service-role client over the given rows: the sweep's two queries, and what syncStorePlan reads and writes. */
function fakeAdmin(lapsed: SubscriptionRow[], stale: SubscriptionRow[]) {
  const writes: Record<string, unknown>[] = [];
  const all = [...lapsed, ...stale];
  const from = () => {
    const ops: Record<string, unknown[][]> = {};
    // deno-lint-ignore no-explicit-any
    const chain: any = {};
    for (const m of ['select', 'not', 'in', 'lt', 'order', 'limit', 'eq', 'upsert', 'update']) {
      chain[m] = (...args: unknown[]) => {
        (ops[m] ??= []).push(args);
        if (m === 'upsert' || m === 'update') writes.push(args[0] as Record<string, unknown>);
        return chain;
      };
    }
    const result = () => {
      if (ops.not) {
        return { data: ops.order?.[0]?.[0] === 'current_period_end' ? lapsed : stale, error: null };
      }
      if (ops.upsert) {
        const w = ops.upsert[0][0] as Record<string, unknown>;
        return { data: { ...row(String(w.shopify_shop_id)), ...w }, error: null };
      }
      if (ops.update) return { data: null, error: null };
      const [col, value] = (ops.eq?.[0] ?? []) as [string, string];
      if (col === 'user_id') return { data: [], error: null };
      if (col === 'shopify_shop_id') {
        return { data: all.find((r) => r.shopify_shop_id === value) ?? null, error: null };
      }
      return { data: null, error: null };
    };
    chain.maybeSingle = async () => result();
    chain.single = async () => result();
    chain.then = (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) =>
      Promise.resolve(result()).then(ok, bad);
    return chain;
  };
  return { admin: { from }, writes };
}

const SECRETS: Record<string, string> = {
  SHOPIFY_PARTNER_ID: '111',
  SHOPIFY_PARTNER_TOKEN: 'token',
  SHOPIFY_APP_ID: '222',
};

describe('the hourly sweep', () => {
  beforeEach(() => {
    vi.stubGlobal('Deno', { env: { get: (k: string) => SECRETS[k] } });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reads each due store again and writes what Shopify says', async () => {
    const read: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: { body: string }) => {
        const shop = String(JSON.parse(init.body).variables.shopId).split('/').pop()!;
        read.push(shop);
        // Store 1's trial has converted; store 2 has cancelled.
        const sub =
          shop === '1'
            ? { trialEndsAt: null, currentBillingCycle: { endTime: days(30) }, items: [{ handle: 'starter' }] }
            : null;
        return new Response(JSON.stringify({ data: { activeSubscription: sub } }));
      }),
    );
    const { admin, writes } = fakeAdmin(
      [row('1', { status: 'trialing', current_period_end: days(-1), first_paid_at: null })],
      [row('2')],
    );
    expect(await syncDueStores(admin, NOW)).toEqual({ read: 2, failed: 0, stopped: null });
    expect(read).toEqual(['1', '2']);
    expect(writes[0]).toMatchObject({ shopify_shop_id: '1', status: 'active', current_period_end: days(30) });
    expect(writes[1]).toMatchObject({ status: 'canceled' });
  });

  it('stops the run when Shopify throttles it', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 429 })));
    // Stores of their own: a store read a moment ago is served from the module's short cache.
    const { admin, writes } = fakeAdmin([row('5')], [row('6')]);
    expect(await syncDueStores(admin, NOW)).toEqual({ read: 0, failed: 0, stopped: 'busy' });
    expect(writes).toEqual([]);
  });
});
