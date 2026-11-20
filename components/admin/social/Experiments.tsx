import Link from "next/link";
import type { AutoTest, Brief } from "@/lib/social/brief";
import { formatIndex } from "@/lib/social/overview";
import { PLATFORM_NAMES } from "@/lib/social/types";

const pct = (lift: number | null) => `${Math.round((lift ?? 0) * 100)}%`;

function result(t: AutoTest) {
  const make = t.needs.length ? ` Make ${t.needs.join(" and ")}.` : "";
  if (t.status === "winner") return <span className="font-medium text-emerald-700">{t.leader} wins by {pct(t.lift)}</span>;
  if (t.status === "even") return "No clear difference";
  if (t.status === "leaning") return `${t.leader} ahead by ${pct(t.lift)}, not sure yet.${make}`;
  return `Testing.${make}`;
}

export function Experiments({ brief, loadError }: { brief: Brief; loadError: string | null }) {
  return (
    <div className="mx-auto max-w-5xl space-y-3 p-4">
      <h1 className="text-sm font-semibold">Experiments</h1>
      {loadError && (
        <p className="rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2 text-sm text-zinc-700">
          Couldn&apos;t load: {loadError}
        </p>
      )}

      <BriefCard brief={brief} />

      <section className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] text-sm">
        <div className="p-4 pb-2">
          <h2 className="font-semibold">Tests running themselves</h2>
          <p className="mt-1 text-xs text-zinc-500">
            For each tag, our two most posted options head to head on views at 24 hours against our usual, over the
            last 90 days. Tags fill in automatically, so posting is all a test needs. Dig deeper in{" "}
            <Link href="/admin/marketing/insights/compare" className="text-zinc-900 underline">
              Compare
            </Link>
            .
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-zinc-500">
              <tr className="border-y border-[var(--admin-border)]">
                <th className="px-4 py-2 font-medium">Test</th>
                <th className="px-3 py-2 text-right font-medium">A</th>
                <th className="px-3 py-2 text-right font-medium">B</th>
                <th className="px-4 py-2 font-medium">Result</th>
              </tr>
            </thead>
            <tbody>
              {brief.experiments.map((t) => (
                <tr key={t.key} className="border-b border-[var(--admin-border)] last:border-b-0">
                  <td className="px-4 py-2">
                    <span className="text-zinc-500">{t.dimension}:</span> {t.a.value} vs {t.b.value}
                  </td>
                  {[t.a, t.b].map((s) => (
                    <td key={s.value} className="px-3 py-2 text-right tabular-nums">
                      {s.median === null ? "-" : formatIndex(s.median)}
                      <span className="block text-xs text-zinc-500">{s.posts} posts</span>
                    </td>
                  ))}
                  <td className="px-4 py-2 text-zinc-700">{result(t)}</td>
                </tr>
              ))}
              {brief.experiments.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-xs text-zinc-500">
                    Nothing to test yet: no tag has two options with posts measured at 24 hours.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

const hourText = (ukHour: number) => `${String(ukHour).padStart(2, "0")}:00`;

function BriefCard({ brief }: { brief: Brief }) {
  const { week } = brief;
  return (
    <section className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 text-sm">
      <h2 className="font-semibold">This week</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-zinc-700">
        <li>
          {week.uploads} uploads across platforms in the last 7 days
          {week.typical !== null && `, typically ${formatIndex(week.typical)} our usual views at 24 hours`}.
          {week.best && ` Best: "${week.best.title}" on ${PLATFORM_NAMES[week.best.platform]} (${formatIndex(week.best.index)}).`}
          {week.worst && ` Weakest: "${week.worst.title}" (${formatIndex(week.worst.index)}).`}
        </li>
        {brief.working.map((w) => (
          <li key={`${w.dimension}:${w.value}`}>
            {w.dimension} {w.value}: {w.lift >= 0 ? "+" : ""}
            {Math.round(w.lift * 100)}% against everything else at 24 hours over 90 days
            {w.often && ` (but most of them are also ${w.often})`}.
          </li>
        ))}
        {brief.bestHours.length > 0 && (
          <li>Best hours to post (UK): {brief.bestHours.map((h) => hourText(h.hour)).join(", ")}.</li>
        )}
      </ul>
    </section>
  );
}
