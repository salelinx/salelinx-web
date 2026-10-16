// The crosslist paywall shared by resolve-category and the ebay function's add.
// A fake user-scoped client stands in for Supabase: each table returns one
// configured row, and the filters each query used are recorded so the tests
// can check which tier and month were asked for.

import { describe, expect, it } from 'vitest';

const { checkCrosslistAllowed, monthKey } = await import('../supabase/functions/_shared/crosslist-gate');

type Row = { data: unknown; error?: { message: string } | null };

function fakeClient(tables: Record<string, Row>) {
  const filters: Record<string, Array<[string, unknown]>> = {};
  return {
    filters,
    from(table: string) {
      const row = tables[table] ?? { data: null };
      filters[table] = [];
      const q = {
        select: () => q,
        in: () => q,
        order: () => q,
        limit: () => q,
        eq: (col: string, value: unknown) => {
          filters[table].push([col, value]);
          return q;
        },
        maybeSingle: async () => ({ data: row.data, error: row.error ?? null }),
      };
      return q;
    },
  };
}

const FUTURE = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
const activePro = {
  tier_id: 'pro',
  tier_version: 1,
  status: 'active',
  first_paid_at: '2026-09-01T00:00:00Z',
  past_due_since: null,
  stripe_subscription_id: 'sub_123',
  current_period_end: FUTURE,
};

describe('checkCrosslistAllowed', () => {
  it('refuses a user with no plan', async () => {
    const gate = await checkCrosslistAllowed(fakeClient({}), 'u1', 'test');
    expect(gate).toEqual({
      ok: false,
      status: 403,
      body: { error: 'Your plan does not include crosslisting', code: 'upgrade_required' },
    });
  });

  it('lets an admin through with no plan', async () => {
    const gate = await checkCrosslistAllowed(fakeClient({ admin_users: { data: { user_id: 'u1' } } }), 'u1', 'test');
    expect(gate).toEqual({ ok: true });
  });

  it('allows a plan under its monthly cap and reads this month', async () => {
    const client = fakeClient({
      subscriptions: { data: activePro },
      tier_limits: { data: { limits: { crosslists_per_month: 3500 } } },
      usage_counters: { data: { count: 10 } },
    });
    expect(await checkCrosslistAllowed(client, 'u1', 'test')).toEqual({ ok: true });
    expect(client.filters.usage_counters).toContainEqual(['period_key', monthKey()]);
    expect(client.filters.usage_counters).toContainEqual(['feature', 'crosslist']);
  });

  it('refuses a plan that has used its monthly cap', async () => {
    const client = fakeClient({
      subscriptions: { data: activePro },
      tier_limits: { data: { limits: { crosslists_per_month: 150 } } },
      usage_counters: { data: { count: 150 } },
    });
    const gate = await checkCrosslistAllowed(client, 'u1', 'test');
    expect(gate).toMatchObject({ ok: false, status: 403, body: { code: 'limit_reached' } });
  });

  it('treats a null cap as unlimited without reading usage', async () => {
    const client = fakeClient({
      subscriptions: { data: activePro },
      tier_limits: { data: { limits: { crosslists_per_month: null } } },
    });
    expect(await checkCrosslistAllowed(client, 'u1', 'test')).toEqual({ ok: true });
    expect(client.filters.usage_counters).toBeUndefined();
  });

  it('caps a trialing subscription at the trial tier', async () => {
    const client = fakeClient({
      subscriptions: { data: { ...activePro, status: 'trialing', tier_id: 'starter' } },
      tier_limits: { data: { limits: { crosslists_per_month: 50 } } },
      usage_counters: { data: { count: 0 } },
    });
    expect(await checkCrosslistAllowed(client, 'u1', 'test')).toEqual({ ok: true });
    expect(client.filters.tier_limits).toEqual([
      ['tier_id', 'trial'],
      ['version', 1],
    ]);
  });

  it('fails closed when a lookup errors', async () => {
    const client = fakeClient({ subscriptions: { data: null, error: { message: 'boom' } } });
    const gate = await checkCrosslistAllowed(client, 'u1', 'test');
    expect(gate).toEqual({ ok: false, status: 500, body: { error: 'Entitlement check failed' } });
  });
});

describe('monthKey', () => {
  it('is the UTC year and month', () => {
    expect(monthKey(new Date('2026-01-31T23:30:00Z'))).toBe('2026-01');
    expect(monthKey(new Date('2026-12-01T00:00:00Z'))).toBe('2026-12');
  });
});
