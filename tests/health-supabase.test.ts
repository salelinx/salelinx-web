// The Supabase health probe, which exists because the 2026-09-06 outage ran
// for five hours before anyone noticed.
//
// The load-bearing assertion in here is that a 400 from /token is HEALTHY. It
// looks like a bug every time someone reads it, so it is pinned by a test with
// the reason attached: a 400 proves auth reached the database and looked the
// token up. During the outage that same call returned 500 "context deadline
// exceeded". A probe expecting 200 would have been red permanently; a liveness
// ping on /auth/v1/health would have been green throughout.

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { summarise, type ProbeResult } from "@/app/api/health/supabase/route";

const probe = (name: string, ok: boolean): ProbeResult => ({
  name,
  ok,
  status: ok ? 200 : 503,
  ms: 5,
});

describe("summarise", () => {
  it("is healthy only when every probe passes", () => {
    expect(summarise([probe("a", true), probe("b", true)]).httpStatus).toBe(
      200,
    );
  });

  it("fails the whole check if either half is down", () => {
    // Auth down with PostgREST fine is still every user locked out, so there
    // is no partial-credit status here.
    expect(
      summarise([probe("auth_token_refresh", false), probe("rest_read", true)])
        .httpStatus,
    ).toBe(503);
    expect(
      summarise([probe("auth_token_refresh", true), probe("rest_read", false)])
        .httpStatus,
    ).toBe(503);
  });

  it("treats an empty probe list as unhealthy, not as vacuous success", () => {
    // `[].every(...)` is true, which would report a health check that ran
    // nothing as passing - the worst possible failure for this endpoint.
    expect(summarise([]).ok).toBe(false);
  });
});

describe("GET /api/health/supabase", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = {
      ...OLD_ENV,
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
    };
    delete process.env.HEALTH_CHECK_TOKEN;
  });

  afterEach(() => {
    process.env = OLD_ENV;
    vi.unstubAllGlobals();
  });

  /** Fake Supabase: `authStatus` / `restStatus` are what each endpoint returns. */
  function stubSupabase(authStatus: number, restStatus: number) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.includes("/auth/v1/token")
          ? new Response("{}", { status: authStatus })
          : new Response("[]", { status: restStatus }),
      ),
    );
  }

  async function callRoute() {
    const { GET } = await import("@/app/api/health/supabase/route");
    return GET(new Request("https://salelinx.com/api/health/supabase"));
  }

  it("reports healthy when auth answers 400 and REST answers 200", async () => {
    stubSupabase(400, 200);
    const res = await callRoute();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ ok: true, failed: [] });
  });

  it("reports unhealthy when auth returns 500 — the actual outage signature", async () => {
    // What /token did on 2026-09-06: "error finding session from refresh
    // token: context deadline exceeded".
    stubSupabase(500, 200);
    const res = await callRoute();
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toMatchObject({
      ok: false,
      failed: ["auth_token_refresh"],
    });
  });

  it("treats a 200 from /token as UNHEALTHY", async () => {
    // A real 200 would mean the sentinel token authenticated, which cannot
    // happen. If this ever goes green, the probe is not testing what we think.
    stubSupabase(200, 200);
    expect((await callRoute()).status).toBe(503);
  });

  it("catches PostgREST wedging while auth is fine", async () => {
    // The four hours of PostgREST silence, returning 504 behind the gateway.
    stubSupabase(400, 504);
    const res = await callRoute();
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toMatchObject({ failed: ["rest_read"] });
  });

  it("never caches, so a monitor can't be served a stale all-clear", async () => {
    stubSupabase(400, 200);
    expect((await callRoute()).headers.get("Cache-Control")).toContain(
      "no-store",
    );
  });

  it("returns 500, not 503, when env vars are missing", async () => {
    // A bad deploy must not page someone as a Supabase incident.
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    stubSupabase(400, 200);
    expect((await callRoute()).status).toBe(500);
  });

  describe("shared secret", () => {
    it("is open when HEALTH_CHECK_TOKEN is unset", async () => {
      stubSupabase(400, 200);
      expect((await callRoute()).status).toBe(200);
    });

    it("rejects a caller without the token once configured", async () => {
      process.env.HEALTH_CHECK_TOKEN = "s3cret";
      stubSupabase(400, 200);
      expect((await callRoute()).status).toBe(401);
    });

    it("accepts the correct token and runs the probes", async () => {
      process.env.HEALTH_CHECK_TOKEN = "s3cret";
      stubSupabase(400, 200);
      const { GET } = await import("@/app/api/health/supabase/route");
      const res = await GET(
        new Request("https://salelinx.com/api/health/supabase", {
          headers: { "x-health-token": "s3cret" },
        }),
      );
      expect(res.status).toBe(200);
    });

    it("rejects a token of the same length that differs", async () => {
      process.env.HEALTH_CHECK_TOKEN = "s3cret";
      stubSupabase(400, 200);
      const { GET } = await import("@/app/api/health/supabase/route");
      const res = await GET(
        new Request("https://salelinx.com/api/health/supabase", {
          headers: { "x-health-token": "s3crXt" },
        }),
      );
      expect(res.status).toBe(401);
    });
  });
});
