// The extension's only route to Etsy. Secrets: ETSY_KEYSTRING, ETSY_SHARED_SECRET.

// @ts-nocheck - this file runs under Deno, not the website's TS config.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders as sharedCorsHeaders } from '../_shared/security.ts';

const CORS_HEADERS = sharedCorsHeaders();
const API = 'https://api.etsy.com/v3';

// Asked for up front so linked sellers never consent twice as features land.
const SCOPES = 'listings_r listings_w listings_d shops_r';

class EtsyError extends Error {
  constructor(message: string, public code: string, public status = 502) {
    super(message);
  }
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function env(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new EtsyError(`${name} not configured`, 'not_configured', 500);
  return v;
}

function redirectUri(extensionId: unknown): string {
  if (typeof extensionId !== 'string' || !/^[a-p]{32}$/.test(extensionId)) {
    throw new EtsyError('Bad extension id', 'bad_request', 400);
  }
  return `https://${extensionId}.chromiumapp.org/etsy`;
}

const inSeconds = (s: number) => new Date(Date.now() + s * 1000).toISOString();

async function tokenRequest(params: Record<string, string>) {
  const res = await fetch(`${API}/public/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: env('ETSY_KEYSTRING'), ...params }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const code = body.error === 'invalid_grant' ? 'reauth' : 'etsy';
    throw new EtsyError(body.error_description ?? `Etsy token error ${res.status}`, code);
  }
  return body as { access_token: string; expires_in: number; refresh_token: string };
}

async function api(token: string, path: string, init: RequestInit = {}) {
  const res = await fetch(`${API}/application${path}`, {
    ...init,
    headers: {
      ...init.headers,
      'x-api-key': `${env('ETSY_KEYSTRING')}:${env('ETSY_SHARED_SECRET')}`,
      Authorization: `Bearer ${token}`,
    },
  });
  const body = await res.json().catch(() => ({}));
  if (res.status === 429) throw new EtsyError('Etsy is busy right now. Please try again later.', 'quota', 429);
  if (res.status === 401) throw new EtsyError('Etsy needs connecting again', 'reauth', 409);
  if (!res.ok) throw new EtsyError(body.error ?? `Etsy request failed (${res.status})`, 'etsy');
  return body;
}

async function accessTokenFor(admin, userId: string): Promise<{ token: string; shopId: string }> {
  const { data: row, error } = await admin
    .from('etsy_tokens')
    .select('access_token, access_expires_at, refresh_token, shop_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new EtsyError('Token lookup failed', 'unavailable', 500);
  if (!row) throw new EtsyError('Etsy is not connected', 'not_linked', 409);

  if (new Date(row.access_expires_at).getTime() - Date.now() > 60_000) {
    return { token: row.access_token, shopId: row.shop_id };
  }
  const fresh = await tokenRequest({ grant_type: 'refresh_token', refresh_token: row.refresh_token });
  await admin
    .from('etsy_tokens')
    .update({
      access_token: fresh.access_token,
      access_expires_at: inSeconds(fresh.expires_in),
      refresh_token: fresh.refresh_token,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);
  return { token: fresh.access_token, shopId: row.shop_id };
}

const STATES = ['active', 'draft', 'inactive', 'expired', 'sold_out'];
const MAX_LISTINGS = 2000;

function summary(l) {
  const images = [...(l.images ?? [])].sort((a, b) => a.rank - b.rank);
  return {
    listingId: String(l.listing_id),
    state: l.state,
    title: l.title ?? '',
    description: l.description ?? '',
    price: l.price ? l.price.amount / l.price.divisor : 0,
    currency: l.price?.currency_code ?? null,
    quantity: l.quantity ?? 0,
    url: l.url ?? null,
    favorers: l.num_favorers ?? 0,
    views: l.views ?? null,
    photos: images.map((i) => i.url_fullxfull ?? i.url_570xN).filter(Boolean),
    tags: l.tags ?? [],
    hasVariations: !!l.has_variations,
    createdAt: l.created_timestamp ? l.created_timestamp * 1000 : null,
    updatedAt: l.updated_timestamp ? l.updated_timestamp * 1000 : null,
  };
}

async function listings(admin, userId: string) {
  const { token, shopId } = await accessTokenFor(admin, userId);
  const out = [];
  let complete = true;
  for (const state of STATES) {
    for (let offset = 0; ; offset += 100) {
      if (out.length >= MAX_LISTINGS) {
        complete = false;
        break;
      }
      const qs = new URLSearchParams({ state, limit: '100', offset: String(offset), includes: 'Images' });
      const page = await api(token, `/shops/${shopId}/listings?${qs}`);
      out.push(...(page.results ?? []).map(summary));
      if (offset + 100 >= (page.count ?? 0)) break;
    }
  }
  return { listings: out, complete };
}

const getListing = (token: string, id: string) => api(token, `/listings/${id}?includes=Images`);

// Etsy's category tree changes rarely; one read per isolate.
let taxonomy: Promise<Map<number, { name: string; path: number[] }>> | null = null;
function taxonomyNodes(token: string) {
  taxonomy ??= api(token, '/seller-taxonomy/nodes')
    .then(({ results }) => {
      const nodes = new Map();
      const walk = (list) =>
        list?.forEach((n) => {
          nodes.set(n.id, { name: n.name, path: n.full_path_taxonomy_ids ?? [n.id] });
          walk(n.children);
        });
      walk(results);
      return nodes;
    })
    .catch((err) => {
      taxonomy = null;
      throw err;
    });
  return taxonomy;
}

async function item(admin, userId: string, body) {
  const id = String(body.listingId ?? '');
  if (!/^\d+$/.test(id)) throw new EtsyError('Bad listing id', 'bad_request', 400);
  const { token, shopId } = await accessTokenFor(admin, userId);
  const l = await getListing(token, id);
  if (String(l.shop_id) !== shopId) throw new EtsyError('Not a listing in your shop', 'not_found', 404);
  const [props, nodes] = await Promise.all([
    api(token, `/shops/${shopId}/listings/${id}/properties`),
    taxonomyNodes(token),
  ]);
  const path = nodes.get(l.taxonomy_id)?.path ?? [];
  return {
    ...summary(l),
    category: path.map((t) => nodes.get(t)?.name).filter(Boolean).join(' > '),
    properties: Object.fromEntries(
      (props.results ?? []).map((p) => [p.property_name, p.values ?? []]),
    ),
    whoMade: l.who_made ?? null,
  };
}

async function update(admin, userId: string, body) {
  const id = String(body.listingId ?? '');
  if (!/^\d+$/.test(id)) throw new EtsyError('Bad listing id', 'bad_request', 400);
  const { title, description, tags, state, price, quantity } = body.changes ?? {};
  const { token, shopId } = await accessTokenFor(admin, userId);

  // Reactivating an expired or draft listing renews it, which Etsy charges for.
  if (state === 'active' && (await getListing(token, id)).state !== 'inactive') {
    throw new EtsyError('Only a deactivated listing can be made active here. Renew it on Etsy.', 'renew', 409);
  }

  let inventory = null;
  if (price !== undefined || quantity !== undefined) {
    inventory = await api(token, `/listings/${id}/inventory`);
    if (inventory.products.length !== 1) {
      throw new EtsyError('This listing has variations. Change its price and quantity on Etsy.', 'variations', 409);
    }
  }

  const form = new URLSearchParams();
  if (title !== undefined) form.set('title', String(title));
  if (description !== undefined) form.set('description', String(description));
  if (Array.isArray(tags)) form.set('tags', tags.join(','));
  if (state === 'active' || state === 'inactive') form.set('state', state);
  if ([...form.keys()].length) {
    await api(token, `/shops/${shopId}/listings/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
    });
  }

  if (inventory) {
    const products = inventory.products.map(({ product_id, is_deleted, ...p }) => ({
      ...p,
      property_values: p.property_values.map(({ scale_name, ...v }) => v),
      offerings: p.offerings.map(({ offering_id, is_deleted, ...o }) => ({
        ...o,
        price: price ?? o.price.amount / o.price.divisor,
        quantity: quantity ?? o.quantity,
      })),
    }));
    await api(token, `/listings/${id}/inventory`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        products,
        price_on_property: inventory.price_on_property ?? [],
        quantity_on_property: inventory.quantity_on_property ?? [],
        sku_on_property: inventory.sku_on_property ?? [],
        readiness_state_on_property: inventory.readiness_state_on_property ?? [],
      }),
    });
  }

  return { listing: summary(await getListing(token, id)) };
}

async function link(admin, userScoped, userId: string, body) {
  if (typeof body.code !== 'string' || !body.code) throw new EtsyError('Missing code', 'bad_request', 400);
  if (typeof body.codeVerifier !== 'string' || !/^[A-Za-z0-9._~-]{43,128}$/.test(body.codeVerifier)) {
    throw new EtsyError('Missing code verifier', 'bad_request', 400);
  }
  const tokens = await tokenRequest({
    grant_type: 'authorization_code',
    code: body.code,
    code_verifier: body.codeVerifier,
    redirect_uri: redirectUri(body.extensionId),
  });
  const me = await api(tokens.access_token, '/users/me');
  if (!me.shop_id) throw new EtsyError('This Etsy account has no shop yet', 'no_shop', 409);
  const shop = await api(tokens.access_token, `/shops/${me.shop_id}`);
  const shopId = String(me.shop_id);

  // User's client first, so the link index and trial triggers decide before tokens are kept.
  const { error: linkErr } = await userScoped.from('linked_accounts').upsert(
    {
      user_id: userId,
      platform: 'etsy',
      platform_user_id: shopId,
      platform_username: shop.shop_name ?? null,
      linked_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,platform' },
  );
  if (linkErr) {
    const msg = `${linkErr.code ?? ''} ${linkErr.message ?? ''}`;
    const code = msg.includes('platform_account_already_trialed')
      ? 'ALREADY_TRIALED'
      : msg.includes('23505') || msg.includes('linked_accounts_platform_identity_key')
        ? 'ALREADY_LINKED_ELSEWHERE'
        : 'UNKNOWN';
    throw new EtsyError(linkErr.message ?? 'Link failed', code, 409);
  }

  const { error: tokErr } = await admin.from('etsy_tokens').upsert(
    {
      user_id: userId,
      etsy_user_id: String(me.user_id),
      shop_id: shopId,
      access_token: tokens.access_token,
      access_expires_at: inSeconds(tokens.expires_in),
      refresh_token: tokens.refresh_token,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );
  if (tokErr) {
    console.error('[etsy] token store failed:', tokErr.message);
    throw new EtsyError('Could not save the Etsy connection', 'unavailable', 500);
  }
  return { shopId, shopName: shop.shop_name ?? null };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return json(401, { error: 'Missing auth' });
  const jwt = authHeader.slice('Bearer '.length).trim();

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceKey) return json(500, { error: 'Supabase env missing' });

  const admin = createClient(supabaseUrl, serviceKey);
  const {
    data: { user },
    error: userErr,
  } = await admin.auth.getUser(jwt);
  if (userErr || !user) return json(401, { error: userErr?.message ?? 'Invalid session' });

  let body;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'Invalid JSON' });
  }

  try {
    switch (body?.action) {
      case 'consentUrl': {
        if (typeof body.state !== 'string' || !body.state) return json(400, { error: 'Missing state' });
        if (typeof body.codeChallenge !== 'string' || !body.codeChallenge) {
          return json(400, { error: 'Missing code challenge' });
        }
        const url = new URL('https://www.etsy.com/oauth/connect');
        url.search = new URLSearchParams({
          response_type: 'code',
          client_id: env('ETSY_KEYSTRING'),
          redirect_uri: redirectUri(body.extensionId),
          scope: SCOPES,
          state: body.state,
          code_challenge: body.codeChallenge,
          code_challenge_method: 'S256',
        }).toString();
        return json(200, { url: url.toString() });
      }

      case 'link': {
        const userScoped = createClient(supabaseUrl, anonKey, {
          global: { headers: { Authorization: `Bearer ${jwt}` } },
        });
        return json(200, await link(admin, userScoped, user.id, body));
      }

      case 'listings':
        return json(200, await listings(admin, user.id));

      case 'item':
        return json(200, await item(admin, user.id, body));

      case 'update':
        return json(200, await update(admin, user.id, body));

      case 'unlink': {
        await admin.from('etsy_tokens').delete().eq('user_id', user.id);
        return json(200, { ok: true });
      }

      default:
        return json(400, { error: `Unknown action: ${String(body?.action)}` });
    }
  } catch (err) {
    if (err instanceof EtsyError) {
      console.warn(`[etsy] user=${user.id} action=${body?.action} code=${err.code}`);
      return json(err.status, { error: err.message, code: err.code });
    }
    console.error(`[etsy] user=${user.id} action=${body?.action}`, err instanceof Error ? err.message : err);
    return json(502, { error: 'Etsy request failed', code: 'unavailable' });
  }
});
