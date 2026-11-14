import { compareVersions } from "@/lib/admin/version";

// One row from admin_action_health (051_action_health.sql).
export type ActionHealthRaw = {
  action: string;
  platform: string;
  extension_version: string;
  ok: number;
  failed: number;
  empty: number;
  top_code: string | null;
  last_seen: string;
};

export type ActionHealthRow = {
  action: string;
  platform: string;
  version: string;
  uses: number;
  failedRate: number;
  emptyRate: number;
  prevVersion: string | null;
  prevFailedRate: number | null;
  prevEmptyRate: number | null;
  topCode: string | null;
  regressed: boolean;
};

// Below this many uses a version's rate is one user's bad day, not a release.
const MIN_USES = 10;
const pct = (n: number, of: number) => (of ? (100 * n) / of : 0);

const worse = (now: number, before: number | null) =>
  before !== null && now >= before + 10 && now >= before * 2;

export function rollUpActions(raw: ActionHealthRaw[]): ActionHealthRow[] {
  const groups = new Map<string, ActionHealthRaw[]>();
  for (const r of raw) {
    const key = `${r.action}|${r.platform}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  const rows = [...groups.values()].map((versions) => {
    const [now, prev] = versions.sort((a, b) =>
      compareVersions(b.extension_version, a.extension_version),
    );
    const uses = Number(now.ok) + Number(now.failed) + Number(now.empty);
    const prevUses = prev
      ? Number(prev.ok) + Number(prev.failed) + Number(prev.empty)
      : 0;
    const prevOk = prevUses >= MIN_USES;
    const failedRate = pct(Number(now.failed), uses);
    const emptyRate = pct(Number(now.empty), uses);
    const prevFailedRate = prevOk ? pct(Number(prev.failed), prevUses) : null;
    const prevEmptyRate = prevOk ? pct(Number(prev.empty), prevUses) : null;
    return {
      action: now.action,
      platform: now.platform,
      version: now.extension_version,
      uses,
      failedRate,
      emptyRate,
      prevVersion: prev?.extension_version ?? null,
      prevFailedRate,
      prevEmptyRate,
      topCode: now.top_code,
      regressed:
        uses >= MIN_USES &&
        (worse(failedRate, prevFailedRate) || worse(emptyRate, prevEmptyRate)),
    };
  });
  return rows.sort(
    (a, b) =>
      Number(b.regressed) - Number(a.regressed) ||
      b.failedRate - a.failedRate ||
      b.uses - a.uses,
  );
}
