import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { InstallExtensionButton } from "@/components/InstallExtensionButton";
import { BrandWordmark } from "@/components/BrandWordmark";
import { Confetti, RefreshUntilReady } from "@/components/PlanStartedClient";

const PILL =
  "inline-flex items-center rounded-full border border-zinc-300 px-6 py-2.5 transition-colors hover:border-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:border-zinc-500 dark:hover:bg-zinc-900";

export async function PlanStartedView({
  locale,
  kind,
  plan,
  date,
}: {
  locale: string;
  kind: "trial" | "paid" | "pending";
  plan: string;
  date: string | null;
}) {
  const t = await getTranslations({ locale, namespace: "PlanStarted" });

  if (kind === "pending") {
    return (
      <main className="mx-auto flex min-h-[70vh] w-full max-w-2xl flex-col justify-center px-6 py-16">
        <RefreshUntilReady />
        <h1 className="text-3xl font-bold tracking-tight">
          {t("pendingTitle")}
        </h1>
        <p className="mt-3 text-zinc-600 dark:text-zinc-400">
          {t("pendingBody")}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-xl flex-col items-center justify-center px-6 py-16 text-center">
      <Confetti />
      <div className="animate-[popIn_0.5s_ease-out_both]">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {kind === "trial" ? t("titleTrial") : t("titlePaid")}
        </h1>
        <p className="mt-3 text-zinc-600 dark:text-zinc-400">
          {kind === "trial"
            ? date
              ? t("bodyTrial", { date })
              : t("bodyTrialNoDate")
            : t("bodyPaid", { plan })}
        </p>
      </div>

      <div className="mt-10 w-full rounded-2xl border border-black/10 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:border-white/10 dark:bg-zinc-900">
        <p className="font-semibold">{t("nextTitle")}</p>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {t("nextBody")}
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <a href="https://www.depop.com" aria-label="Depop" className={PILL}>
            <BrandWordmark brand="depop" variant="wordmark" height="1.05rem" />
          </a>
          <a
            href="https://www.vinted.co.uk"
            aria-label="Vinted"
            className={`${PILL} dark:[&_svg]:fill-[#09b1ba]`}
          >
            <BrandWordmark brand="vinted" variant="wordmark" height="1.35rem" />
          </a>
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3 border-t border-black/10 pt-6 text-sm text-zinc-500 dark:border-white/10 dark:text-zinc-400">
          {t("noExtension")}
          <InstallExtensionButton
            label={t("addToChrome")}
            className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-black/10 bg-white px-5 py-2.5 text-sm font-medium text-zinc-900 transition hover:border-black/20 dark:border-white/15 dark:bg-white/[0.04] dark:text-zinc-50 dark:hover:border-white/25"
          />
        </div>
      </div>

      <Link
        href="/account"
        className="mt-8 rounded-full bg-black px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
      >
        {t("toAccount")}
      </Link>
    </main>
  );
}
