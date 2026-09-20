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
