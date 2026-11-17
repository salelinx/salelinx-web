// Shopify billing: what a store pays for SaleLinx under Shopify App Pricing, and the account's
// subscriptions row that carries it (migration 057). docs/EDGE-FUNCTIONS.md "Shopify billing".
//
// Who pays where. Stripe for everyone who was a SaleLinx customer before connecting a store; only
// a merchant who found SaleLinx in the App Store first pays through Shopify. So a store's plan is
// written only to an account with no live Stripe plan, and the app's page offers Shopify's plan
// page only to such an account. The extension cannot connect a store without a plan (its plan
// screen hides Settings and Install), so an extension user is a Stripe customer or a comp by then.
//
// App Pricing sends no webhooks for subscription changes after 2026-04-28. The plan is read from
// the Partner API's activeSubscription whenever it matters: the app's page opening, a store being
// connected to an account, the welcome link after a plan is chosen, and an uninstall. Plans are set
// in the Partner Dashboard with the handles starter, pro and business, which are SaleLinx's tier
// ids, so a handle is the tier.
//
// Secrets: SHOPIFY_PARTNER_ID (the number in the Partner Dashboard's address; the Dev Dashboard's
// number is the organization id, which the Partner API does not take), SHOPIFY_PARTNER_TOKEN (a
// Partner API client with Manage apps, and View financials for cancelling) and SHOPIFY_APP_ID (the
// app's number in the Partner Dashboard).

import { ShopifyError } from './shopify.ts';
import { isSubscriptionEntitled } from './entitlement.ts';

export const PARTNER_API_VERSION = '2026-10';

/** The Partner Dashboard plan handles, each one a tier id. */
export const SHOPIFY_TIERS = ['starter', 'pro', 'business'] as const;

/** Statuses a biller still owns. Mirrors redeem_creator_code (migration 057). */
const LIVE_STATUSES = new Set(['active', 'trialing', 'past_due']);

/** How long a store's plan, once read, stands in for the Partner API (4 requests a second). */
export const PLAN_CACHE_MS = 5 * 60 * 1000;

/**
 * The shortest gap between two forced reads of one store. The welcome link forces one, and the
 * app's page asks again every 6 seconds while Shopify catches up, so this stays under that.
 */
export const FRESH_READ_MS = 5 * 1000;

export const ACTIVE_SUBSCRIPTION_QUERY = `query ActiveSubscription($appId: ID!, $shopId: ID!) {
  activeSubscription(appId: $appId, shopId: $shopId) {
    cancelAtEndOfCycle
    trialEndsAt
    currentBillingCycle { endTime }
    items { handle }
  }
}`;

export const CANCEL_SUBSCRIPTION_MUTATION = `mutation Cancel($appId: ID!, $shopId: ID!) {
  appSubscriptionCancel(
    appId: $appId
    shopId: $shopId
    deferCancellation: false
    prorate: false
    skipFinalUsageCharge: false
  ) {
    userErrors { message }
  }
}`;

/** What Shopify bills a store, as SaleLinx reads it. */
export interface StorePlan {
  tierId: string;
  status: 'trialing' | 'active';
  /** The trial's end while trialing, else the end of the billing cycle. */
  periodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

/** The subscriptions columns the sync reads. */
export interface SubscriptionRow {
  id: string;
  user_id: string;
  tier_id: string;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  first_paid_at: string | null;
  past_due_since: string | null;
  stripe_subscription_id: string | null;
  shopify_shop_id: string | null;
  created_at: string;
  updated_at: string;
}

export const SUBSCRIPTION_COLUMNS =
  'id, user_id, tier_id, status, current_period_end, cancel_at_period_end, first_paid_at, ' +
  'past_due_since, stripe_subscription_id, shopify_shop_id, created_at, updated_at';

/** Who pays for an account's plan. */
export type PaidThrough = 'stripe' | 'shopify' | 'comp';

export const paidThrough = (row: SubscriptionRow): PaidThrough =>
  row.stripe_subscription_id ? 'stripe' : row.shopify_shop_id ? 'shopify' : 'comp';

const errCode = (err: unknown): string =>
  (err as { code?: string } | null)?.code ?? 'error';

/**
 * activeSubscription's answer as a plan, or null for none. Shopify returns null for a store with no
 * subscription; a subscription with no handle SaleLinx sells also reads as none (`unknown` says so,
 * for the log), as giving it any tier would be a guess.
 */
// deno-lint-ignore no-explicit-any
export function storePlan(sub: any, now = Date.now()): { plan: StorePlan | null; unknown: boolean } {
  if (!sub) return { plan: null, unknown: false };
  const handles: string[] = (Array.isArray(sub.items) ? sub.items : [])
    .map((i: { handle?: unknown }) => i?.handle)
    .filter((h: unknown): h is string => typeof h === 'string');
  const tierId = handles.find((h) => (SHOPIFY_TIERS as readonly string[]).includes(h));
  if (!tierId) return { plan: null, unknown: true };
  // Shopify gives a trial end only while a trial runs, and no billing cycle until it ends.
  const trialEnd = typeof sub.trialEndsAt === 'string' ? sub.trialEndsAt : null;
  const trialing = !!trialEnd && Date.parse(trialEnd) > now;
  const cycleEnd = sub.currentBillingCycle?.endTime;
  return {
    plan: {
      tierId,
      status: trialing ? 'trialing' : 'active',
      periodEnd: trialing ? trialEnd : typeof cycleEnd === 'string' ? cycleEnd : null,
      cancelAtPeriodEnd: sub.cancelAtEndOfCycle === true,
    },
    unknown: false,
  };
}

/**
 * A Stripe subscription Stripe still owns: live, and not a trial past its end (Stripe's leftover).
 * While one is there the store's plan is not written, so nobody is billed twice for one account.
 */
export function liveStripeRow(rows: SubscriptionRow[], now = Date.now()): SubscriptionRow | null {
  return (
    rows.find(
      (r) =>
        !!r.stripe_subscription_id &&
        LIVE_STATUSES.has(r.status) &&
        !(
          r.status === 'trialing' &&
          r.current_period_end &&
          Date.parse(r.current_period_end) < now
        ),
    ) ?? null
  );
}

/**
 * The columns to write for a store's plan, or null when nothing should change: no plan and no row
 * still live. A plan that has gone ends the row rather than deleting it, so the account's history
 * stays. first_paid_at is stamped the first time the row is seen past its trial, and kept.
 */
export function planWrite(
  plan: StorePlan | null,
  existing: SubscriptionRow | null,
  now = new Date(),
): Record<string, unknown> | null {
  const stamp = now.toISOString();
  if (!plan) {
    if (!existing || !LIVE_STATUSES.has(existing.status)) return null;
    return { status: 'canceled', cancel_at_period_end: false, past_due_since: null, updated_at: stamp };
  }
  return {
    tier_id: plan.tierId,
    tier_version: 1,
    status: plan.status,
    current_period_end: plan.periodEnd,
    cancel_at_period_end: plan.cancelAtPeriodEnd,
    first_paid_at: existing?.first_paid_at ?? (plan.status === 'active' ? stamp : null),
    past_due_since: null,
    updated_at: stamp,
  };
}

/**
 * The plan an account has now, as the extension resolves it: the newest entitled row among the
 * current statuses (utils/cloud/subscription.ts), or null for none.
 */
export function currentPlan(rows: SubscriptionRow[], now = Date.now()): SubscriptionRow | null {
  const newest = [...rows].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  return newest.find((r) => LIVE_STATUSES.has(r.status) && isSubscriptionEntitled(r, now)) ?? null;
}

/** Shopify's plan page for the app, where a merchant picks, changes or cancels a plan. */
export function planPageUrl(shopDomain: string, appHandle: string | null | undefined): string | null {
  const store = shopDomain.replace(/\.myshopify\.com$/, '');
  if (!appHandle || !store || store === shopDomain) return null;
  return `https://admin.shopify.com/store/${encodeURIComponent(store)}/charges/${encodeURIComponent(appHandle)}/pricing_plans`;
}

// ── The Partner API ────────────────────────────────────────────────────────

interface PartnerConfig {
  partnerId: string;
  token: string;
  appGid: string;
}

function partnerConfig(): PartnerConfig {
  const partnerId = Deno.env.get('SHOPIFY_PARTNER_ID');
  const token = Deno.env.get('SHOPIFY_PARTNER_TOKEN');
  const appId = Deno.env.get('SHOPIFY_APP_ID');
  if (!partnerId || !token || !appId) {
    throw new ShopifyError('Shopify billing is not set up', 'billing_not_configured', 503);
  }
  return { partnerId, token, appGid: `gid://shopify/App/${appId}` };
}

/** True once the Partner API secrets are set: until then billing stays out of the app's page. */
export const billingConfigured = (): boolean =>
  !!(
    Deno.env.get('SHOPIFY_PARTNER_ID') &&
    Deno.env.get('SHOPIFY_PARTNER_TOKEN') &&
    Deno.env.get('SHOPIFY_APP_ID')
  );

async function partnerGraphql<T>(
  c: PartnerConfig,
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(
    `https://partners.shopify.com/${c.partnerId}/api/${PARTNER_API_VERSION}/graphql.json`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': c.token },
      body: JSON.stringify({ query, variables }),
    },
  );
  if (res.status === 429) throw new ShopifyError('Shopify is busy', 'busy', 429);
  // A refused token, or one without the permission: nothing a retry fixes.
  if (res.status === 401 || res.status === 403) {
    console.error(`[shopify-billing] Partner API refused the token: ${res.status}`);
    throw new ShopifyError('Shopify billing is not set up', 'billing_not_configured', 503);
  }
  const body = await res.json().catch(() => null);
  if (!res.ok || !body) throw new ShopifyError(`Shopify error ${res.status}`, 'shopify');
  if (Array.isArray(body.errors) && body.errors.length > 0) {
    throw new ShopifyError(String(body.errors[0]?.message ?? 'Shopify error'), 'shopify');
  }
  return body.data as T;
}

/** What Shopify bills the store now, straight from the Partner API. */
export async function readStorePlan(shopId: string): Promise<StorePlan | null> {
  const c = partnerConfig();
  const data = await partnerGraphql<{ activeSubscription: unknown }>(c, ACTIVE_SUBSCRIPTION_QUERY, {
    appId: c.appGid,
    shopId: `gid://shopify/Shop/${shopId}`,
  });
  const { plan, unknown } = storePlan(data?.activeSubscription);
  if (unknown) console.error(`[shopify-billing] shop=${shopId} has a plan with no SaleLinx handle`);
  return plan;
}

/**
 * Ends the store's subscription at once, with no refund for the rest of the cycle, as Stripe's
 * cancellation does on account deletion. Needs View financials on the Partner API client. A store
 * with no subscription is not an error.
 */
export async function cancelStorePlan(shopId: string): Promise<void> {
  const c = partnerConfig();
  const data = await partnerGraphql<{
    appSubscriptionCancel?: { userErrors?: { message?: string }[] };
  }>(c, CANCEL_SUBSCRIPTION_MUTATION, {
    appId: c.appGid,
    shopId: `gid://shopify/Shop/${shopId}`,
  });
  const errors = data?.appSubscriptionCancel?.userErrors ?? [];
  if (errors.length > 0) {
    // Nothing to cancel reads as done; anything else is for the caller to retry.
    if ((await readStorePlan(shopId)) === null) return;
    throw new ShopifyError(String(errors[0]?.message ?? 'Cancel failed'), 'shopify');
  }
}

/**
 * Account deletion (delete-account, admin-delete-user): each store this account has a plan row
 * for is read, and cancelled at once while Shopify still bills it, as the account's Stripe
 * customers are deleted. Reading first means a plan that already ended asks Shopify to cancel
 * nothing. Throws when a read or a cancel fails, so the caller stops before deleting an account
 * Shopify could still bill. Answers how many it cancelled.
 */
// deno-lint-ignore no-explicit-any
export async function cancelAccountStorePlans(admin: any, userId: string): Promise<number> {
  // Every column, so this works before migration 057 too (no store ids then).
  const { data, error } = await admin.from('subscriptions').select('*').eq('user_id', userId);
  if (error) throw new ShopifyError('Subscription lookup failed', 'unavailable', 500);
  const shops = [
    ...new Set(
      ((data ?? []) as Partial<SubscriptionRow>[])
        .map((r) => r.shopify_shop_id)
        .filter((id): id is string => !!id),
    ),
  ];
  let cancelled = 0;
  for (const shopId of shops) {
    if ((await readStorePlan(shopId)) === null) continue;
    await cancelStorePlan(shopId);
    cancelled += 1;
  }
  return cancelled;
}

// ── The sync ───────────────────────────────────────────────────────────────

// Stores read lately that hold no row to remember the read on: no plan, or no account yet. Per
// isolate only, so a best effort at sparing the Partner API.
const recentReads = new Map<string, { at: number; plan: StorePlan | null }>();

export interface BillingState {
  /** The account's plan now, whoever pays for it; null for none. */
  plan: {
    tierId: string;
    status: string;
    periodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    paidThrough: PaidThrough;
  } | null;
  /** Shopify bills this store for SaleLinx while Stripe pays for the account's plan. */
  doubleBilled: boolean;
}

/**
 * Reads the store's plan and brings the account's Shopify row in line with it, then answers with
 * the account's plan. Never writes over a live Stripe plan (`doubleBilled` says when Shopify bills
 * the store as well). `fresh` skips the cache, for the welcome link after a plan is picked, though
 * not twice within FRESH_READ_MS.
 */
export async function syncStorePlan(
  // deno-lint-ignore no-explicit-any
  admin: any,
  shopId: string,
  userId: string,
  opts: { fresh?: boolean } = {},
): Promise<BillingState> {
  const now = Date.now();
  const [accountRes, storeRes] = await Promise.all([
    admin.from('subscriptions').select(SUBSCRIPTION_COLUMNS).eq('user_id', userId),
    admin
      .from('subscriptions')
      .select(SUBSCRIPTION_COLUMNS)
      .eq('shopify_shop_id', shopId)
      .maybeSingle(),
  ]);
  if (accountRes.error || storeRes.error) {
    throw new ShopifyError('Subscription lookup failed', 'unavailable', 500);
  }
  let rows: SubscriptionRow[] = accountRes.data ?? [];
  const existing: SubscriptionRow | null = storeRes.data ?? null;

  const lastRead = Math.max(
    existing ? Date.parse(existing.updated_at) : 0,
    recentReads.get(shopId)?.at ?? 0,
  );
  const age = now - lastRead;
  const reread = opts.fresh ? age >= FRESH_READ_MS : age >= PLAN_CACHE_MS;

  let plan: StorePlan | null | undefined;
  if (reread) {
    plan = await readStorePlan(shopId);
    recentReads.set(shopId, { at: now, plan });
  }

  const stripe = liveStripeRow(rows, now);
  if (plan !== undefined && !stripe) {
    const write = planWrite(plan, existing, new Date(now));
    if (write) {
      // Upserted on the store, so a store that moved to another account takes its plan along.
      const { data, error } = await admin
        .from('subscriptions')
        .upsert(
          { ...write, user_id: userId, shopify_shop_id: shopId },
          { onConflict: 'shopify_shop_id' },
        )
        .select(SUBSCRIPTION_COLUMNS)
        .single();
      if (error) {
        console.error(`[shopify-billing] shop=${shopId} write failed:`, error.code ?? error.message);
        throw new ShopifyError('Could not save the plan', 'unavailable', 500);
      }
      rows = [...rows.filter((r) => r.id !== data.id), data];
    } else if (existing) {
      // Checked and unchanged: the stamp is what spares the Partner API next time.
      await admin
        .from('subscriptions')
        .update({ updated_at: new Date(now).toISOString() })
        .eq('id', existing.id);
    }
  }

  const current = currentPlan(rows, now);
  const storeBilled =
    plan !== undefined ? plan !== null : !!existing && LIVE_STATUSES.has(existing.status);
  return {
    plan: current
      ? {
          tierId: current.tier_id,
          status: current.status,
          periodEnd: current.current_period_end,
          cancelAtPeriodEnd: current.cancel_at_period_end,
          paidThrough: paidThrough(current),
        }
      : null,
    doubleBilled: !!stripe && storeBilled,
  };
}

/**
 * app/uninstalled: the store's plan read again, as whether uninstalling cancels an App Pricing
 * subscription is not documented. When it can't be read the row ends, the safe direction: opening
 * the app again reads it afresh.
 */
// deno-lint-ignore no-explicit-any
export async function syncAfterUninstall(admin: any, shopId: string): Promise<void> {
  const { data: existing, error } = await admin
    .from('subscriptions')
    .select(SUBSCRIPTION_COLUMNS)
    .eq('shopify_shop_id', shopId)
    .maybeSingle();
  if (error || !existing) return;
  let plan: StorePlan | null = null;
  try {
    plan = await readStorePlan(shopId);
  } catch (err) {
    console.warn(`[shopify-billing] shop=${shopId} uninstall read failed code=${errCode(err)}`);
  }
  const write = planWrite(plan, existing);
  if (!write) return;
  const { error: writeErr } = await admin.from('subscriptions').update(write).eq('id', existing.id);
  if (writeErr) console.error(`[shopify-billing] shop=${shopId} uninstall write failed`);
}
