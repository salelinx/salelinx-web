// Supabase health probe, for an external uptime monitor to poll.
//
// This exists because of the 2026-09-06 outage: Supabase was unusable from
// 06:26 to 11:44 UTC and nobody knew until someone happened to look. Every
// user's extension was dead for over five hours. The database recovering is
// not the hard part - noticing is.
//
// WHY IT LIVES ON VERCEL, NOT SUPABASE
// A monitor must not run on the thing it monitors. Every other notification
// path we have (Resend emails, the referral cron) is a Supabase Edge Function,
// which is exactly where a Supabase-down alert cannot live. This repo deploys
// to Vercel, which is independent infrastructure.
//
// The trade is that a Vercel outage makes this endpoint fail and look like a
// Supabase problem. That is acceptable - both are worth waking up for - but it
// is why the response says WHICH probe failed rather than just "unhealthy".
//
// WHAT IT ACTUALLY TESTS, AND WHY NOT THE OBVIOUS THING
// The obvious probe is `GET /auth/v1/health`. Do not use it. It reports that
// the GoTrue process is alive, not that it can serve authentication - during
// the outage GoTrue was up and answering, and failing every /token request
// with "context deadline exceeded" because it could not get a database
// connection. A liveness ping would have stayed green for the whole five
// hours.
//
// So both probes here deliberately cross into Postgres:
//
//   auth_token_refresh - POST /token with a deliberately invalid refresh
//     token. A HEALTHY response is 400 ("Refresh token is not valid"), which
//     proves auth reached the database and looked the token up. The broken
//     response is 500 or a timeout. This is the probe that would have caught
//     the incident, and the expected-400 is not a mistake.
//
//   rest_read - a one-row read through PostgREST. During the outage PostgREST
//     logged nothing at all for four hours while returning 504/522.
//
// Neither probe writes, neither needs a session, and both use the anon key,
// which is public by design (it ships in the extension bundle and this site's
// JS). There is no service-role key on Vercel and this endpoint must never
// need one - see docs/OVERVIEW.md.

import { NextResponse } from "next/server";

// A cached health check is worse than no health check: it reports the past.
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Per-probe timeout. Well under a monitor's typical 10s so we return a real
 *  answer rather than being cut off - during the outage requests hung rather
 *  than failing fast, and a hung probe is indistinguishable from a hung
 *  monitor. */
const PROBE_TIMEOUT_MS = 5_000;

/** Sent to /token deliberately. It is not a credential and never matches a
 *  real token; the point is to make auth perform a database lookup and tell us
 *  it found nothing. */
const SENTINEL_REFRESH_TOKEN = "salelinx-healthcheck-not-a-real-token";

export interface ProbeResult {
  name: string;
  ok: boolean;
  /** HTTP status the probe saw, or null if it never got one (timeout, DNS). */
  status: number | null;
  ms: number;
  /** Short failure reason. Never contains keys, tokens or response bodies. */
  detail?: string;
}

/**
 * Roll probe results into the response. Any failure is a failure - these are
 * two halves of one system, and auth being down with PostgREST fine is still
 * every user locked out.
 */
export function summarise(probes: ProbeResult[]): {
  ok: boolean;
  httpStatus: number;
} {
  const ok = probes.length > 0 && probes.every((p) => p.ok);
  return { ok, httpStatus: ok ? 200 : 503 };
}

/**
 * Constant-time string compare for the optional shared secret. Hand-rolled
 * rather than `crypto.timingSafeEqual` so this route stays runtime-agnostic
 * (that needs Node and equal-length buffers). Length is compared first and
 * leaks only the length, which is not the secret.
 */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function runProbe(
  name: string,
  url: string,
  init: RequestInit,
  isHealthy: (status: number) => boolean,
): Promise<ProbeResult> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
    });
    const ms = Date.now() - started;
    const ok = isHealthy(res.status);
    return ok
      ? { name, ok, status: res.status, ms }
      : {
          name,
          ok,
          status: res.status,
          ms,
          detail: `unexpected status ${res.status}`,
        };
  } catch (err) {
    // An abort here is the signal, not an error to swallow: a probe that never
    // came back within 5s is precisely the outage symptom.
    const aborted = err instanceof Error && err.name === "AbortError";
    return {
      name,
      ok: false,
      status: null,
      ms: Date.now() - started,
      detail: aborted
        ? `timeout after ${PROBE_TIMEOUT_MS}ms`
        : "request failed",
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(request: Request) {
  const noStore = { "Cache-Control": "no-store, max-age=0" };

  // Optional shared secret. When HEALTH_CHECK_TOKEN is set, only a caller
  // presenting it gets a probe run - this endpoint makes two outbound requests
  // per call, so an open one is a small amplifier pointed at the very service
  // it is meant to protect. Unset (the default) leaves it open, so it works
  // before anyone configures anything.
  const expected = process.env.HEALTH_CHECK_TOKEN;
  if (expected) {
    const supplied = request.headers.get("x-health-token") ?? "";
    if (!safeEqual(supplied, expected)) {
      return NextResponse.json(
        { ok: false, error: "unauthorised" },
        { status: 401, headers: noStore },
      );
    }
  }

  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!baseUrl || !anonKey) {
    // Misconfiguration, not an outage. 500 keeps it distinct from the 503 that
    // means "Supabase is actually down", so a bad deploy doesn't read as an
    // incident.
    return NextResponse.json(
      { ok: false, error: "health check not configured" },
      { status: 500, headers: noStore },
    );
  }

  const probes = await Promise.all([
    runProbe(
      "auth_token_refresh",
      `${baseUrl}/auth/v1/token?grant_type=refresh_token`,
      {
        method: "POST",
        headers: { apikey: anonKey, "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: SENTINEL_REFRESH_TOKEN }),
      },
      // 400 is the healthy answer - see the file header.
      (status) => status === 400,
    ),
    runProbe(
      "rest_read",
      `${baseUrl}/rest/v1/tier_limits?select=tier_id&limit=1`,
      { method: "GET", headers: { apikey: anonKey } },
      (status) => status === 200,
    ),
  ]);

  const { ok, httpStatus } = summarise(probes);
  return NextResponse.json(
    {
      ok,
      checkedAt: new Date().toISOString(),
      failed: probes.filter((p) => !p.ok).map((p) => p.name),
      probes,
    },
    { status: httpStatus, headers: noStore },
  );
}
