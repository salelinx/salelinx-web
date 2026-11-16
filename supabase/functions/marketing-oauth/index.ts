// deno-lint-ignore-file
// marketing-oauth: connects SaleLinx's own YouTube, Instagram, TikTok or
// Facebook Page so marketing-sync can read its stats and marketing-publish can
// post.
//
// Facebook and Instagram share one Facebook login (Meta's "Unified login"):
// Meta no longer gives new apps Instagram Login, so Instagram is reached
// through the SaleLinx Facebook Page it is linked to, with that Page's token.
// Pressing either button connects both.
//
// The scopes asked for include posting (youtube.upload, video.upload,
// pages_manage_posts, instagram_content_publish). A login from before
// posting existed lacks them; the planner says so and Reconnect fixes it.
// What was granted is saved in marketing_accounts.scopes.
//
//   POST { platform, returnTo? }  admin JWT -> { url }: the platform's login
//                       page, with a signed state so the callback knows the
//                       request came from an admin in the last 10 minutes, and
//                       which admin page to go back to (safeReturn: our site or
//                       localhost, under /admin/marketing).
//   GET ?code&state     the platform sends the browser back here; the code is
//                       exchanged for a login, stored in marketing_accounts,
//                       and the browser goes back to that page.
//
// This function's URL is the redirect address registered in the Meta app
// (Instagram login and Facebook login), the TikTok app and the Google Cloud
// OAuth client.

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

type Platform = "youtube" | "instagram" | "tiktok" | "facebook";

const isPlatform = (p: unknown): p is Platform =>
  p === "youtube" || p === "instagram" || p === "tiktok" || p === "facebook";

const FB = "https://graph.facebook.com/v24.0";

const SCOPES: Record<Exclude<Platform, "instagram">, string> = {
  youtube: [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube.readonly",
    "https://www.googleapis.com/auth/yt-analytics.readonly",
  ].join(" "),
  tiktok:
    "user.info.basic,user.info.profile,user.info.stats,video.list,video.upload",
  facebook: [
    // A system user lists the business's Pages through this one.
    "business_management",
    "pages_show_list",
    "pages_read_engagement",
    "pages_manage_posts",
    "read_insights",
    "instagram_basic",
    "instagram_content_publish",
    "instagram_manage_insights",
    // Not used by anything yet; kept on the login for features to come. A
    // feature that reads messages or comments is processing other people's
    // personal data and needs its docs/GDPR.md entry first.
    "instagram_manage_comments",
    "instagram_manage_messages",
    "ads_read",
    "ads_management",
  ].join(","),
};

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

const DEFAULT_RETURN = `${SITE_URL}/admin/marketing`;

/**
 * Where to send the browser after the login: the admin page it started from,
 * on the live site or a local dev server (so Connect works from localhost),
 * and nowhere else. Anything else gets the Stats page.
 */
function safeReturn(raw: unknown): string {
  try {
    const url = new URL(String(raw));
    const site = new URL(SITE_URL).origin;
    const local = /^http:\/\/localhost(:\d+)?$/.test(url.origin);
    if ((url.origin === site || local) && /^\/admin\/marketing(\/|$)/.test(url.pathname))
      return `${url.origin}${url.pathname}`;
  } catch {
    // Not a URL.
  }
  return DEFAULT_RETURN;
}

const fromB64url = (s: string) =>
  new TextDecoder().decode(
    Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)),
  );

// platform.expires.nonce.returnTo(base64url).signature, all of it signed, so
// neither the platform nor the return address can be swapped on the way back.
async function makeState(platform: Platform, returnTo: string): Promise<string> {
  const back = b64url(new TextEncoder().encode(returnTo));
  const payload = `${platform}.${Date.now() + STATE_TTL_MS}.${crypto.randomUUID()}.${back}`;
  return `${payload}.${await sign(payload)}`;
}

async function readState(
  state: string,
): Promise<{ platform: Platform; returnTo: string } | null> {
  const parts = state.split(".");
  if (parts.length !== 5) return null;
  const [platform, expires, nonce, back, sig] = parts;
  if (!(await timingSafeEqual(sig, await sign(`${platform}.${expires}.${nonce}.${back}`))))
    return null;
  if (Number(expires) < Date.now()) return null;
  if (!isPlatform(platform)) return null;
  let returnTo = DEFAULT_RETURN;
  try {
    returnTo = safeReturn(fromB64url(back));
  } catch {
    // Unreadable; fall back to Stats.
  }
  return { platform, returnTo };
}

function authorizeUrl(platform: Platform, state: string): string {
  if (platform === "facebook" || platform === "instagram") {
    // A Meta app of the Business type logs in through a Facebook Login for
    // Business configuration (config_id) that lists the permissions; other
    // types take the scope list. FACEBOOK_LOGIN_CONFIG_ID picks the first.
    const config = Deno.env.get("FACEBOOK_LOGIN_CONFIG_ID");
    return (
      "https://www.facebook.com/v24.0/dialog/oauth?" +
      new URLSearchParams({
        client_id: Deno.env.get("FACEBOOK_APP_ID") ?? "",
        redirect_uri: REDIRECT_URI,
        response_type: "code",
        state,
        ...(config ? { config_id: config } : { scope: SCOPES.facebook }),
      })
    );
  }
  if (platform === "youtube") {
    // offline + consent, so Google sends a refresh token every time.
    return (
      "https://accounts.google.com/o/oauth2/v2/auth?" +
      new URLSearchParams({
        client_id: Deno.env.get("YOUTUBE_CLIENT_ID") ?? "",
        redirect_uri: REDIRECT_URI,
        response_type: "code",
        scope: SCOPES.youtube,
        access_type: "offline",
        prompt: "consent",
        include_granted_scopes: "true",
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
      scope: SCOPES.tiktok,
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

class WrongChannel extends Error {}

// deno-lint-ignore no-explicit-any
async function getJson(url: string): Promise<any> {
  const res = await fetch(url);
  const body = await res.json().catch(() => null);
  if (!res.ok || !body || body.error)
    throw new Error(body?.error?.message ?? `${res.status}`);
  return body;
}

/**
 * Which of the login's Pages is ours: FACEBOOK_PAGE_ID if set, the only one if
 * there is one, else the one named SaleLinx. Null if that does not settle it.
 */
// deno-lint-ignore no-explicit-any
function pickPage(pages: any[]): any | null {
  const wanted = Deno.env.get("FACEBOOK_PAGE_ID");
  if (wanted) return pages.find((p) => String(p.id) === wanted) ?? null;
  if (pages.length === 1) return pages[0];
  const named = pages.filter((p) =>
    `${p.name ?? ""} ${p.username ?? ""}`.toLowerCase().includes("salelinx"),
  );
  return named.length === 1 ? named[0] : null;
}

type AccountRow = Record<string, unknown> & { platform: Platform };
// diag: a one-line account of what the Meta login returned (token type,
// counts, Meta's errors), shown on the admin page when a Page or Instagram
// account is missing. Asset ids and counts only: nothing personal.
type Exchanged = { rows: AccountRow[]; pagesSeen?: number; diag?: string };

type Grants = {
  type: string;
  scopes: string[];
  // Asset ids per permission: which Pages and Instagram accounts it covers.
  targets: Record<string, string[]>;
  expiresAt: string | null;
};

/**
 * What a Meta token was granted, from debug_token (checked with the app's own
 * token). Works for user and system-user tokens alike, and is the only way to
 * see which Page and Instagram ids a system-user token covers. Null if it
 * cannot be read.
 */
async function inspectToken(token: string, appId: string, secret: string): Promise<Grants | null> {
  try {
    const body = await getJson(
      `${FB}/debug_token?` +
        new URLSearchParams({ input_token: token, access_token: `${appId}|${secret}` }),
    );
    const d = body.data ?? {};
    const targets: Record<string, string[]> = {};
    for (const g of d.granular_scopes ?? []) targets[g.scope] = (g.target_ids ?? []).map(String);
    return {
      type: String(d.type ?? "?"),
      scopes: d.scopes ?? [],
      targets,
      // 0 means it never expires.
      expiresAt: d.expires_at ? new Date(d.expires_at * 1000).toISOString() : null,
    };
  } catch {
    return null;
  }
}

/**
 * Facebook and Instagram from one Facebook login.
 *
 * The code becomes a user token, swapped for the 60-day one (a configuration
 * set to a system-user token gives one that never expires and cannot be
 * swapped, so it is kept as it is). Our Page comes from the login's Page list,
 * or, when that is empty (system-user tokens), from the Page ids the token was
 * granted. The Page's own token never expires and serves both the Page and the
 * Instagram account linked to it.
 *
 * With no Page, or none linked, the Instagram account the login was granted
 * directly is used with the login's own token instead.
 */
async function exchangeMeta(code: string): Promise<Exchanged> {
  const id = Deno.env.get("FACEBOOK_APP_ID") ?? "";
  const secret = Deno.env.get("FACEBOOK_APP_SECRET") ?? "";
  const short = await getJson(
    `${FB}/oauth/access_token?` +
      new URLSearchParams({ client_id: id, client_secret: secret, redirect_uri: REDIRECT_URI, code }),
  );
  let token: string = short.access_token;
  try {
    const long = await getJson(
      `${FB}/oauth/access_token?` +
        new URLSearchParams({
          grant_type: "fb_exchange_token",
          client_id: id,
          client_secret: secret,
          fb_exchange_token: token,
        }),
    );
    token = long.access_token ?? token;
  } catch {
    // A system-user token: already permanent.
  }

  const grants = await inspectToken(token, id, secret);
  const granted = grants?.scopes.length ? grants.scopes.join(",") : SCOPES.facebook;
  const idsFor = (...scopes: string[]) => [
    ...new Set(scopes.flatMap((sc) => grants?.targets[sc] ?? [])),
  ];

  const notes: string[] = [
    `token=${grants?.type ?? "unreadable"}`,
    `perms=${grants?.scopes.length ?? "?"}`,
    `granted=${grants?.scopes.join(",") ?? "?"}`,
  ];
  const errors: string[] = [];
  const noteError = (where: string) => (err: Error) => {
    errors.push(`${where}: ${err.message}`.slice(0, 160));
    return null;
  };

  // A user token lists its Pages at /me/accounts; a system-user token keeps
  // them at /me/assigned_pages; failing both, look up each Page id the token
  // was granted.
  const pageFields = "fields=id,name,username,access_token&limit=100";
  // deno-lint-ignore no-explicit-any
  const pages: any[] = [];
  for (const edge of ["accounts", "assigned_pages"]) {
    const list = await getJson(`${FB}/me/${edge}?${pageFields}&access_token=${token}`).catch(
      noteError(edge),
    );
    // deno-lint-ignore no-explicit-any
    pages.push(...(list?.data ?? []).filter((p: any) => p.access_token));
    notes.push(`${edge}=${list?.data?.length ?? "err"}`);
    if (pages.length) break;
  }
  const grantedPages = idsFor("pages_show_list", "pages_manage_posts", "pages_read_engagement");
  notes.push(`page_ids=${grantedPages.length}`);
  if (!pages.length) {
    for (const pageId of grantedPages) {
      const p = await getJson(
        `${FB}/${pageId}?fields=id,name,username,access_token&access_token=${token}`,
      ).catch(noteError("page"));
      if (p?.access_token) pages.push(p);
    }
  }
  const page = pickPage(pages);

  const rows: AccountRow[] = [];
  // deno-lint-ignore no-explicit-any
  let ig: any = null;
  let igToken = token;
  let igExpires = grants?.expiresAt ?? null;
  if (page?.access_token) {
    rows.push({
      platform: "facebook",
      external_id: String(page.id),
      handle: page.username ? `@${page.username}` : (page.name ?? null),
      access_token: page.access_token,
      access_expires_at: null,
      refresh_token: null,
      refresh_expires_at: null,
      scopes: granted,
    });
    const linked = await getJson(
      `${FB}/${page.id}?fields=instagram_business_account{id,username}&access_token=${page.access_token}`,
    ).catch(noteError("linked_ig"));
    if (linked?.instagram_business_account?.id) {
      ig = linked.instagram_business_account;
      igToken = page.access_token;
      igExpires = null;
    }
  }
  if (!ig) {
    // deno-lint-ignore no-explicit-any
    const found: any[] = [];
    const grantedIg = idsFor("instagram_basic", "instagram_content_publish");
    notes.push(`ig_ids=${grantedIg.length}`);
    for (const igId of grantedIg) {
      const a = await getJson(`${FB}/${igId}?fields=id,username&access_token=${token}`).catch(
        noteError("ig"),
      );
      if (a?.id) found.push(a);
    }
    ig =
      found.length === 1
        ? found[0]
        : (found.find((a) => String(a.username ?? "").toLowerCase().includes("salelinx")) ?? null);
  }
  if (ig) {
    rows.push({
      platform: "instagram",
      external_id: String(ig.id),
      handle: ig.username ? `@${ig.username}` : null,
      access_token: igToken,
      access_expires_at: igExpires,
      refresh_token: null,
      refresh_expires_at: null,
      scopes: granted,
    });
  }
  const diag = [...notes, ...errors].join("; ").slice(0, 600);
  if (!rows.length) console.error("[marketing-oauth] meta login gave no assets:", diag);
  return { rows, pagesSeen: pages.length, diag };
}

async function exchange(platform: Platform, code: string): Promise<Exchanged> {
  if (platform === "facebook" || platform === "instagram") return exchangeMeta(code);
  if (platform === "youtube") {
    const body = await postForm("https://oauth2.googleapis.com/token", {
      client_id: Deno.env.get("YOUTUBE_CLIENT_ID") ?? "",
      client_secret: Deno.env.get("YOUTUBE_CLIENT_SECRET") ?? "",
      grant_type: "authorization_code",
      redirect_uri: REDIRECT_URI,
      code,
    });
    if (!body.refresh_token) throw new Error("Google sent no refresh token");
    const res = await fetch(
      "https://www.googleapis.com/youtube/v3/channels?part=id,snippet&mine=true",
      { headers: { Authorization: `Bearer ${body.access_token}` } },
    );
    const channel = (await res.json().catch(() => null))?.items?.[0];
    if (!res.ok || !channel) throw new Error(`no channel on that Google login (${res.status})`);
    // Uploads go wherever this login points, so it must be our channel: the
    // one marketing-sync already reads, or else the configured handle.
    const { data: known } = await admin
      .from("marketing_accounts")
      .select("external_id")
      .eq("platform", "youtube")
      .maybeSingle();
    const handle = (Deno.env.get("YOUTUBE_CHANNEL_HANDLE") ?? "@salelinx").toLowerCase();
    const ours = known?.external_id
      ? channel.id === known.external_id
      : String(channel.snippet?.customUrl ?? "").toLowerCase() === handle;
    if (!ours) throw new WrongChannel(channel.id);
    return { rows: [{
      platform,
      external_id: channel.id,
      handle: channel.snippet?.customUrl ?? null,
      access_token: body.access_token,
      access_expires_at: new Date(Date.now() + body.expires_in * 1000).toISOString(),
      refresh_token: body.refresh_token,
      refresh_expires_at: null,
      scopes: body.scope ?? SCOPES.youtube,
    }] };
  }
  const body = await postForm("https://open.tiktokapis.com/v2/oauth/token/", {
    client_key: Deno.env.get("TIKTOK_CLIENT_KEY") ?? "",
    client_secret: Deno.env.get("TIKTOK_CLIENT_SECRET") ?? "",
    grant_type: "authorization_code",
    redirect_uri: REDIRECT_URI,
    code,
  });
  return { rows: [{
    platform,
    external_id: body.open_id ?? null,
    access_token: body.access_token,
    access_expires_at: new Date(
      Date.now() + body.expires_in * 1000,
    ).toISOString(),
    refresh_token: body.refresh_token,
    refresh_expires_at: new Date(
      Date.now() + body.refresh_expires_in * 1000,
    ).toISOString(),
    scopes: body.scope ?? SCOPES.tiktok,
  }] };
}

const backToAdmin = (query: string, returnTo = DEFAULT_RETURN) =>
  new Response(null, {
    status: 302,
    headers: { Location: `${returnTo}?${query}` },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { status: 204, headers: corsHeaders });

  if (req.method === "POST") {
    const gate = await requireAdmin(req, admin, corsHeaders);
    if (gate instanceof Response) return gate;
    const { platform, returnTo } = await req.json().catch(() => ({}));
    if (!isPlatform(platform)) {
      return new Response(JSON.stringify({ error: "unknown_platform" }), {
        status: 400,
        headers: corsHeaders,
      });
    }
    return new Response(
      JSON.stringify({
        url: authorizeUrl(platform, await makeState(platform, safeReturn(returnTo))),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  if (req.method === "GET") {
    const params = new URL(req.url).searchParams;
    const state = await readState(params.get("state") ?? "");
    if (!state) return backToAdmin("error=expired");
    const { platform, returnTo } = state;
    const code = params.get("code");
    // Declined on the platform's page, or an error it reported.
    if (!code) return backToAdmin(`error=declined&platform=${platform}`, returnTo);
    try {
      const now = new Date().toISOString();
      const { rows, pagesSeen, diag } = await exchange(platform, code);
      const why = diag ? `&diag=${encodeURIComponent(diag)}` : "";
      if (rows.length) {
        const { error } = await admin
          .from("marketing_accounts")
          .upsert(rows.map((r) => ({ ...r, connected_at: now, last_error: null })));
        if (error) throw new Error(error.message);
      }
      // Whatever came through is saved; say what is missing for the button pressed.
      const has = (p: Platform) => rows.some((r) => r.platform === p);
      if (platform === "facebook" && !has("facebook"))
        return backToAdmin(
          `error=facebook_page&platform=${platform}&seen=${pagesSeen ?? 0}${has("instagram") ? "&ig=1" : ""}${why}`,
          returnTo,
        );
      if (platform === "instagram" && !has("instagram"))
        return backToAdmin(
          has("facebook")
            ? `error=no_instagram&platform=${platform}${why}`
            : `error=facebook_page&platform=${platform}&seen=${pagesSeen ?? 0}${why}`,
          returnTo,
        );
      return backToAdmin(`connected=${platform}`, returnTo);
    } catch (err) {
      if (err instanceof WrongChannel)
        return backToAdmin(`error=wrong_channel&platform=${platform}`, returnTo);
      console.error(
        `[marketing-oauth] ${platform} exchange failed:`,
        (err as Error).message,
      );
      return backToAdmin(`error=exchange&platform=${platform}`, returnTo);
    }
  }

  return new Response("Method not allowed", {
    status: 405,
    headers: corsHeaders,
  });
});
