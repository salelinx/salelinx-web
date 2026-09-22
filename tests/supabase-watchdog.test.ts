// The watchdog's restart decision.
//
// The load-bearing case is the first one: on 2026-09-17 19:14 UTC the watchdog
// probed three times, got a served 503 naming both failed Supabase probes
// every time, and did not restart, because the management API said
// ACTIVE_HEALTHY. That status is a lifecycle state and stays green through an
// outage, so deferring to it meant the watchdog could never fire. If that test
// goes red, the veto is back and the thing is decorative again.

import { describe, expect, it } from "vitest";
// @ts-expect-error - plain .mjs script, no types, and tests are outside tsc
import {
  classifyBody,
  decide,
  SUPABASE_DOWN,
  UNREACHABLE,
} from "../scripts/supabase-watchdog.mjs";

const down = [SUPABASE_DOWN, SUPABASE_DOWN, SUPABASE_DOWN];
const unreachable = [UNREACHABLE, UNREACHABLE, UNREACHABLE];

describe("decide", () => {
  it("restarts on served 503s even when the platform claims ACTIVE_HEALTHY", () => {
    // The 2026-09-17 regression, pinned.
    const { action } = decide({
      kinds: down,
      status: "ACTIVE_HEALTHY",
      armed: true,
    });
    expect(action).toBe("restart");
  });

  it("stands down when no probe reached our endpoint and the platform is healthy", () => {
    // Nothing here is evidence about Supabase: a restart would mean causing an
    // outage because we could not reach a webpage.
    const { action } = decide({
      kinds: unreachable,
      status: "ACTIVE_HEALTHY",
      armed: true,
    });
    expect(action).toBe("abstain");
  });

  it("treats a single served 503 as proof, even mixed with timeouts", () => {
    // A served 503 cannot be manufactured by a flaky hop, so one flaky probe
    // must not veto a real outage.
    const { action } = decide({
      kinds: [UNREACHABLE, SUPABASE_DOWN, UNREACHABLE],
      status: "ACTIVE_HEALTHY",
      armed: true,
    });
    expect(action).toBe("restart");
  });

  it("restarts on unreachable probes when the platform also reports trouble", () => {
    const { action } = decide({
      kinds: unreachable,
      status: "ACTIVE_UNHEALTHY",
      armed: true,
    });
    expect(action).toBe("restart");
  });

  it("never restarts a project that is already mid-transition", () => {
    // Piling a restart onto a recovery already under way either gets ignored
    // or interrupts it.
    for (const status of ["RESTARTING", "COMING_UP", "RESTORING"]) {
      expect(decide({ kinds: down, status, armed: true }).action).toBe("wait");
    }
  });

  it("never restarts a paused project, which would silently resume billing", () => {
    for (const status of ["INACTIVE", "REMOVED", "INIT_FAILED"]) {
      expect(decide({ kinds: down, status, armed: true }).action).toBe(
        "abstain",
      );
    }
  });

  it("reports but does not act when disarmed", () => {
    const { action, reason } = decide({
      kinds: down,
      status: "ACTIVE_HEALTHY",
      armed: false,
    });
    expect(action).toBe("abstain");
    expect(reason).toContain("WOULD RESTART");
  });

  it("checks pause state before arming state, so a disarmed run still refuses", () => {
    // Ordering guard: a paused project must read as "not something a restart
    // fixes", not as "would restart if armed".
    const { reason } = decide({
      kinds: down,
      status: "INACTIVE",
      armed: false,
    });
    expect(reason).not.toContain("WOULD RESTART");
  });
});

// What a failed probe actually proves. This is the function that decides
// whether production gets restarted, so every case here is a real reading
// taken from the 2026-09-22 logs.
describe("classifyBody", () => {
  const probe = (name: string, status: number | null, detail?: string) => ({
    name,
    ok: false,
    status,
    ms: 1,
    detail,
  });

  it("does NOT treat a probe timeout as proof Supabase is down", () => {
    // The whole 2026-09-22 loop in one assertion. Our probe gave up after 5s
    // while PostgREST was mid schema reload; Postgres logged no error all
    // night. If this goes red, a slow reload restarts production again.
    const { kind } = classifyBody({
      probes: [
        probe("auth_token_refresh", null, "timeout after 5000ms"),
        probe("rest_read", null, "timeout after 5000ms"),
      ],
    });
    expect(kind).toBe(UNREACHABLE);
  });

  it("does NOT treat a Cloudflare 52x as proof", () => {
    // 521/522 mean the edge could not reach the origin. That is exactly what
    // our own restart produces, which is how the cascade fed itself.
    for (const status of [520, 521, 522, 523, 524]) {
      expect(classifyBody({ probes: [probe("rest_read", status)] }).kind).toBe(
        UNREACHABLE,
      );
    }
  });

  it("treats a Supabase-generated 5xx as proof", () => {
    // The 2026-09-06 signature: GoTrue answering 500 "context deadline
    // exceeded". Supabase spoke, and what it said was that it had failed.
    const { kind } = classifyBody({
      probes: [probe("auth_token_refresh", 500)],
    });
    expect(kind).toBe(SUPABASE_DOWN);
  });

  it("takes one real error over any number of timeouts", () => {
    const { kind } = classifyBody({
      probes: [probe("auth_token_refresh", null, "timeout"), probe("rest_read", 503)],
    });
    expect(kind).toBe(SUPABASE_DOWN);
  });

  it("treats a 4xx as unproven, since it is not an outage", () => {
    // A 429 is rate limiting and a 401 is our own misconfiguration. Neither is
    // fixed by a restart.
    expect(classifyBody({ probes: [probe("rest_read", 429)] }).kind).toBe(
      UNREACHABLE,
    );
  });

  it("treats a body that is not ours as no evidence at all", () => {
    expect(classifyBody(null).kind).toBe(UNREACHABLE);
    expect(classifyBody({}).kind).toBe(UNREACHABLE);
    expect(classifyBody({ probes: [] }).kind).toBe(UNREACHABLE);
  });
});

// The 2026-09-22 restart loop: seven restarts in 2h25m against a database that
// never once errored. The health endpoint's 5s probe timeout sat below this
// project's worst-case PostgREST schema reload (5.4s), so a healthy Supabase
// timed out, came back in `failed`, and read as proof it was down.
describe("restart cooldown", () => {
  const fresh = { sinceCooldown: 0, today: 0 };

  it("stands down while our own last restart is still settling", () => {
    // The cascade, pinned. A restart is ~6 minutes of downtime and runs are 5
    // minutes apart, so without this the next run sees the outage this restart
    // caused and restarts on top of it. That was 02:15, 02:20 and 03:15.
    const { action } = decide({
      kinds: down,
      status: "ACTIVE_HEALTHY",
      armed: true,
      restarts: { sinceCooldown: 1, today: 1 },
    });
    expect(action).toBe("wait");
  });

  it("gives up for the day once restarting has plainly not worked", () => {
    const { action } = decide({
      kinds: down,
      status: "ACTIVE_HEALTHY",
      armed: true,
      restarts: { sinceCooldown: 0, today: 4 },
    });
    expect(action).toBe("abstain");
  });

  it("checks the cooldown before the evidence, so proof cannot override it", () => {
    // Order matters: a served Supabase 5xx is the strongest signal there is,
    // and during our own restart it is exactly what a restarting project
    // produces. The cooldown has to win.
    const { reason } = decide({
      kinds: down,
      status: "ACTIVE_HEALTHY",
      armed: true,
      restarts: { sinceCooldown: 1, today: 1 },
    });
    expect(reason).toContain("settle");
  });

  it("still restarts a genuine outage once the cooldown has passed", () => {
    const { action } = decide({
      kinds: down,
      status: "ACTIVE_HEALTHY",
      armed: true,
      restarts: fresh,
    });
    expect(action).toBe("restart");
  });

  it("does not block itself when run history is unavailable", () => {
    // No GITHUB_TOKEN means we cannot tell. The classifier is the primary
    // guard; the cooldown is defence in depth, so unknown must not mean stuck.
    const { action } = decide({
      kinds: down,
      status: "ACTIVE_HEALTHY",
      armed: true,
      restarts: null,
    });
    expect(action).toBe("restart");
  });
});
