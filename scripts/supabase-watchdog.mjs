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
 * What actually separates "Supabase is down" from "we could not reach it" is
 * not the platform's opinion, it is whether SUPABASE ITSELF ANSWERED WITH AN
 * ERROR. An earlier version stopped one step short of that and asked only
 * whether OUR endpoint answered - any served JSON 503 counted as proof. That
 * is what caused 2026-09-22: the health endpoint's own 5s probe timeout was
 * below this project's worst-case PostgREST schema reload (5.4s), so a healthy
 * database timed out, came back in `failed`, and read as positive proof it was
 * down. Seven restarts in 2h25m, none of which fixed anything, three of them
 * cascades where the run probed into downtime its predecessor had caused.
 *
 * A timeout is not evidence. Neither is a Cloudflare 52x, which by definition
 * means the edge could not reach the origin - during our own restart that is
 * the expected reading, and treating it as proof is what closed the loop. So
 * the question is narrower now:
 *
 *   a failed probe carrying a Supabase-origin 5xx -> proof, restart
 *   timeouts, network errors, Cloudflare 52x      -> ambiguous, and here
 *                                                    ACTIVE_HEALTHY still gets
 *                                                    the final say
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
/** Must stay above the health endpoint's own per-probe timeout, or we abort
 *  the very request that was about to tell us what it found. */
const PROBE_TIMEOUT_MS = 20_000;

/** Cloudflare's own origin-reachability codes. They are emitted by the edge,
 *  not by Supabase, so they say "could not reach it", never "it failed" - and
 *  a restart in progress produces them reliably. */
const CLOUDFLARE_ORIGIN_CODES = new Set([520, 521, 522, 523, 524, 525, 526]);

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

/**
 * What a served health-check body actually proves. Pure, and the single most
 * load-bearing function here: getting this wrong restarts production.
 *
 * The endpoint reports every failed probe the same way in `failed`, but the
 * `probes` array it also returns carries the distinction that matters. A
 * `status` of null is a timeout or a network error - our side gave up, which
 * says nothing about Supabase. A 52x came from Cloudflare and means the edge
 * could not reach the origin, which is also what our own restart looks like.
 * Only a 5xx that Supabase itself generated is proof that Supabase failed.
 */
export function classifyBody(body) {
  const failed = Array.isArray(body?.probes)
    ? body.probes.filter((p) => p && p.ok === false)
    : null;
  if (!failed || !failed.length) {
    return { kind: UNREACHABLE, detail: ' no health body' };
  }
  const proving = failed.filter(
    (p) =>
      typeof p.status === 'number' &&
      p.status >= 500 &&
      !CLOUDFLARE_ORIGIN_CODES.has(p.status),
  );
  const summary = failed.map((p) => `${p.name}=${p.status ?? p.detail ?? 'no-response'}`).join(',');
  return proving.length
    ? { kind: SUPABASE_DOWN, detail: ` ${summary}` }
    : { kind: UNREACHABLE, detail: ` ${summary} (no Supabase-origin error)` };
}

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
    let body = null;
    try {
      body = await res.json();
    } catch {
      /* not JSON, so not from our handler */
    }
    const verdict = classifyBody(body);
    return { kind: verdict.kind, status: res.status, detail: verdict.detail };
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

/** Long enough to cover a restart plus its recovery (measured at 5m41s) with
 *  room to spare, so the run after a restart can never mistake that restart's
 *  own downtime for a fresh outage. Caps us at two restarts an hour. */
const RESTART_COOLDOWN_MS = 30 * 60 * 1000;
/** Nothing legitimate needs more than this. If a restart has not fixed it in
 *  four tries, another will not either, and a human should look. */
const MAX_RESTARTS_PER_DAY = 4;

/**
 * Our own recent restarts, read back off this workflow's run history. Needs
 * no new secret: GITHUB_TOKEN is injected into every Actions run.
 *
 * ponytail: a `failure` conclusion is the marker, which is why the abstain
 * path below exits 0 - otherwise standing down would look like acting and
 * suppress the next real restart. Only a restart and a genuine misconfig fail
 * the run now, and both are states where restarting again is wrong anyway. If
 * that ever stops being true, write an explicit marker instead of inferring
 * one from the conclusion.
 */
async function recentRestarts() {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  if (!token || !repo) return null; // not in Actions, or misconfigured
  // Filter to failures server-side. Asking for completed runs instead caps the
  // lookback at however many runs fit in per_page, which at a 5 minute cadence
  // is about five hours - the 24h cap below could never have seen 24 hours.
  const res = await fetch(
    `https://api.github.com/repos/${repo}/actions/workflows/supabase-watchdog.yml/runs` +
      `?status=failure&per_page=60`,
    { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' } },
  );
  if (!res.ok) return null;
  const now = Date.now();
  const mine = process.env.GITHUB_RUN_ID;
  const failures = ((await res.json()).workflow_runs ?? []).filter(
    (r) => r.conclusion === 'failure' && String(r.id) !== mine,
  );
  return {
    sinceCooldown: failures.filter((r) => now - Date.parse(r.created_at) < RESTART_COOLDOWN_MS)
      .length,
    today: failures.filter((r) => now - Date.parse(r.created_at) < 24 * 60 * 60 * 1000).length,
  };
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
export function decide({ kinds, status, armed, restarts }) {
  if (TRANSITIONAL.has(status)) {
    return { action: 'wait', reason: `platform is already mid-transition (${status}), leaving it alone` };
  }
  if (DO_NOT_TOUCH.has(status)) {
    return { action: 'abstain', reason: `status ${status} is not something a restart fixes` };
  }

  // Our own restarts, before anything else. A restart is ~6 minutes of
  // downtime and runs are 5 minutes apart, so without this the run after a
  // restart reads that restart's own outage as a fresh one. That cascade is
  // three of the seven restarts on 2026-09-22.
  if (restarts && restarts.sinceCooldown > 0) {
    return {
      action: 'wait',
      reason: `we restarted within the last ${RESTART_COOLDOWN_MS / 60000}m, letting it settle`,
    };
  }
  if (restarts && restarts.today >= MAX_RESTARTS_PER_DAY) {
    return {
      action: 'abstain',
      reason: `${restarts.today} restarts in 24h already, a restart is not fixing this`,
    };
  }

  // Proof means Supabase itself answered with an error. A timeout or a
  // Cloudflare 52x is not proof, and treating it as such is what caused
  // 2026-09-22 - see the file header.
  const proven = kinds.includes(SUPABASE_DOWN);
  if (!proven && status === 'ACTIVE_HEALTHY') {
    return {
      action: 'abstain',
      reason: 'no probe saw a Supabase-origin error and the platform reports ACTIVE_HEALTHY, suspect a slow reload, Vercel, DNS or the network',
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

  const restarts = await recentRestarts();
  log(
    restarts
      ? `  our restarts: ${restarts.sinceCooldown} in cooldown, ${restarts.today} in 24h`
      : '  our restarts: unknown (no GITHUB_TOKEN), cooldown not enforced',
  );

  const { action, reason } = decide({ kinds, status, armed: ARMED, restarts });
  if (action === 'wait') {
    log(reason);
    return;
  }
  if (action === 'abstain') {
    // Exit 0 deliberately: standing down is the correct outcome, not an
    // incident, and recentRestarts() reads a failed run as "we restarted".
    // Failing here would suppress the next real restart for 30 minutes.
    // Telling a human is UptimeRobot's job, not this workflow's.
    console.error(`${reason}, not restarting`);
    return;
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
