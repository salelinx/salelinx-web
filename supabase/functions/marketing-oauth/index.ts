// deno-lint-ignore-file
// marketing-oauth: connects SaleLinx's own Instagram or TikTok account so
// marketing-sync can read its stats.
//
//   POST { platform }  admin JWT -> { url }: the platform's login page, with a
//                       signed state so the callback knows the request came
//                       from an admin in the last 10 minutes.
//   GET ?code&state     the platform sends the browser back here; the code is
//                       exchanged for a login, stored in marketing_accounts,
//                       and the browser goes back to /admin/marketing.
//
// This function's URL is the redirect address registered in the Meta and
// TikTok developer apps.

import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  corsHeaders as sharedCorsHeaders,
  timingSafeEqual,
} from "../_shared/security.ts";
import { requireAdmin } from "../_shared/admin-gate.ts";

const corsHeaders = sharedCorsHeaders();
const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const SITE_URL = (Deno.env.get("SITE_URL") ?? "https://salelinx.com").replace(
  /\/$/,
  "",
);
const REDIRECT_URI = `${Deno.env.get("SUPABASE_URL")}/functions/v1/marketing-oauth`;
const STATE_TTL_MS = 10 * 60 * 1000;

type Platform = "instagram" | "tiktok";

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

async function sign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(Deno.env.get("MARKETING_SECRET") ?? ""),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return b64url(
    new Uint8Array(
      await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)),
    ),
  );
}

async function makeState(platform: Platform): Promise<string> {
  const payload = `${platform}.${Date.now() + STATE_TTL_MS}.${crypto.randomUUID()}`;
  return `${payload}.${await sign(payload)}`;
}

async function readState(state: string): Promise<Platform | null> {
  const parts = state.split(".");
  if (parts.length !== 4) return null;
  const [platform, expires, nonce, sig] = parts;
  if (
    !(await timingSafeEqual(sig, await sign(`${platform}.${expires}.${nonce}`)))
  )
    return null;
  if (Number(expires) < Date.now()) return null;
  return platform === "instagram" || platform === "tiktok" ? platform : null;
}

function authorizeUrl(platform: Platform, state: string): string {
  if (platform === "instagram") {
    return (
      "https://www.instagram.com/oauth/authorize?" +
      new URLSearchParams({
        client_id: Deno.env.get("INSTAGRAM_APP_ID") ?? "",
        redirect_uri: REDIRECT_URI,
        response_type: "code",
        scope: "instagram_business_basic,instagram_business_manage_insights",
        state,
      })
    );
  }
  return (
    "https://www.tiktok.com/v2/auth/authorize/?" +
    new URLSearchParams({
      client_key: Deno.env.get("TIKTOK_CLIENT_KEY") ?? "",
      redirect_uri: REDIRECT_URI,
      response_type: "code",
      scope: "user.info.basic,user.info.profile,user.info.stats,video.list",
      state,
    })
  );
}

// deno-lint-ignore no-explicit-any
async function postForm(
  url: string,
  form: Record<string, string>,
): Promise<any> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(form),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body || body.error || body.error_message) {
    throw new Error(
      body?.error_description ??
        body?.error_message ??
        body?.error?.message ??
        `${res.status}`,
    );
  }
  return body;
}

async function exchange(
  platform: Platform,
  code: string,
): Promise<Record<string, unknown>> {
  if (platform === "instagram") {
    // A one-hour token first, swapped for the 60-day one marketing-sync renews.
    const short = await postForm(
      "https://api.instagram.com/oauth/access_token",
      {
        client_id: Deno.env.get("INSTAGRAM_APP_ID") ?? "",
        client_secret: Deno.env.get("INSTAGRAM_APP_SECRET") ?? "",
        grant_type: "authorization_code",
        redirect_uri: REDIRECT_URI,
        code,
      },
    );
    const res = await fetch(
      "https://graph.instagram.com/access_token?" +
        new URLSearchParams({
          grant_type: "ig_exchange_token",
          client_secret: Deno.env.get("INSTAGRAM_APP_SECRET") ?? "",
          access_token: short.access_token,
        }),
    );
    const long = await res.json();
    if (!res.ok || !long.access_token)
      throw new Error(long?.error?.message ?? `${res.status}`);
    return {
      external_id: String(short.user_id ?? ""),
      access_token: long.access_token,
      access_expires_at: new Date(
        Date.now() + long.expires_in * 1000,
      ).toISOString(),
      refresh_token: null,
      refresh_expires_at: null,
    };
  }
  const body = await postForm("https://open.tiktokapis.com/v2/oauth/token/", {
    client_key: Deno.env.get("TIKTOK_CLIENT_KEY") ?? "",
    client_secret: Deno.env.get("TIKTOK_CLIENT_SECRET") ?? "",
    grant_type: "authorization_code",
    redirect_uri: REDIRECT_URI,
    code,
  });
  return {
    external_id: body.open_id ?? null,
    access_token: body.access_token,
    access_expires_at: new Date(
      Date.now() + body.expires_in * 1000,
    ).toISOString(),
    refresh_token: body.refresh_token,
    refresh_expires_at: new Date(
      Date.now() + body.refresh_expires_in * 1000,
    ).toISOString(),
  };
}

const backToAdmin = (query: string) =>
  new Response(null, {
    status: 302,
    headers: { Location: `${SITE_URL}/admin/marketing?${query}` },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { status: 204, headers: corsHeaders });

  if (req.method === "POST") {
    const gate = await requireAdmin(req, admin, corsHeaders);
    if (gate instanceof Response) return gate;
    const { platform } = await req.json().catch(() => ({}));
    if (platform !== "instagram" && platform !== "tiktok") {
      return new Response(JSON.stringify({ error: "unknown_platform" }), {
        status: 400,
        headers: corsHeaders,
      });
    }
    return new Response(
      JSON.stringify({
        url: authorizeUrl(platform, await makeState(platform)),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  if (req.method === "GET") {
    const params = new URL(req.url).searchParams;
    const platform = await readState(params.get("state") ?? "");
    if (!platform) return backToAdmin("error=expired");
    const code = params.get("code");
    // Declined on the platform's page, or an error it reported.
    if (!code) return backToAdmin(`error=declined&platform=${platform}`);
    try {
      const login = await exchange(platform, code);
      const { error } = await admin.from("marketing_accounts").upsert({
        platform,
        ...login,
        connected_at: new Date().toISOString(),
        last_error: null,
      });
      if (error) throw new Error(error.message);
      return backToAdmin(`connected=${platform}`);
    } catch (err) {
      console.error(
        `[marketing-oauth] ${platform} exchange failed:`,
        (err as Error).message,
      );
      return backToAdmin(`error=exchange&platform=${platform}`);
    }
  }

  return new Response("Method not allowed", {
    status: 405,
    headers: corsHeaders,
  });
});
