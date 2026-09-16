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
 * TWO INDEPENDENT SIGNALS, AND BOTH MUST AGREE
 *   1. our own probe  — /api/health/supabase, which reaches through to
 *      Postgres via both auth and PostgREST (see docs/OVERVIEW.md)
 *   2. Supabase's own — GET /v1/projects/{ref}, the platform's view
 *
 * If the probe fails but Supabase reports ACTIVE_HEALTHY, the fault is far
 * more likely to be Vercel, DNS or this runner's network than the database —
 * restarting on that alone would mean causing an outage because we could not
 * reach a webpage. That case reports and exits without acting.
 */

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

/** One health probe. 200 is healthy; 503 is Supabase not serving; 500 means
 *  the endpoint itself is misconfigured, which is our bug and not grounds for
 *  a restart. Anything unreachable counts as a failure but, on its own, only
 *  as evidence about the probe path. */
async function probe() {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
  try {
    const res = await fetch(HEALTH_URL, {
      signal: ctrl.signal,
      cache: 'no-store',
      headers: HEALTH_TOKEN ? { 'x-health-token': HEALTH_TOKEN } : {},
    });
    let detail = '';
    try {
      const body = await res.json();
      if (Array.isArray(body?.failed) && body.failed.length) detail = ` failed=${body.failed.join(',')}`;
    } catch {
      /* body is not JSON — the status is enough */
    }
    return { ok: res.status === 200, status: res.status, misconfigured: res.status === 500, detail };
  } catch (err) {
    return { ok: false, status: null, misconfigured: false, detail: ` ${err.name}` };
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

async function main() {
  requireEnv();
  log(`watchdog: project ${REF}, armed=${ARMED}`);

  for (let i = 1; i <= PROBES; i++) {
    const r = await probe();
    log(`  probe ${i}/${PROBES}: ${r.ok ? 'OK' : 'FAIL'} status=${r.status ?? 'none'}${r.detail}`);
    if (r.ok) {
      log('healthy — nothing to do');
      return;
    }
    if (r.misconfigured) {
      // Our endpoint, our bug. Restarting Supabase would not fix it and would
      // take the service down for no reason.
      console.error('health endpoint reports 500 (misconfigured) — not a Supabase fault, not restarting');
      process.exit(1);
    }
    if (i < PROBES) await sleep(PROBE_GAP_MS);
  }

  log(`all ${PROBES} probes failed — asking Supabase for its own view`);
  const status = await projectStatus();
  log(`  platform status: ${status}`);

  if (status === 'ACTIVE_HEALTHY') {
    // The two signals disagree. Ours is the one more likely to be wrong.
    console.error('probe is failing but Supabase reports ACTIVE_HEALTHY — suspect Vercel/DNS/network, not restarting');
    process.exit(1);
  }
  if (TRANSITIONAL.has(status)) {
    log('platform is already mid-transition — leaving it alone');
    return;
  }
  if (DO_NOT_TOUCH.has(status)) {
    console.error(`status ${status} is not something a restart fixes — not restarting`);
    process.exit(1);
  }

  if (!ARMED) {
    console.error(`WOULD RESTART (status ${status}) — set WATCHDOG_ENABLED=true to arm`);
    process.exit(1);
  }

  log('restarting project');
  const r = await restart();
  if (r.rateLimited) {
    log('restart rate-limited (429) — one was requested recently, letting it run');
    return;
  }
  log('restart requested');
  // Fail the run so it is visibly red: a restart means there WAS an outage,
  // and that is worth a notification even though it was handled.
  process.exit(1);
}

main().catch((err) => {
  console.error(`watchdog error: ${err.message}`);
  process.exit(1);
});
