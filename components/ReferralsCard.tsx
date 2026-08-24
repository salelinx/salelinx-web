"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

type Props = {
  link: string;
  pending: number;
  converting: number;
  rewarded: number;
  // Pre-formatted server-side (locale + currency aware); null until the
  // first reward lands
  creditEarned: string | null;
};

export function ReferralsCard({
  link,
  pending,
  converting,
  rewarded,
  creditEarned,
}: Props) {
  const t = useTranslations("Referrals");
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      if (resetTimer.current) clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be unavailable (permissions, http); the link is
      // visible and selectable as a fallback.
    }
  }

  const stats: Array<{ label: string; value: number }> = [
    { label: t("statSignedUp"), value: pending },
    { label: t("statSubscribed"), value: converting },
    { label: t("statRewarded"), value: rewarded },
  ];

  return (
    <section
      id="referrals"
      className="mt-6 scroll-mt-24 rounded-2xl border border-black/10 p-6 dark:border-white/10"
    >
      <h2 className="text-xl font-semibold">{t("title")}</h2>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        {t("body")}
      </p>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <code className="min-w-0 flex-1 truncate rounded-lg border border-black/10 px-4 py-3 text-sm dark:border-white/20">
          {link}
        </code>
        <button
          type="button"
          onClick={copyLink}
          className="shrink-0 rounded-full bg-black px-5 py-2.5 text-sm font-medium text-white dark:bg-white dark:text-black"
        >
          {copied ? t("copied") : t("copy")}
        </button>
      </div>

      <dl className="mt-6 grid grid-cols-3 gap-3 border-t border-black/10 pt-5 text-sm dark:border-white/10">
        {stats.map((s) => (
          <div key={s.label}>
            <dt className="text-zinc-600 dark:text-zinc-400">{s.label}</dt>
            <dd className="mt-0.5 text-base font-medium">{s.value}</dd>
          </div>
        ))}
      </dl>

      {creditEarned && (
        <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
          {t("creditEarned", { amount: creditEarned })}
        </p>
      )}

      <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
        {t("termsNote")}{" "}
        <Link href="/legal/referral-terms" className="underline">
          {t("termsLink")}
        </Link>
      </p>
    </section>
  );
}
