"use client";

// Editable keys-by-tiers grid over tier_limits.limits. Click a cell to open
// the edit bar, type a new cap (or mark it unlimited), review the old -> new
// diff, save. The mutation is the admin_set_tier_limit() RPC (006_admin_console.sql):
// it re-checks is_admin(), only touches active rows, refuses unknown keys, and
// writes the audit entry server-side. A cell showing "-" means the key is
// absent on that tier (not applicable) and is intentionally not editable;
// introducing a new limit key is a deliberate SQL-editor operation.
//
// Not gated behind step-up reauth: edits are reversible (the audit log records
// the old value) and reauth stays reserved for destructive/irreversible
// actions per docs/ADMIN.md.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";
import type { TierConfig } from "@/lib/types/tiers";
import { collectKeys, tierKey } from "@/lib/admin/tiers";

type Props = {
  tiers: TierConfig[];
};

type Selected = {
  tier: TierConfig;
  key: string;
  current: number | null;
};

export function AdminTierLimits({ tiers }: Props) {
  const router = useRouter();
  const supabase = createBrowserClient();

  const keys = collectKeys(tiers, "limits");
  const [selected, setSelected] = useState<Selected | null>(null);
  const [value, setValue] = useState("");
  const [unlimited, setUnlimited] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function select(tier: TierConfig, key: string, current: number | null) {
    setSelected({ tier, key, current });
    setValue(current === null ? "" : String(current));
    setUnlimited(current === null);
    setError(null);
    setNotice(null);
  }

  function cancel() {
    setSelected(null);
    setError(null);
  }

  async function save() {
    if (!selected || busy) return;

    let next: number | null = null;
    if (!unlimited) {
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed < 0 || !Number.isInteger(parsed)) {
        setError("Enter a non-negative whole number, or mark it unlimited.");
        return;
      }
      next = parsed;
    }
    if (next === selected.current) {
      setError("No change: that is already the current value.");
      return;
    }

    setBusy(true);
    setError(null);
    const { error: rpcErr } = await supabase.rpc("admin_set_tier_limit", {
      p_tier_id: selected.tier.tier_id,
      p_version: selected.tier.version,
      p_key: selected.key,
      p_value: next,
    });
    setBusy(false);
    if (rpcErr) {
      setError(`Update failed: ${rpcErr.message}`);
      return;
    }
    setNotice(
      `${selected.key} for ${selected.tier.tier_id} v${selected.tier.version} set to ${
        next === null ? "unlimited" : next
      }.`,
    );
    setSelected(null);
    router.refresh();
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-12 shrink-0 items-center justify-between gap-4 border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-4">
        <h1 className="text-sm font-semibold">
          Tier limits
          <span className="ml-2 font-normal text-zinc-400">
            numeric caps, active versions
          </span>
        </h1>
        <p className="text-xs text-zinc-500">
          Click a value to edit. Changes go live within the cache TTLs.
        </p>
      </header>

      {selected && (
        <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-[var(--admin-border)] bg-amber-50 px-4 py-2 text-xs">
          <span>
            Editing{" "}
            <span className="font-mono font-medium">{selected.key}</span> for{" "}
            <span className="font-medium capitalize">
              {selected.tier.tier_id}
            </span>{" "}
            v{selected.tier.version} (currently{" "}
            <span className="font-mono">
              {selected.current === null ? "unlimited" : selected.current}
            </span>
            )
          </span>
          <input
            type="number"
            min={0}
            step={1}
            value={value}
            disabled={unlimited || busy}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void save();
              if (e.key === "Escape") cancel();
            }}
            autoFocus
            className="w-28 rounded-md border border-[var(--admin-border)] bg-white px-2 py-1 font-mono outline-none focus:border-zinc-400 disabled:bg-zinc-100 disabled:text-zinc-400"
          />
          <label className="flex cursor-pointer items-center gap-1.5">
            <input
              type="checkbox"
              checked={unlimited}
              disabled={busy}
              onChange={(e) => setUnlimited(e.target.checked)}
            />
            Unlimited
          </label>
          <button
            type="button"
            onClick={() => void save()}
            disabled={busy}
            className="rounded bg-zinc-900 px-3 py-1 font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
          >
            {busy ? "Saving..." : "Save"}
          </button>
          <button
            type="button"
            onClick={cancel}
            disabled={busy}
            className="rounded px-2 py-1 text-zinc-600 hover:bg-zinc-100"
          >
            Cancel
          </button>
          {error && <span className="text-red-600">{error}</span>}
        </div>
      )}

      {!selected && (error || notice) && (
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
                <th className="px-3 py-2 font-medium">Limit key</th>
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
                    const applicable = key in t.limits;
                    const current = applicable ? (t.limits[key] ?? null) : null;
                    const isSelected =
                      selected?.key === key &&
                      tierKey(selected.tier) === tierKey(t);
                    if (!applicable) {
                      return (
                        <td
                          key={tierKey(t)}
                          className="px-3 py-2 text-zinc-300"
                          title="Not applicable for this tier (key absent)"
                        >
                          -
                        </td>
                      );
                    }
                    return (
                      <td key={tierKey(t)} className="px-1 py-1">
                        <button
                          type="button"
                          onClick={() => select(t, key, current)}
                          className={
                            "w-full rounded px-2 py-1 text-left font-mono tabular-nums " +
                            (isSelected
                              ? "bg-zinc-900 text-white"
                              : current === null
                                ? "text-zinc-400 hover:bg-zinc-100"
                                : "text-zinc-800 hover:bg-zinc-100")
                          }
                        >
                          {current === null
                            ? "unlimited"
                            : current.toLocaleString("en-US")}
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
