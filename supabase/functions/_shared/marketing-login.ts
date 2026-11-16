// The logins marketing-oauth stores in marketing_accounts, renewed before they
// run out. Shared by marketing-sync (reads stats) and marketing-publish
// (posts), so both renew the same way and save what they renewed.
//
//   Instagram  the Facebook Page's token (Instagram is reached through the
//              Page it is linked to, see marketing-oauth), so like Facebook it
//              does not expire and is never renewed
//   TikTok     day-long access token, renewed from the year-long refresh token
//   YouTube    hour-long Google access token, renewed from the refresh token.
//              YouTube's public stats still use YOUTUBE_API_KEY; this login is
//              for uploads and YouTube Analytics.
//   Facebook   a Page access token, which does not expire (it comes from a
//              long-lived user token), so it is never renewed; it stops only
//              if the person who connected it loses the Page or the password
//              changes, and then Reconnect fixes it.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export type MarketingPlatform = "youtube" | "instagram" | "tiktok" | "facebook";

export type FreshLogin = {
  token: string;
  externalId: string | null;
  handle: string | null;
  // What the login was granted, as the platform listed it. Null for logins
  // saved before 052_social.sql, which predate posting.
  scopes: string | null;
};

/** The scope each platform needs for marketing-publish to post. */
export const POSTING_SCOPE: Record<MarketingPlatform, string> = {
  youtube: "youtube.upload",
  instagram: "instagram_content_publish",
  tiktok: "video.upload",
  facebook: "pages_manage_posts",
};

export const canPost = (platform: MarketingPlatform, scopes: string | null) =>
  !!scopes && scopes.includes(POSTING_SCOPE[platform]);

const HOUR_MS = 3600000;

// deno-lint-ignore no-explicit-any
async function postForm(url: string, form: Record<string, string>): Promise<any> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(form),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.access_token) {
    throw new Error(
      `${res.status} ${body?.error_description ?? body?.error?.message ?? body?.error ?? "refresh failed"}`,
    );
  }
  return body;
}

const inSeconds = (s: number) => new Date(Date.now() + s * 1000).toISOString();

async function renew(
  platform: MarketingPlatform,
  row: { access_token: string; refresh_token: string | null },
): Promise<Record<string, string | null>> {
  if (platform === "tiktok") {
    const body = await postForm("https://open.tiktokapis.com/v2/oauth/token/", {
      client_key: Deno.env.get("TIKTOK_CLIENT_KEY") ?? "",
      client_secret: Deno.env.get("TIKTOK_CLIENT_SECRET") ?? "",
      grant_type: "refresh_token",
      refresh_token: row.refresh_token ?? "",
    });
    return {
      access_token: body.access_token,
      access_expires_at: inSeconds(body.expires_in),
      refresh_token: body.refresh_token,
      refresh_expires_at: inSeconds(body.refresh_expires_in),
    };
  }
  // Google keeps the same refresh token and does not send it again.
  const body = await postForm("https://oauth2.googleapis.com/token", {
    client_id: Deno.env.get("YOUTUBE_CLIENT_ID") ?? "",
    client_secret: Deno.env.get("YOUTUBE_CLIENT_SECRET") ?? "",
    grant_type: "refresh_token",
    refresh_token: row.refresh_token ?? "",
  });
  return {
    access_token: body.access_token,
    access_expires_at: inSeconds(body.expires_in),
  };
}

/** How long before expiry each platform's access token is renewed. */
const RENEW_AHEAD_MS: Record<MarketingPlatform, number> = {
  instagram: 0,
  tiktok: HOUR_MS,
  youtube: 5 * 60 * 1000,
  facebook: 0,
};

/**
 * The platform's login with a token good for a while yet, or null if it was
 * never connected. Renews and saves first when it is close to expiry. Throws
 * when renewal fails, which usually means Reconnect.
 */
export async function freshLogin(
  admin: SupabaseClient,
  platform: MarketingPlatform,
): Promise<FreshLogin | null> {
  const { data, error } = await admin
    .from("marketing_accounts")
    .select("access_token, access_expires_at, refresh_token, external_id, handle, scopes")
    .eq("platform", platform)
    .maybeSingle();
  if (error) throw new Error(`accounts: ${error.message}`);
  if (!data?.access_token) return null;

  // No expiry stored means a token that does not expire (Facebook's Page token).
  const expires = data.access_expires_at ? Date.parse(data.access_expires_at) : Infinity;
  if (
    platform === "facebook" ||
    platform === "instagram" ||
    expires - Date.now() > RENEW_AHEAD_MS[platform]
  ) {
    return {
      token: data.access_token,
      externalId: data.external_id,
      handle: data.handle,
      scopes: data.scopes,
    };
  }

  const next = await renew(platform, data);
  const { error: saveErr } = await admin
    .from("marketing_accounts")
    .update(next)
    .eq("platform", platform);
  if (saveErr) throw new Error(`accounts: ${saveErr.message}`);
  return {
    token: next.access_token!,
    externalId: data.external_id,
    handle: data.handle,
    scopes: data.scopes,
  };
}
