// Supabase Edge Function: shopify
// ------------------------------------------------------------------------
// The extension's only route to Shopify. Holds the app secret and each user's
// Admin API tokens (public.shopify_tokens, service role only) and calls the
// Admin GraphQL API on the user's behalf, returning plain JSON.
//
// Auth: the signed-in user's Supabase JWT in Authorization.
//
// Request body: { action, ...params }
//   authorizeUrl { query, state, extensionId } -> { url }
//                query: the App URL's params Shopify sent the popup on install
//                (shop, host, timestamp, hmac), checked here; url: Shopify's
//                consent page, redirecting to https://<extensionId>.chromiumapp.org/shopify
//   link    { query }   -> { shopId, shopName, shopDomain, currency }
//                query: that redirect's params (code, shop, state, timestamp,
//                hmac). The extension checks state; this checks the signature.
//   unlink  {}          -> { ok }
//   account {}          -> { shopName, shopDomain, currency }
//
// Errors: { error, code } with code 'not_linked' or 'reauth' when the user
// must connect Shopify again, 'busy' when Shopify throttles or a token refresh
// is already running, 'shop_unavailable' for a lapsed or locked store,
// 'bad_signature' / 'expired' / 'bad_request' for a redirect that doesn't
// check out, 'shopify' for anything else Shopify refused.
//
// Secrets: SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET.

// @ts-nocheck - this file runs under Deno, not the website's TS config.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders as sharedCorsHeaders } from "../_shared/security.ts";
import {
  ShopifyError,
  adminGraphql,
  authorizeUrl,
  shopIdFromGid,
  tokenRequest,
  verifiedShop,
} from "../_shared/shopify.ts";

const CORS_HEADERS = sharedCorsHeaders();

// A refresh normally takes well under a second; a claim older than this is
// from a call that died mid-refresh, and the next caller may take over.
const REFRESH_LOCK_MS = 30_000;

const SHOP_QUERY = "{ shop { id name myshopifyDomain currencyCode } }";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function env(name: string): string {
  const v = Deno.env.get(name);
  if (!v)
    throw new ShopifyError(`${name} not configured`, "not_configured", 500);
  return v;
}

const inSeconds = (s: number) => new Date(Date.now() + s * 1000).toISOString();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Tokens ─────────────────────────────────────────────────────────────────

function tokenColumns(t) {
  return {
    scope: t.scope,
    access_token: t.access_token,
    access_expires_at: inSeconds(t.expires_in ?? 3600),
    refresh_token: t.refresh_token,
    refresh_expires_at: inSeconds(t.refresh_token_expires_in ?? 90 * 86400),
    updated_at: new Date().toISOString(),
  };
}

async function refresh(
  admin,
  userId: string,
  shop: string,
  refreshToken: string,
) {
  try {
    const fresh = await tokenRequest(shop, {
      client_id: env("SHOPIFY_CLIENT_ID"),
      client_secret: env("SHOPIFY_CLIENT_SECRET"),
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    });
    const { error } = await admin
      .from("shopify_tokens")
      .update({
        ...tokenColumns({
          ...fresh,
          refresh_token: fresh.refresh_token ?? refreshToken,
        }),
        refreshing_until: null,
      })
      .eq("user_id", userId);
    // Shopify has already retired the old refresh token, so this link is lost.
    if (error)
      console.error(`[shopify] user=${userId} refreshed token not saved`);
    return { shop, token: fresh.access_token };
  } catch (err) {
    await admin
      .from("shopify_tokens")
      .update({ refreshing_until: null })
      .eq("user_id", userId);
    throw err;
  }
}

/**
 * A working access token, refreshed when it has under a minute left. Shopify
 * retires a refresh token the moment it issues the next one, so only the call
 * that claims refreshing_until refreshes; any other waits for its result.
 */
async function accessTokenFor(
  admin,
  userId: string,
): Promise<{ shop: string; token: string }> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const { data: row, error } = await admin
      .from("shopify_tokens")
      .select("shop_domain, access_token, access_expires_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (error)
      throw new ShopifyError("Token lookup failed", "unavailable", 500);
    if (!row)
      throw new ShopifyError("Shopify is not connected", "not_linked", 409);
    if (new Date(row.access_expires_at).getTime() - Date.now() > 60_000) {
      return { shop: row.shop_domain, token: row.access_token };
    }

    const now = new Date().toISOString();
    const { data: claimed, error: claimErr } = await admin
      .from("shopify_tokens")
      .update({
        refreshing_until: new Date(Date.now() + REFRESH_LOCK_MS).toISOString(),
      })
      .eq("user_id", userId)
      .or(`refreshing_until.is.null,refreshing_until.lt."${now}"`)
      .select("refresh_token");
    if (claimErr)
      throw new ShopifyError("Token lookup failed", "unavailable", 500);
    if (claimed?.length)
      return refresh(admin, userId, row.shop_domain, claimed[0].refresh_token);
    await sleep(500);
  }
  throw new ShopifyError("Shopify is busy, try again", "busy", 503);
}

// ── Linking ────────────────────────────────────────────────────────────────

async function link(admin, userScoped, userId: string, query) {
  const shop = await verifiedShop(query, env("SHOPIFY_CLIENT_SECRET"));
  if (typeof query.code !== "string" || !query.code) {
    throw new ShopifyError("Missing code", "bad_request", 400);
  }
  const tokens = await tokenRequest(shop, {
    client_id: env("SHOPIFY_CLIENT_ID"),
    client_secret: env("SHOPIFY_CLIENT_SECRET"),
    code: query.code,
    expiring: "1",
  });
  if (!tokens.refresh_token)
    throw new ShopifyError("Shopify sent no refresh token", "shopify");
  const { shop: me } = await adminGraphql(
    shop,
    tokens.access_token,
    SHOP_QUERY,
  );
  const shopId = shopIdFromGid(me.id);

  // linked_accounts first, through the user's own client, so the one-store-per-
  // account index and the trial triggers decide before any token is kept.
  const { error: linkErr } = await userScoped.from("linked_accounts").upsert(
    {
      user_id: userId,
      platform: "shopify",
      platform_user_id: shopId,
      platform_username: me.name ?? null,
      linked_at: new Date().toISOString(),
    },
    { onConflict: "user_id,platform" },
  );
  if (linkErr) {
    const msg = `${linkErr.code ?? ""} ${linkErr.message ?? ""}`;
    const code = msg.includes("platform_account_already_trialed")
      ? "ALREADY_TRIALED"
      : msg.includes("23505") ||
          msg.includes("linked_accounts_platform_identity_key")
        ? "ALREADY_LINKED_ELSEWHERE"
        : "UNKNOWN";
    throw new ShopifyError(linkErr.message ?? "Link failed", code, 409);
  }

  const { error: tokErr } = await admin.from("shopify_tokens").upsert(
    {
      user_id: userId,
      shop_id: shopId,
      shop_domain: me.myshopifyDomain ?? shop,
      ...tokenColumns(tokens),
      refreshing_until: null,
    },
    { onConflict: "user_id" },
  );
  if (tokErr) {
    console.error(
      `[shopify] user=${userId} token store failed:`,
      tokErr.code ?? tokErr.message,
    );
    throw new ShopifyError(
      "Could not save the Shopify connection",
      "unavailable",
      500,
    );
  }
  return {
    shopId,
    shopName: me.name ?? null,
    shopDomain: me.myshopifyDomain ?? shop,
    currency: me.currencyCode ?? null,
  };
}

// ── Handler ────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer "))
    return json(401, { error: "Missing auth" });
  const jwt = authHeader.slice("Bearer ".length).trim();

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey)
    return json(500, { error: "Supabase env missing" });

  const admin = createClient(supabaseUrl, serviceKey);
  const {
    data: { user },
    error: userErr,
  } = await admin.auth.getUser(jwt);
  if (userErr || !user)
    return json(401, { error: userErr?.message ?? "Invalid session" });

  let body;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  try {
    switch (body?.action) {
      case "authorizeUrl": {
        if (
          typeof body.state !== "string" ||
          !/^[A-Za-z0-9_-]{16,128}$/.test(body.state)
        ) {
          return json(400, { error: "Missing state", code: "bad_request" });
        }
        if (
          typeof body.extensionId !== "string" ||
          !/^[a-p]{32}$/.test(body.extensionId)
        ) {
          return json(400, {
            error: "Missing extensionId",
            code: "bad_request",
          });
        }
        const shop = await verifiedShop(
          body.query,
          env("SHOPIFY_CLIENT_SECRET"),
        );
        const redirectUri = `https://${body.extensionId}.chromiumapp.org/shopify`;
        return json(200, {
          url: authorizeUrl(
            shop,
            env("SHOPIFY_CLIENT_ID"),
            redirectUri,
            body.state,
          ),
        });
      }

      case "link": {
        const userScoped = createClient(supabaseUrl, anonKey, {
          global: { headers: { Authorization: `Bearer ${jwt}` } },
        });
        return json(
          200,
          await link(admin, userScoped, user.id, body.query ?? {}),
        );
      }

      // The app stays installed in the store until the seller removes it there;
      // without the tokens SaleLinx can no longer reach it.
      case "unlink": {
        await admin.from("shopify_tokens").delete().eq("user_id", user.id);
        return json(200, { ok: true });
      }

      case "account": {
        const auth = await accessTokenFor(admin, user.id);
        const { shop: me } = await adminGraphql(
          auth.shop,
          auth.token,
          SHOP_QUERY,
        );
        return json(200, {
          shopName: me.name ?? null,
          shopDomain: me.myshopifyDomain ?? auth.shop,
          currency: me.currencyCode ?? null,
        });
      }

      default:
        return json(400, { error: `Unknown action: ${String(body?.action)}` });
    }
  } catch (err) {
    if (err instanceof ShopifyError) {
      console.warn(
        `[shopify] user=${user.id} action=${body?.action} code=${err.code}`,
      );
      return json(err.status, { error: err.message, code: err.code });
    }
    console.error(
      `[shopify] user=${user.id} action=${body?.action}`,
      err instanceof Error ? err.message : err,
    );
    return json(502, { error: "Shopify request failed", code: "unavailable" });
  }
});
