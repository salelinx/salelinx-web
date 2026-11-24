// deno-lint-ignore-file no-explicit-any
// TikTok API for Business, for the TikTok posting login (marketing_accounts
// platform 'tiktok_business', migration 060). marketing-oauth connects it and
// proves the public bucket; _shared/marketing-login.ts renews it;
// marketing-publish posts with it.
//
// Every answer is HTTP 200 with { code, message, request_id, data }, where
// code 0 is success, so the status alone says little. User calls send the
// login's token in an Access-Token header and name the account by its
// open_id (business_id). The URL property calls take the app's own ID and
// secret instead of a login.
//
// Secrets: TIKTOK_BUSINESS_APP_ID and TIKTOK_BUSINESS_SECRET, the "SaleLinx
// Marketing" app at business-api.tiktok.com (My Apps > App Detail).

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

const BASE = "https://business-api.tiktok.com/open_api/v1.3";

// Only what posting needs: the profile and username (to check the login is
// ours) and publishing. The app was approved for more, comments among them,
// and TikTok takes any subset. Comments are other people's personal data, so
// a feature that reads them needs its docs/GDPR.md entry first.
//
// If TikTok's login page says "correct the following: scope" (invalid_scope),
// TikTok has not switched the app's TikTok accounts permissions on yet (the
// warning triangle on them in the portal): its support has to sync them, as
// in Nov 2026. user.info.basic alone works without them, which tells the two
// apart.
export const TIKTOK_BUSINESS_SCOPES = [
  "user.info.basic",
  "user.info.username",
  "video.publish",
].join(",");

/** A refusal from TikTok, or a failure worth trying again (transient). */
export class TikTokBusinessError extends Error {
  constructor(
    message: string,
    public code: number | null,
    public transient: boolean,
  ) {
    super(message);
  }
}

// 40100 is TikTok's rate limit; 5xxxx are its own server errors.
const transientCode = (code: number) => code === 40100 || code >= 50000;

export function appCredentials(): { app_id: string; secret: string } {
  return {
    app_id: Deno.env.get("TIKTOK_BUSINESS_APP_ID") ?? "",
    secret: Deno.env.get("TIKTOK_BUSINESS_SECRET") ?? "",
  };
}

/** One call; resolves to its data, throws TikTokBusinessError otherwise. */
export async function ttBusiness(
  method: "GET" | "POST",
  path: string,
  opts: { token?: string; query?: Record<string, string>; body?: unknown } = {},
): Promise<any> {
  const url = `${BASE}${path}${opts.query ? `?${new URLSearchParams(opts.query)}` : ""}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: {
        ...(opts.token ? { "Access-Token": opts.token } : {}),
        ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch (err) {
    throw new TikTokBusinessError(`network: ${(err as Error).message}`, null, true);
  }
  const body = await res.json().catch(() => null);
  if (res.status === 429 || res.status >= 500)
    throw new TikTokBusinessError(`${res.status} ${body?.message ?? res.statusText}`, res.status, true);
  if (!body || typeof body.code !== "number")
    throw new TikTokBusinessError(`${res.status} unreadable answer from TikTok`, res.status, false);
  if (body.code !== 0)
    throw new TikTokBusinessError(
      `TikTok ${body.code}: ${body.message ?? "refused"}`,
      body.code,
      transientCode(body.code),
    );
  return body.data ?? {};
}

export type BusinessToken = {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  refresh_token_expires_in: number;
  open_id: string;
  scope?: string;
};

/** The code from TikTok's login page, swapped for a login. */
export function exchangeCode(code: string, redirectUri: string): Promise<BusinessToken> {
  const { app_id, secret } = appCredentials();
  return ttBusiness("POST", "/tt_user/oauth2/token/", {
    body: {
      client_id: app_id,
      client_secret: secret,
      grant_type: "authorization_code",
      auth_code: code,
      redirect_uri: redirectUri,
    },
  });
}

/** A fresh day-long token from the year-long refresh token. */
export function refreshLogin(refreshToken: string): Promise<BusinessToken> {
  const { app_id, secret } = appCredentials();
  return ttBusiness("POST", "/tt_user/oauth2/refresh_token/", {
    body: {
      client_id: app_id,
      client_secret: secret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    },
  });
}

// ---------------------------------------------------------------------------
// The public bucket TikTok fetches videos from (060). TikTok only takes a
// video_url under an address the app has proved it owns: here a URL prefix,
// proved by a file TikTok names, at the prefix's root, holding its signature.
// ---------------------------------------------------------------------------

export const PUBLIC_BUCKET = "social-public";

export const publicPrefix = () =>
  `${Deno.env.get("SUPABASE_URL")}/storage/v1/object/public/${PUBLIC_BUCKET}/`;

type UrlProperty = {
  property_type?: number;
  url?: string;
  property_status?: number;
  signature?: string;
  file_name?: string;
};

const VERIFIED = 1;

/**
 * What goes in the proof file: "tiktok-developers-site-verification=<code>",
 * which TikTok accepted for our bucket (Nov 2026; a bare code was refused).
 * The API names the value only "signature", so the bare code stays as a
 * fallback in case TikTok ever sends it whole or changes its mind.
 */
export function proofContents(signature: string): string[] {
  const s = signature.trim();
  return s.includes("=") ? [s] : [`tiktok-developers-site-verification=${s}`, s];
}

/**
 * Proves the public bucket to TikTok, once: adds the URL prefix, writes the
 * proof file TikTok asks for, and asks TikTok to check it. Safe to run again;
 * an already proved prefix returns straight away.
 */
export async function provePublicBucket(admin: SupabaseClient): Promise<{ proved: boolean; note: string }> {
  const creds = appCredentials();
  const meta = { property_type: 2, url: publicPrefix() };

  const listed = await ttBusiness("GET", "/business/property/list/", { query: creds });
  let info: UrlProperty | undefined = (listed.url_property_info_list ?? []).find(
    (p: UrlProperty) => p.url === meta.url,
  );
  if (info?.property_status === VERIFIED) return { proved: true, note: "already proved" };
  if (!info) {
    const added = await ttBusiness("POST", "/business/property/add/", {
      body: { ...creds, url_property_meta: meta },
    });
    info = added.url_property_info;
  }
  const file = info?.file_name ?? "";
  if (!/^[A-Za-z0-9._-]+$/.test(file) || !info?.signature)
    throw new Error("TikTok gave no proof file to place");

  for (const contents of proofContents(info.signature)) {
    const { error } = await admin.storage
      .from(PUBLIC_BUCKET)
      .upload(file, new Blob([contents], { type: "text/plain" }), {
        upsert: true,
        contentType: "text/plain",
        // TikTok must read the version just written, not a cached one.
        cacheControl: "0",
      });
    if (error) throw new Error(`couldn't write the proof file: ${error.message}`);
    const checked = await ttBusiness("POST", "/business/property/verify/", {
      body: { ...creds, url_property_meta: meta },
    });
    if (checked.url_property_info?.property_status === VERIFIED)
      return { proved: true, note: "proved" };
  }
  return { proved: false, note: `TikTok didn't accept ${publicPrefix()}${file}` };
}
