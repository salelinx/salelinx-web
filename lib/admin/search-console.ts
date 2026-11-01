import { createSign } from "node:crypto";

export type SearchRow = {
  url: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number | null;
  inSitemap: boolean;
  title?: string;
};

type ApiRow = {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

const SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

function base64url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64url");
}

async function accessToken(): Promise<string> {
  let key: { client_email: string; private_key: string };
  try {
    key = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON ?? "");
  } catch {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_JSON in Vercel is not valid JSON. Paste the whole key file again, from the first { to the last }, then redeploy.",
    );
  }
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${base64url(
    JSON.stringify({
      iss: key.client_email,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 600,
    }),
  )}`;
  const signature = createSign("RSA-SHA256")
    .update(unsigned)
    .sign(key.private_key);
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${base64url(signature)}`,
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Google token request failed (${res.status})`);
  return ((await res.json()) as { access_token: string }).access_token;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function fetchSearchConsolePages(
  days: number,
  now = new Date(),
): Promise<{ rows: ApiRow[]; startDate: string; endDate: string }> {
  const site = process.env.GSC_SITE_URL ?? "sc-domain:salelinx.com";
  const end = new Date(now.getTime() - 86400000);
  const start = new Date(end.getTime() - (days - 1) * 86400000);
  const body = {
    startDate: isoDate(start),
    endDate: isoDate(end),
    dimensions: ["page"],
    rowLimit: 25000,
  };
  const res = await fetch(
    `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${await accessToken()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    },
  );
  if (!res.ok)
    throw new Error(
      `Search Console query failed (${res.status}): ${await res.text()}`,
    );
  const json = (await res.json()) as { rows?: ApiRow[] };
  return {
    rows: json.rows ?? [],
    startDate: body.startDate,
    endDate: body.endDate,
  };
}

const normalize = (url: string) => url.replace(/\/$/, "");

export function mergeWithSitemap(
  sitemapUrls: string[],
  rows: ApiRow[],
): SearchRow[] {
  const byUrl = new Map<string, SearchRow>();
  for (const url of sitemapUrls) {
    byUrl.set(normalize(url), {
      url,
      clicks: 0,
      impressions: 0,
      ctr: 0,
      position: null,
      inSitemap: true,
    });
  }
  for (const r of rows) {
    const key = normalize(r.keys[0]);
    const existing = byUrl.get(key);
    byUrl.set(key, {
      url: existing?.url ?? r.keys[0],
      clicks: r.clicks,
      impressions: r.impressions,
      ctr: r.ctr,
      position: r.position,
      inSitemap: Boolean(existing),
    });
  }
  return [...byUrl.values()].sort(
    (a, b) =>
      b.clicks - a.clicks ||
      b.impressions - a.impressions ||
      a.url.localeCompare(b.url),
  );
}
