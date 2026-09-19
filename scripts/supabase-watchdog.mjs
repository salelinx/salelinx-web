#!/usr/bin/env node
/**
 * Restart the Supabase project when it is genuinely down, and only then.
 *
 * Background: 2026-09-06 the project was unusable for 5h18m and needed a
 * manual restart — the database recovering was never the hard part, noticing
 * was. 2026-09-16 it went again for ~14 minutes and the platform restarted it
 * on its own. This closes the gap where nobody is watching.
 *
 * A restart is itself an outage: every connection drops and the project is
 * unreachable for a minute or so. So the bar for pulling the lever is
 * deliberately high, and the checks below exist to keep it there.
 *
 * WHY IT DOES NOT RUN ON SUPABASE
 * The same reason the health endpoint does not: a watchdog cannot live on the
 * thing it watches. This runs in GitHub Actions, which shares no
 * infrastructure with either Supabase or Vercel.
 *
 * TWO SIGNALS, AND WHAT EACH IS WORTH
 *   1. our own probe  - /api/health/supabase, which reaches through to
 *      Postgres via both auth and PostgREST (see docs/OVERVIEW.md)
 *   2. Supabase's own - GET /v1/projects/{ref}, the platform's view
 *
 * These are NOT equal, and the first version of this script treated them as if
 * they were: it stood down whenever the platform said ACTIVE_HEALTHY, on the
 * theory that our probe was the likelier of the two to be wrong. That rule can
 * essentially never fire correctly, because ACTIVE_HEALTHY is a lifecycle
 * state (the project is provisioned and not paused), not a serving one. It
 * stayed green for the whole 5h18m on 2026-09-06, and it was green again on
 * 2026-09-17 19:14 UTC when this script probed three times, got
 * "failed=auth_token_refresh,rest_read" each time, and refused to act. The
 * veto was armed against precisely the outage the watchdog exists for.
 *
 * What actually separates "Supabase is down" from "we could not reach a
 * webpage" is not the platform's opinion, it is whether our own endpoint
 * ANSWERED. A parsed JSON 503 naming the failed probes proves Vercel ran the
 * handler and made both outbound calls: Vercel is up, Supabase is not. A
 * timeout, a DNS failure or an HTML error page from the edge proves nothing
 * either way. So:
 *
 *   any served JSON 503     -> restart, whatever the platform says
 *   only unreachable probes -> ambiguous, and here ACTIVE_HEALTHY does still
 *                              get the final say
 *
 * The corollary is that a Vercel outage disables the restart path completely.
 * That is correct, not a gap: with the endpoint dark we have no evidence about
 * Supabase either way, and a restart is itself an outage.
 */

import { pathToFileURL } from 'node:url';

const REF = process.env.SUPABASE_PROJECT_REF;
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const HEALTH_URL = process.env.HEALTH_URL;
const HEALTH_TOKEN = process.env.HEALTH_CHECK_TOKEN; // optional
/** Anything but 'true' observes and reports without restarting. Default off so
 *  merging this cannot restart production on its own. */
const ARMED = process.env.WATCHDOG_ENABLED === 'true';

/** Probes per run, and the gap between them. A single failed probe is a blip;
 *  three spread over a minute is an outage. Kept inside one run so the
 *  decision needs no state carried between scheduled runs. */
const PROBES = 3;
/** Overridable only so the decision paths can be exercised in seconds rather
 *  than a minute; the workflow never sets it. */
const PROBE_GAP_MS = Number(process.env.PROBE_GAP_MS ?? 20_000);
const PROBE_TIMEOUT_MS = 10_000;

/** Statuses where the platform is already doing something. Restarting on top
 *  of one of these would either be ignored or interrupt a recovery that is
 *  already underway. */
const TRANSITIONAL = new Set([
  'COMING_UP',
  'GOING_DOWN',
  'RESTARTING',
  'PAUSING',
  'RESTORING',
  'UPGRADING',
  'RESIZING',
]);

/** Deliberately stopped, or broken in a way a restart does not address.
 *  Restarting a paused project would silently un-pause it and start billing. */
const DO_NOT_TOUCH = new Set(['INACTIVE', 'REMOVED', 'INIT_FAILED', 'RESTORE_FAILED', 'PAUSE_FAILED']);

/** Overridable so the restart path can be tested against a stub instead of
 *  the real project. The workflow never sets it. */
const API = process.env.SUPABASE_API_BASE ?? 'https://api.supabase.com';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(...a);

function requireEnv() {
  const missing = ['SUPABASE_PROJECT_REF', 'SUPABASE_ACCESS_TOKEN', 'HEALTH_URL'].filter(
    (k) => !process.env[k],
  );
  if (missing.length) {
    console.error(`Missing required env: ${missing.join(', ')}`);
    process.exit(78); // config error, not a service failure
  }
}

/**
 * What one probe established. The load-bearing distinction is between
 * SUPABASE_DOWN and UNREACHABLE: both are "the probe failed", but only the
 * first is evidence about Supabase. Collapsing them into a single `ok: false`
 * is what made the old decision rule unable to tell an outage from a bad
 * network hop, and so made it defer to the platform status every time.
 */
export const HEALTHY = 'healthy';
/** Our endpoint answered, in its own JSON, that Supabase is not serving.
 *  Positive proof: the handler ran, so Vercel is up and the fault is beyond
 *  it. A network blip cannot manufacture this. */
export const SUPABASE_DOWN = 'supabase_down';
/** Our endpoint answered 500: it is missing env vars. Our bug, and a restart
 *  does not fix it. */
export const MISCONFIGURED = 'misconfigured';
/** No answer, or one that did not come from our handler (timeout, DNS, an
 *  edge HTML error page). Says nothing about Supabase on its own. */
export const UNREACHABLE = 'unreachable';

/** One health probe. Returns the kind of evidence it produced, not just
 *  pass/fail. */
async function probe() {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
  try {
    const res = await fetch(HEALTH_URL, {
      signal: ctrl.signal,
      cache: 'no-store',
      headers: HEALTH_TOKEN ? { 'x-health-token': HEALTH_TOKEN } : {},
    });
    if (res.status === 200) return { kind: HEALTHY, status: 200, detail: '' };
    if (res.status === 500) return { kind: MISCONFIGURED, status: 500, detail: '' };

    // A 503 only counts as Supabase evidence if it carries OUR body. A 503
    // from Vercel's edge, or any other page in front of the app, is an HTML
    // error and tells us nothing about the database.
    let failed = null;
    try {
      const body = await res.json();
      if (Array.isArray(body?.failed) && body.failed.length) failed = body.failed;
    } catch {
      /* not JSON, so not from our handler */
    }
    return failed
      ? { kind: SUPABASE_DOWN, status: res.status, detail: ` failed=${failed.join(',')}` }
      : { kind: UNREACHABLE, status: res.status, detail: ' no health body' };
  } catch (err) {
    return { kind: UNREACHABLE, status: null, detail: ` ${err.name}` };
  } finally {
    clearTimeout(timer);
  }
}

async function projectStatus() {
  const res = await fetch(`${API}/v1/projects/${REF}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!res.ok) throw new Error(`project status ${res.status}`);
  return (await res.json()).status;
}

async function restart() {
  const res = await fetch(`${API}/v1/projects/${REF}/restart`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  // 429 is the platform's own rate limit — it has been asked recently enough,
  // which means a restart is already in flight. Not an error worth failing on.
  if (res.status === 429) return { ok: false, rateLimited: true };
  if (!res.ok) throw new Error(`restart ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return { ok: true, rateLimited: false };
}

/**
 * The whole decision, pure so it can be exercised without a network. `kinds`
 * are the probe outcomes from a run in which every probe failed.
 *
 * Order matters here. The platform state is consulted first for reasons to
 * STAY OUT (already restarting, deliberately paused), because those hold
 * regardless of how certain we are. Only after that is it allowed to argue
 * about whether the outage is real, and only when our own evidence is
 * inconclusive.
 */
export function decide({ kinds, status, armed }) {
  if (TRANSITIONAL.has(status)) {
    return { action: 'wait', reason: `platform is already mid-transition (${status}), leaving it alone` };
  }
  if (DO_NOT_TOUCH.has(status)) {
    return { action: 'abstain', reason: `status ${status} is not something a restart fixes` };
  }

  // One served 503 settles it. The platform has no more useful opinion to add,
  // and waiting for it to agree is what cost us 2026-09-17.
  const proven = kinds.includes(SUPABASE_DOWN);
  if (!proven && status === 'ACTIVE_HEALTHY') {
    return {
      action: 'abstain',
      reason: 'no probe reached our health endpoint and Supabase reports ACTIVE_HEALTHY, suspect Vercel/DNS/network',
    };
  }
  if (!armed) {
    return { action: 'abstain', reason: `WOULD RESTART (status ${status}), set WATCHDOG_ENABLED=true to arm` };
  }
  return { action: 'restart', reason: `Supabase not serving (platform status ${status})` };
}

async function main() {
  requireEnv();
  log(`watchdog: project ${REF}, armed=${ARMED}`);

  const kinds = [];
  for (let i = 1; i <= PROBES; i++) {
    const r = await probe();
    log(`  probe ${i}/${PROBES}: ${r.kind} status=${r.status ?? 'none'}${r.detail}`);
    if (r.kind === HEALTHY) {
      log('healthy, nothing to do');
      return;
    }
    if (r.kind === MISCONFIGURED) {
      // Our endpoint, our bug. Restarting Supabase would not fix it and would
      // take the service down for no reason.
      console.error('health endpoint reports 500 (misconfigured), not a Supabase fault, not restarting');
      process.exit(1);
    }
    kinds.push(r.kind);
    if (i < PROBES) await sleep(PROBE_GAP_MS);
  }

  log(`all ${PROBES} probes failed, asking Supabase for its own view`);
  const status = await projectStatus();
  log(`  platform status: ${status}`);

  const { action, reason } = decide({ kinds, status, armed: ARMED });
  if (action === 'wait') {
    log(reason);
    return;
  }
  if (action === 'abstain') {
    console.error(`${reason}, not restarting`);
    process.exit(1);
  }

  log(`restarting project: ${reason}`);
  const r = await restart();
  if (r.rateLimited) {
    log('restart rate-limited (429), one was requested recently, letting it run');
    return;
  }
  log('restart requested');
  // Fail the run so it is visibly red: a restart means there WAS an outage,
  // and that is worth a notification even though it was handled.
  process.exit(1);
}

// Importable for tests; only actually watches when run as a script.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(`watchdog error: ${err.message}`);
    process.exit(1);
  });
}
