// The endpoint the external scheduler calls to start the Supabase watchdog.
//
// The load-bearing assertion is that it never dispatches unauthenticated. An
// open trigger is an amplifier: each call spends a CI run that probes the
// health endpoint three times, pointed at the service the watchdog exists to
// protect. Unlike /api/health/supabase, an unset secret must fail closed
// rather than leave it open.

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { GET } from "@/app/api/watchdog/trigger/route";

const SECRET = "test-trigger-secret";

const call = (authorization?: string) =>
  GET(
    new Request("https://salelinx.com/api/watchdog/trigger", {
      headers: authorization ? { authorization } : {},
    }),
  );

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("WATCHDOG_DISPATCH_TOKEN", "test-token");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("watchdog trigger", () => {
  it("fails closed when the secret is unset, and dispatches nothing", async () => {
    vi.stubEnv("WATCHDOG_TRIGGER_SECRET", "");
    const res = await call(`Bearer ${SECRET}`);
    expect(res.status).toBe(500);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a wrong secret without dispatching", async () => {
    vi.stubEnv("WATCHDOG_TRIGGER_SECRET", SECRET);
    const res = await call("Bearer nope");
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a missing header without dispatching", async () => {
    vi.stubEnv("WATCHDOG_TRIGGER_SECRET", SECRET);
    const res = await call();
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("dispatches the workflow on main when the header matches", async () => {
    vi.stubEnv("WATCHDOG_TRIGGER_SECRET", SECRET);
    const res = await call(`Bearer ${SECRET}`);
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("supabase-watchdog.yml/dispatches");
    expect(JSON.parse(init.body as string)).toEqual({ ref: "main" });
  });

  it("reports a failed dispatch rather than claiming success", async () => {
    // A token that expired or lost its Actions scope answers 404 here.
    // Returning ok would make the trigger look alive while nothing ever ran.
    vi.stubEnv("WATCHDOG_TRIGGER_SECRET", SECRET);
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }));
    const res = await call(`Bearer ${SECRET}`);
    expect(res.status).toBe(502);
  });
});
