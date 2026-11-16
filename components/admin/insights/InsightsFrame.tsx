"use client";

// The shell of every page under Stats: title, the period and platform
// switches (shared across the section, see prefs.ts), when the platforms last
// synced, and a note when the period reaches back before daily tracking began,
// so a short history is never mistaken for a bad month.

import type { ReactNode } from "react";
import Link from "next/link";
import { PlatformLogo } from "@/components/admin/marketing/PlatformLogo";
import { coverage, PERIODS, periodWindow, shortDay } from "@/lib/social/insights";
import type { InsightsLoad } from "@/lib/social/load";
import { PLATFORM_NAMES, SOCIAL_PLATFORMS } from "@/lib/social/types";
import { daysBefore } from "@/lib/admin/marketing";
import { useInsightsPrefs } from "./prefs";
import { chipClass } from "./ui";

function ago(nowMs: number, iso: string): string {
  const mins = Math.max(0, Math.round((nowMs - Date.parse(iso)) / 60000));
  if (mins < 60) return `${mins}m ago`;
  if (mins < 48 * 60) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
}

export function InsightsFrame({
  title,
  load,
  period = true,
  platform = true,
  controls,
  children,
}: {
  title: string;
  load: InsightsLoad;
  // Whether this page reads the period and platform switches.
  period?: boolean;
  platform?: boolean;
  controls?: ReactNode;
  children: ReactNode;
}) {
  const [prefs, setPrefs] = useInsightsPrefs();
  const { data, accounts, error } = load;

  const synced = accounts
    .map((a) => a.synced_at)
    .filter((s): s is string => !!s)
    .sort()
    .pop();
  const failing = accounts.filter((a) => a.last_error).map((a) => PLATFORM_NAMES[a.platform]);

  const now = periodWindow(data.today, prefs.period);
  const before = periodWindow(data.today, prefs.period, 1);
  const covNow = coverage(data, now);
  const covBefore = coverage(data, before);
  const note =
    period && data.measuredFrom && (covNow !== "full" || covBefore !== "full")
      ? `Daily tracking began ${shortDay(daysBefore(data.measuredFrom, 1))}, so ${
          covNow === "full" ? "" : `this period counts from ${shortDay(data.measuredFrom)} and `
        }the ${prefs.period} days before it ${covBefore === "none" ? "have no figures yet" : "are only partly covered"}.`
      : null;

  return (
    <div className="flex h-full flex-col">
      <header className="flex min-h-12 shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-2">
        <h1 className="text-sm font-semibold">{title}</h1>
        {synced && (
          <span className="text-xs text-zinc-400" title={new Date(synced).toUTCString()}>
            Synced {ago(data.nowMs, synced)}
          </span>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-2">
          {controls}
          {platform && (
            <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Platform">
              <button
                type="button"
                aria-pressed={prefs.platform === "all"}
                onClick={() => setPrefs({ platform: "all" })}
                className={chipClass(prefs.platform === "all")}
              >
                All
              </button>
              {SOCIAL_PLATFORMS.map((p) => (
                <button
                  key={p}
                  type="button"
                  aria-pressed={prefs.platform === p}
                  aria-label={PLATFORM_NAMES[p]}
                  title={PLATFORM_NAMES[p]}
                  onClick={() => setPrefs({ platform: p })}
                  className={chipClass(prefs.platform === p)}
                >
                  <PlatformLogo platform={p} size={14} />
                  <span className="hidden lg:inline">{PLATFORM_NAMES[p]}</span>
                </button>
              ))}
            </div>
          )}
          {period && (
            <div className="flex items-center gap-1" role="group" aria-label="Period">
              {PERIODS.map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={prefs.period === d}
                  onClick={() => setPrefs({ period: d })}
                  className={chipClass(prefs.period === d)}
                >
                  {d}d
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="mx-auto max-w-7xl space-y-3 p-4">
          {error && (
            <p className="rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2 text-sm text-zinc-700">
              Couldn&apos;t load everything: {error}
            </p>
          )}
          {failing.length > 0 && (
            <p className="rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2 text-xs text-zinc-600">
              The last sync failed for {failing.join(", ")}, so its newest figures may be missing.{" "}
              <Link href="/admin/marketing" className="text-zinc-900 underline">
                See Stats
              </Link>
            </p>
          )}
          {note && <p className="text-xs text-zinc-500">{note}</p>}
          {children}
        </div>
      </div>
    </div>
  );
}
