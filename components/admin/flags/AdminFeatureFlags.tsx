"use client";

// Keys-by-tiers toggle grid over tier_limits.features. Clicking a cell arms a
// confirm bar (enable/disable X for tier Y); confirming calls the
// admin_set_tier_feature() RPC (migration 030), which re-checks is_admin(),
// only touches active rows, refuses unknown keys, and writes the audit entry
// server-side. Feature semantics: true = enabled, false OR absent = disabled,
// so an absent key renders as a disabled toggle, not a dash.
//
// Not gated behind step-up reauth: toggles are reversible (the audit log
// records the old value) and reauth stays reserved for destructive/
// irreversible actions per docs/ADMIN.md.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";
import type { TierConfig } from "@/lib/types/tiers";
import { collectKeys, tierKey } from "@/lib/admin/tiers";

type Props = {
  tiers: TierConfig[];
};

type Pending = {
  tier: TierConfig;
  key: string;
  enable: boolean;
};

export function AdminFeatureFlags({ tiers }: Props) {
  const router = useRouter();
  const supabase = createBrowserClient();

  const keys = collectKeys(tiers, "features");
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function arm(tier: TierConfig, key: string, enable: boolean) {
    setPending({ tier, key, enable });
    setError(null);
    setNotice(null);
  }

  async function confirm() {
    if (!pending || busy) return;
    setBusy(true);
    setError(null);
    const { error: rpcErr } = await supabase.rpc("admin_set_tier_feature", {
      p_tier_id: pending.tier.tier_id,
      p_version: pending.tier.version,
      p_key: pending.key,
      p_enabled: pending.enable,
    });
    setBusy(false);
    if (rpcErr) {
      setError(`Update failed: ${rpcErr.message}`);
      return;
    }
    setNotice(
      `${pending.key} ${pending.enable ? "enabled" : "disabled"} for ${
        pending.tier.tier_id
      } v${pending.tier.version}.`,
    );
    setPending(null);
    router.refresh();
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-12 shrink-0 items-center justify-between gap-4 border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-4">
        <h1 className="text-sm font-semibold">
          Feature flags
          <span className="ml-2 font-normal text-zinc-400">
            boolean gates, active versions
          </span>
        </h1>
        <p className="text-xs text-zinc-500">
          Click a toggle, then confirm. Changes go live within the cache TTLs.
        </p>
      </header>

      {pending && (
        <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-[var(--admin-border)] bg-amber-50 px-4 py-2 text-xs">
          <span>
            {pending.enable ? "Enable" : "Disable"}{" "}
            <span className="font-mono font-medium">{pending.key}</span> for{" "}
            <span className="font-medium capitalize">
              {pending.tier.tier_id}
            </span>{" "}
            v{pending.tier.version}?
          </span>
          <button
            type="button"
            onClick={() => void confirm()}
            disabled={busy}
            className="rounded bg-zinc-900 px-3 py-1 font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
          >
            {busy ? "Saving..." : "Confirm"}
          </button>
          <button
            type="button"
            onClick={() => setPending(null)}
            disabled={busy}
            className="rounded px-2 py-1 text-zinc-600 hover:bg-zinc-100"
          >
            Cancel
          </button>
          {error && <span className="text-red-600">{error}</span>}
        </div>
      )}

      {!pending && (error || notice) && (
        <div
          className={
            "shrink-0 border-b border-[var(--admin-border)] px-4 py-2 text-xs " +
            (error ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700")
          }
        >
          {error ?? notice}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto">
        {tiers.length === 0 ? (
          <p className="px-4 py-8 text-sm text-zinc-500">
            No active tier rows found.
          </p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-[var(--admin-surface)] text-left text-xs text-zinc-500">
              <tr className="border-b border-[var(--admin-border)]">
                <th className="px-3 py-2 font-medium">Feature key</th>
                {tiers.map((t) => (
                  <th
                    key={tierKey(t)}
                    className="px-3 py-2 font-medium capitalize"
                  >
                    {t.tier_id}
                    <span className="ml-1 font-normal normal-case text-zinc-400">
                      v{t.version}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {keys.map((key) => (
                <tr
                  key={key}
                  className="border-b border-[var(--admin-border)] hover:bg-zinc-50"
                >
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-zinc-700">
                    {key}
                  </td>
                  {tiers.map((t) => {
                    const enabled = t.features[key] === true;
                    const isPending =
                      pending?.key === key &&
                      tierKey(pending.tier) === tierKey(t);
                    return (
                      <td key={tierKey(t)} className="px-1 py-1">
                        <button
                          type="button"
                          onClick={() => arm(t, key, !enabled)}
                          title={
                            enabled
                              ? "Enabled. Click to disable."
                              : "Disabled. Click to enable."
                          }
                          className={
                            "w-full rounded px-2 py-1 text-left text-xs font-medium " +
                            (isPending
                              ? "bg-amber-100 text-amber-900"
                              : enabled
                                ? "text-emerald-700 hover:bg-zinc-100"
                                : "text-zinc-400 hover:bg-zinc-100")
                          }
                        >
                          {enabled ? "✓ on" : "off"}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
