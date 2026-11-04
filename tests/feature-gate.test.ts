// The server's check that a plan includes a feature, as a script can call a
// function without the extension's own check. A fake user-scoped client stands in
// for Supabase: each table returns one configured row.

import { describe, expect, it, vi } from 'vitest';

const { checkFeatureAllowed } = await import('../supabase/functions/_shared/feature-gate');

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

const HOUR = 60 * 60 * 1000;
const FUTURE = new Date(Date.now() + 240 * HOUR).toISOString();
const PAST = new Date(Date.now() - 240 * HOUR).toISOString();
const active = {
  tier_id: 'starter',
  tier_version: 1,
  status: 'active',
  first_paid_at: '2026-09-01T00:00:00Z',
  past_due_since: null,
  stripe_subscription_id: 'sub_123',
  current_period_end: FUTURE,
};
const includes = { data: { limits: {}, features: { messages: true } } };

const allowed = (tables: Record<string, Row>) =>
  checkFeatureAllowed(fakeClient(tables), 'u1', 'messages', 'test');
const REFUSED = {
  ok: false,
  status: 403,
  body: {
    error: 'Your plan does not include this feature',
    code: 'upgrade_required',
  },
};

describe('checkFeatureAllowed', () => {
  it('allows a plan that includes the feature', async () => {
    expect(await allowed({ subscriptions: { data: active }, tier_limits: includes })).toEqual({
      ok: true,
    });
  });

  it('refuses a user with no plan, as there is no free tier', async () => {
    expect(await allowed({})).toEqual(REFUSED);
  });

  it('refuses a plan where the feature is off', async () => {
    const off = { data: { limits: {}, features: { messages: false } } };
    expect(await allowed({ subscriptions: { data: active }, tier_limits: off })).toEqual(REFUSED);
  });

  it('refuses a plan that doesn’t mention the feature, as the extension does', async () => {
    const none = { data: { limits: {}, features: {} } };
    expect(await allowed({ subscriptions: { data: active }, tier_limits: none })).toEqual(REFUSED);
    expect(
      await allowed({
        subscriptions: { data: active },
        tier_limits: { data: null },
      }),
    ).toEqual(REFUSED);
  });

  it('only counts a key that is exactly true', async () => {
    const truthy = { data: { limits: {}, features: { messages: 'true' } } };
    expect(await allowed({ subscriptions: { data: active }, tier_limits: truthy })).toEqual(
      REFUSED,
    );
  });

  it('reads a trial from the trial tier', async () => {
    const trialing = { ...active, status: 'trialing', tier_version: 7 };
    const client = fakeClient({
      subscriptions: { data: trialing },
      tier_limits: includes,
    });
    expect(await checkFeatureAllowed(client, 'u1', 'messages', 'test')).toEqual({ ok: true });
    expect(client.filters.tier_limits).toEqual([
      ['tier_id', 'trial'],
      ['version', 1],
    ]);
  });

  it('reads a paid plan at the version it signed up on', async () => {
    const grandfathered = { ...active, tier_id: 'pro', tier_version: 3 };
    const client = fakeClient({
      subscriptions: { data: grandfathered },
      tier_limits: includes,
    });
    await checkFeatureAllowed(client, 'u1', 'messages', 'test');
    expect(client.filters.tier_limits).toEqual([
      ['tier_id', 'pro'],
      ['version', 3],
    ]);
  });

  it('refuses a trial past its end date', async () => {
    const over = { ...active, status: 'trialing', current_period_end: PAST };
    expect(await allowed({ subscriptions: { data: over }, tier_limits: includes })).toEqual(
      REFUSED,
    );
  });

  it('keeps a paying customer in their grace window, and no longer', async () => {
    const pastDue = (since: number) => ({
      ...active,
      status: 'past_due',
      past_due_since: new Date(Date.now() - since).toISOString(),
    });
    expect(
      await allowed({
        subscriptions: { data: pastDue(HOUR) },
        tier_limits: includes,
      }),
    ).toEqual({ ok: true });
    expect(
      await allowed({
        subscriptions: { data: pastDue(24 * 8 * HOUR) },
        tier_limits: includes,
      }),
    ).toEqual(REFUSED);
  });

  it('refuses a first charge that failed, which has never paid', async () => {
    const neverPaid = {
      ...active,
      status: 'past_due',
      first_paid_at: null,
      past_due_since: new Date().toISOString(),
    };
    expect(
      await allowed({
        subscriptions: { data: neverPaid },
        tier_limits: includes,
      }),
    ).toEqual(REFUSED);
  });

  it('lets an admin through with no plan', async () => {
    expect(await allowed({ admin_users: { data: { user_id: 'u1' } } })).toEqual({ ok: true });
  });

  it.each(['subscriptions', 'tier_limits', 'admin_users'])(
    'refuses when %s can’t be read',
    async (table) => {
      const log = vi.spyOn(console, 'error').mockImplementation(() => {});
      const tables: Record<string, Row> = {
        subscriptions: { data: active },
        tier_limits: includes,
        [table]: { data: null, error: { message: 'down' } },
      };
      const gate = await allowed(tables);
      expect(gate).toEqual({
        ok: false,
        status: 500,
        body: { error: 'Entitlement check failed' },
      });
      log.mockRestore();
    },
  );
});
