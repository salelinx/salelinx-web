// Supabase Edge Function: resolve-category
// ------------------------------------------------------------------------
// Resolves Depop <-> Vinted categories for the SaleLinx extension's
// crosslister.
//
// Why this exists: the category mapping tables (~116KB) used to ship inside
// the extension bundle, where anyone who installed it could unzip the .crx and
// lift them wholesale. They now live only here, in _generated/, and the
// extension asks for a resolved answer instead of carrying the tables.
//
// _generated/ is synced from the extension repo, which owns the source and the
// tests that guard it:
//   (extension repo) node scripts/sync-category-maps.mjs
//   supabase functions deploy resolve-category --no-verify-jwt
// Never edit _generated/ here; the next sync overwrites it.
//
// Auth: requires a valid Supabase access_token (the extension passes the
// signed-in user's JWT in the Authorization header).
//
// Entitlement: the caller's tier must allow crosslisting, and they must not
// have exhausted their monthly crosslist allowance. This is the real paywall
// for crosslisting. The extension gates client-side too, but that check reads
// a cache the user can edit; this one cannot be reached around, because a
// crosslist cannot produce a category without it.
//
// Privacy: listing titles and descriptions are matched against keyword
// patterns in memory and never logged. Logs carry user UUIDs and counts only,
// per docs/GDPR.md.
//
// Request body:
//   { items: Array<{ id, direction, ... }> }   see _generated/crosslist-category.ts
// Response:
//   { results: Array<{ id, ...resolved }> }

// @ts-nocheck — this file runs under Deno, not the website's TS config.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders as sharedCorsHeaders } from '../_shared/security.ts';
import {
  mapDepopToVintedCategory,
  depopProductTypeFromText,
} from './_generated/category-resolve.ts';
import { DEPOP_ID_TO_DRAFT_CATEGORY } from './_generated/category-maps-depop.ts';
import { vintedCategoryIdToDepop } from './_generated/category-maps-vinted.ts';

const CORS_HEADERS = sharedCorsHeaders();

// One crosslist asks for at most a handful of directions, and the extension
// batches a bulk run. 100 keeps a bulk batch in one round trip while bounding
// how much of the table a single request can drain.
const MAX_ITEMS = 100;

// Titles and descriptions are matched, not stored. Anything longer than this
// is keyword noise for our purposes and only inflates the request.
const MAX_TEXT = 2000;

// Statuses that still grant the subscription's tier. Mirrors
// ENTITLED_STATUSES in the extension's utils/cloud/subscription.ts and
// CURRENT_STATUSES in lib/supabase/subscription.ts: 'past_due' keeps its tier
// as a payment-retry grace period, so a card that fails mid-month does not
// break crosslisting.
const ENTITLED_STATUSES = ['active', 'trialing', 'past_due'];

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

/** UTC month key, matching what increment_usage_counter writes. */
function monthKey(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

function clampText(value: unknown): string {
  return typeof value === 'string' ? value.slice(0, MAX_TEXT) : '';
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  // ── Auth ─────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return json(401, { error: 'Missing auth' });
  const jwt = authHeader.slice('Bearer '.length).trim();
  if (!jwt) return json(401, { error: 'Empty token' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !supabaseAnonKey) return json(500, { error: 'Supabase env missing' });

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser(jwt);
  if (userErr || !user) {
    return json(401, { error: userErr?.message ?? 'Invalid session' });
  }

  // ── Body ─────────────────────────────────────────────────────────────────
  let body: { items?: unknown };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'Invalid JSON' });
  }

  const items = body?.items;
  if (!Array.isArray(items)) return json(400, { error: 'items must be an array' });
  if (items.length === 0) return json(200, { results: [] });
  if (items.length > MAX_ITEMS) {
    return json(400, { error: `Too many items (max ${MAX_ITEMS})` });
  }

  // ── Entitlement: crosslisting must be on the tier and not exhausted ───────
  // Read through a user-scoped client so the "own read" RLS policies apply and
  // this can only ever see the caller's own rows.
  const userScoped = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });

  const { data: sub, error: subErr } = await userScoped
    .from('subscriptions')
    .select('tier_id, tier_version')
    .in('status', ENTITLED_STATUSES)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (subErr) {
    console.error('[resolve-category] subscription lookup failed:', subErr.message);
    return json(500, { error: 'Entitlement check failed' });
  }

  // No entitled subscription at all resolves to the free tier, whose
  // crosslists_per_month is 0.
  let monthlyCap: number | null = 0;
  if (sub) {
    const { data: tier, error: tierErr } = await userScoped
      .from('tier_limits')
      .select('limits')
      .eq('tier_id', sub.tier_id)
      .eq('version', sub.tier_version)
      .maybeSingle();
    if (tierErr) {
      console.error('[resolve-category] tier lookup failed:', tierErr.message);
      return json(500, { error: 'Entitlement check failed' });
    }
    // null = unlimited; a missing key is treated as unlimited to match the
    // extension's gate, which reads an absent key as "not applicable".
    const limits = tier?.limits ?? {};
    monthlyCap = 'crosslists_per_month' in limits ? limits.crosslists_per_month : null;
  }

  if (monthlyCap === 0) {
    return json(403, {
      error: 'Your plan does not include crosslisting',
      code: 'upgrade_required',
    });
  }

  if (typeof monthlyCap === 'number') {
    const { data: usage, error: usageErr } = await userScoped
      .from('usage_counters')
      .select('count')
      .eq('user_id', user.id)
      .eq('feature', 'crosslist')
      .eq('period_key', monthKey())
      .maybeSingle();
    if (usageErr) {
      console.error('[resolve-category] usage lookup failed:', usageErr.message);
      return json(500, { error: 'Entitlement check failed' });
    }
    if ((usage?.count ?? 0) >= monthlyCap) {
      return json(403, {
        error: 'Monthly crosslist limit reached',
        code: 'limit_reached',
      });
    }
  }

  // ── Resolve ──────────────────────────────────────────────────────────────
  const results = items.map((raw: Record<string, unknown>) => {
    const id = typeof raw?.id === 'string' ? raw.id : '';
    if (!id) return { id: '', error: 'Missing id' };

    try {
      switch (raw.direction) {
        case 'depopToVinted': {
          const req = (raw.depopToVinted ?? {}) as Record<string, unknown>;
          const categoryId = typeof req.categoryId === 'number' ? req.categoryId : undefined;
          return {
            id,
            depopToVinted: mapDepopToVintedCategory(
              categoryId,
              clampText(req.title),
              clampText(req.description),
              req.isKids === true,
            ),
          };
        }

        case 'vintedToDepop': {
          if (typeof raw.catalogId !== 'number') return { id, error: 'Missing catalogId' };
          return { id, vintedToDepop: vintedCategoryIdToDepop(raw.catalogId) };
        }

        case 'depopDraft': {
          if (typeof raw.depopCategoryId !== 'number') {
            return { id, error: 'Missing depopCategoryId' };
          }
          return { id, depopDraft: DEPOP_ID_TO_DRAFT_CATEGORY[raw.depopCategoryId] ?? null };
        }

        case 'depopProductType': {
          const text = (raw.text ?? {}) as Record<string, unknown>;
          return {
            id,
            depopProductType: depopProductTypeFromText(
              clampText(text.title),
              clampText(text.description),
            ),
          };
        }

        default:
          return { id, error: `Unknown direction: ${String(raw.direction)}` };
      }
    } catch (err) {
      // One malformed item must not fail the whole batch.
      console.error('[resolve-category] item failed:', err instanceof Error ? err.message : err);
      return { id, error: 'Resolution failed' };
    }
  });

  console.log(`[resolve-category] user=${user.id} resolved=${results.length}`);
  return json(200, { results });
});
