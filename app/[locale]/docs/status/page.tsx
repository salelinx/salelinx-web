import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Breadcrumbs } from "@/components/docs/Breadcrumbs";
import {
  MARKETPLACE_LABELS,
  STATE_META,
  getMarketplaceStatus,
} from "@/lib/docs/status";
import { getPublicFeatureStatus } from "@/lib/docs/feature-status";
import type { Marketplace } from "@/lib/docs/types";
import { pageMetadata } from "@/lib/site";

const MONO = "font-mono text-[0.68rem] uppercase tracking-[0.12em]";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Docs.status" });
  return pageMetadata({
    locale,
    path: "/docs/status",
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

export default async function StatusPage() {
  const t = await getTranslations("Docs");
  // Independent reads: the hand-maintained marketplace state and the
  // telemetry-derived feature state do not depend on each other.
  const [statuses, features] = await Promise.all([
    getMarketplaceStatus(),
    getPublicFeatureStatus(),
  ]);

  // Pair the two platform-scoped entries per feature into one row, keyed by the
  // shared label. Insertion order is preserved, so the row order still follows
  // FEATURE_ENDPOINTS (roughly "how visible a breakage would be").
  const featureRows = features.reduce<
    Array<{
      label: string;
      byMarketplace: Partial<Record<Marketplace, (typeof features)[number]>>;
      notes: Array<{ marketplace: Marketplace; note: string }>;
    }>
  >((rows, feature) => {
    let row = rows.find((r) => r.label === feature.label);
    if (!row) {
      row = { label: feature.label, byMarketplace: {}, notes: [] };
      rows.push(row);
    }
    row.byMarketplace[feature.marketplace] = feature;
    if (feature.note) {
      row.notes.push({ marketplace: feature.marketplace, note: feature.note });
    }
    return rows;
  }, []);

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-12">
      <Breadcrumbs
        trail={[
          { label: t("breadcrumbDocs"), href: "/docs" },
          { label: t("status.breadcrumb") },
        ]}
      />
      <header className="mt-8">
        <span className={`${MONO} text-zinc-500`}>{t("status.eyebrow")}</span>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
          {t("status.title")}
        </h1>
        <p className="mt-3 max-w-2xl text-zinc-600 dark:text-zinc-400">
          {t("status.intro")}
        </p>
      </header>

      {/* Two peer sections: marketplace reachability, and the extension
          features running against them. Neither is a subheading of the other -
          a user arriving here wants whichever one matches their symptom. */}
      <section className="mt-12">
        <h2 className="text-xl font-semibold tracking-tight">
          {t("status.marketplacesHeading")}
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
          {t("status.marketplacesBody")}
        </p>

        <ul className="mt-6 divide-y divide-black/10 dark:divide-white/10">
        {statuses.map((s) => {
          const meta = STATE_META[s.state];
          return (
            <li
              key={s.marketplace}
              id={s.marketplace}
              className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-start gap-3">
                <span
                  className={`mt-1.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full ${meta.dot}`}
                />
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-medium tracking-tight">
                      {MARKETPLACE_LABELS[s.marketplace]}
                    </h2>
                    <span
                      className={`${MONO} rounded-full border px-2 py-0.5 ${meta.badge}`}
                    >
                      {t(`status.state.${s.state}`)}
                    </span>
                  </div>
                  {s.note ? (
                    <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
                      {s.note}
                    </p>
                  ) : null}
                </div>
              </div>
              <span className="shrink-0 text-xs text-zinc-500 sm:text-right">
                {t("status.updatedPrefix", { date: s.updatedAt })}
              </span>
            </li>
          );
        })}
        </ul>
      </section>

      {/* Feature status, derived from anonymous aggregated telemetry. Each
          feature is measured per marketplace, since that is how breakages land:
          a Vinted change takes out Vinted crosslisting while Depop keeps
          working. */}
      <section className="mt-12">
        <h2 className="text-xl font-semibold tracking-tight">
          {t("status.featuresHeading")}
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
          {t("status.featuresBody")}
        </p>

        {/* One row per feature, both marketplaces side by side. Grouping by
            platform put "Crosslist" in two places several screens apart, which
            is the wrong shape for the question people arrive with: not "how is
            Vinted" but "is crosslisting working, and where". */}
        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[32rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-black/10 dark:border-white/10">
                <th
                  className={`${MONO} py-2 text-left font-normal text-zinc-500`}
                >
                  {t("status.featureColumn")}
                </th>
                {(["vinted", "depop"] as const).map((marketplace) => (
                  <th
                    key={marketplace}
                    className={`${MONO} py-2 text-left font-normal text-zinc-500`}
                  >
                    {MARKETPLACE_LABELS[marketplace]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {featureRows.map((row) => (
                <tr
                  key={row.label}
                  className="border-b border-black/5 dark:border-white/5"
                >
                  <th
                    scope="row"
                    className="py-3 pr-4 text-left align-top font-normal"
                  >
                    {row.label}
                    {/* Notes come only from a manual override, and are the most
                        useful thing on the page when present. Shown once per
                        row, prefixed when the two sides differ. */}
                    {row.notes.map((n) => (
                      <span
                        key={n.marketplace}
                        className="mt-1 block text-xs text-zinc-600 dark:text-zinc-400"
                      >
                        {row.notes.length > 1
                          ? `${MARKETPLACE_LABELS[n.marketplace]}: ${n.note}`
                          : n.note}
                      </span>
                    ))}
                  </th>
                  {(["vinted", "depop"] as const).map((marketplace) => {
                    const cell = row.byMarketplace[marketplace];
                    if (!cell) {
                      // The feature does not exist on this marketplace at all.
                      // An empty cell would read as "unknown"; this says so.
                      return (
                        <td
                          key={marketplace}
                          className="py-3 pr-4 align-top text-xs text-zinc-400"
                        >
                          {t("status.notAvailable")}
                        </td>
                      );
                    }
                    const meta = STATE_META[cell.state];
                    return (
                      <td key={marketplace} className="py-3 pr-4 align-top">
                        <span className="flex items-center gap-2">
                          <span
                            className={`inline-block h-2 w-2 shrink-0 rounded-full ${meta.dot}`}
                          />
                          <span
                            className={`${MONO} rounded-full border px-2 py-0.5 ${meta.badge}`}
                          >
                            {t(`status.state.${cell.state}`)}
                          </span>
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* The section most visitors actually need. Everything above measures
          problems affecting many sellers at once; the outcomes a single stuck
          user hits (CAPTCHA, expired login, no open tab) are deliberately
          excluded from those signals, so without this the page would tell them
          "operational" and nothing else. */}
      <section className="mt-14 rounded-lg border border-black/10 p-6 dark:border-white/10">
        <h2 className="text-lg font-medium tracking-tight">
          {t("status.selfHelpHeading")}
        </h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          {t("status.selfHelpBody")}
        </p>
        <ul className="mt-4 space-y-3 text-sm text-zinc-600 dark:text-zinc-400">
          <li className="flex gap-3">
            <span aria-hidden="true" className="text-zinc-400">
              -
            </span>
            {t("status.selfHelpCaptcha")}
          </li>
          <li className="flex gap-3">
            <span aria-hidden="true" className="text-zinc-400">
              -
            </span>
            {t("status.selfHelpLogin")}
          </li>
          <li className="flex gap-3">
            <span aria-hidden="true" className="text-zinc-400">
              -
            </span>
            {t("status.selfHelpTab")}
          </li>
        </ul>
        <p className="mt-4 text-sm">
          <Link
            href="/help/support"
            className="underline underline-offset-4 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            {t("status.selfHelpContact")}
          </Link>
        </p>
      </section>

      <p className="mt-12 text-sm text-zinc-500">{t("status.footnote")}</p>
      {/* Stated plainly: this is our inference from our own users' traffic, not
          an official feed. Publishing a claim about someone else's
          infrastructure without saying so would be dishonest. */}
      <p className="mt-3 text-sm text-zinc-500">{t("status.inferredNote")}</p>
    </main>
  );
}
