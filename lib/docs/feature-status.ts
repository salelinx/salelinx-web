import { unstable_cache } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import { FEATURE_ENDPOINTS } from '@/lib/admin/feature-endpoints';
import type { Marketplace, StatusState } from './types';

// Public feature status, derived from the same passive telemetry that drives
// /admin/health - but with a DELIBERATELY higher bar to show anything other
// than operational.
//
// The admin view exists to catch a breakage early, so it errs toward flagging.
// This page is a public claim, seen by users mid-problem and implicitly about
// Depop's and Vinted's infrastructure, so it errs toward silence. Concretely:
// a much higher install floor, and a plain rate threshold rather than the
// admin view's deviation-from-baseline (a 3x rise off a 2% baseline is a
// useful internal signal and a meaningless public one).
//
// What this CANNOT tell a user: whether THEIR problem is our problem. The
// outcomes a stuck user actually hits - DataDome blocks, an expired login, no
// marketplace tab open - are classified as session conditions, not endpoint
// failures, and are excluded here on purpose. A public page that turned every
// CAPTCHA wall into "Vinted: degraded" would be wrong most of the time. The
// page pairs this with a self-help section for exactly that reason; see
// Docs.status.selfHelp in messages/.

// Distinct install reports required before a feature can be shown as anything
// but operational. Much higher than the admin floor of 5: a public claim about
// a third party's infrastructure should rest on a wide sample, not on a
// handful of sessions that might share one cause.
const MIN_INSTALLS_PUBLIC = 20;

// Plain failure-rate thresholds. No baseline comparison here - see header.
const DEGRADED_RATE = 25;
const DOWN_RATE = 60;

// Telemetry reports daily, so a 24h window can look empty for a low-traffic
// feature purely by timing. 48h keeps the sample wide enough to be meaningful
// without letting yesterday's resolved incident linger.
const WINDOW_HOURS = 48;

const CACHE_TTL_SECONDS = 60;

export type PublicFeatureStatus = {
  key: string;
  label: string;
  marketplace: Marketplace;
  state: StatusState;
};

type HealthRow = {
  endpoint_key: string;
  platform: string;
  total_calls: number;
  failures: number;
  failure_rate: number | null;
  installs: number;
};

function endpointPart(endpointKey: string): string {
  const colon = endpointKey.indexOf(':');
  return colon === -1 ? endpointKey : endpointKey.slice(colon + 1);
}

function stateFor(
  failures: number,
  totalCalls: number,
  installs: number,
): StatusState {
  // Not enough independent installs to say anything publicly. Reported as
  // operational rather than unknown: with a floor this high, silence genuinely
  // carries no signal, and a public page full of "unknown" badges reads as
  // broken infrastructure when it only means a quiet window.
  if (installs < MIN_INSTALLS_PUBLIC) return 'ok';
  if (totalCalls === 0) return 'ok';

  const rate = (failures / totalCalls) * 100;
  if (rate >= DOWN_RATE) return 'down';
  if (rate >= DEGRADED_RATE) return 'degraded';
  return 'ok';
}

async function loadPublicFeatureStatus(): Promise<PublicFeatureStatus[]> {
  // Cookie-less client: unstable_cache cannot touch cookies(), and this data is
  // not user-scoped. Same pattern as getCachedTierConfigs.
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );

  const { data, error } = await supabase.rpc('public_endpoint_health', {
    p_window_hours: WINDOW_HOURS,
  });

  // Fail soft to all-operational. A status page that 500s, or that flips
  // everything to "down" because our own read failed, is worse than one that
  // briefly under-reports: the failure mode here should never be a false alarm
  // about someone else's platform.
  if (error || !data) {
    return FEATURE_ENDPOINTS.map((f) => ({
      key: f.key,
      label: f.label,
      marketplace: f.platform,
      state: 'ok' as StatusState,
    }));
  }

  const rows = data as HealthRow[];
  const byEndpoint = new Map<string, HealthRow[]>();
  for (const row of rows) {
    // Keyed by platform too: several paths exist on both marketplaces, so
    // matching on the path alone would credit Vinted traffic to a Depop
    // feature.
    const key = `${row.platform}|${endpointPart(row.endpoint_key)}`;
    const existing = byEndpoint.get(key);
    if (existing) existing.push(row);
    else byEndpoint.set(key, [row]);
  }

  return FEATURE_ENDPOINTS.map((feature) => {
    const matched: HealthRow[] = [];
    for (const endpoint of feature.endpoints) {
      const hits = byEndpoint.get(`${feature.platform}|${endpoint}`);
      if (hits) matched.push(...hits);
    }

    const totalCalls = matched.reduce((sum, r) => sum + r.total_calls, 0);
    const failures = matched.reduce((sum, r) => sum + r.failures, 0);
    // Max, not sum: installs is a per-endpoint count, and summing would
    // multiply one user across every endpoint their feature touched.
    const installs = matched.reduce((max, r) => Math.max(max, r.installs), 0);

    return {
      key: feature.key,
      label: feature.label,
      marketplace: feature.platform,
      state: stateFor(failures, totalCalls, installs),
    };
  });
}

// Public traffic, so this is cached rather than hitting Postgres per view.
// 60s matches getCachedTierConfigs; a status page a minute stale is fine, and
// an uncached one is a free way for anyone to generate database load.
export const getPublicFeatureStatus = unstable_cache(
  loadPublicFeatureStatus,
  ['public-feature-status'],
  { revalidate: CACHE_TTL_SECONDS },
);
