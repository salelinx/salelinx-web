"use client";

// Error boundary for the locale tree. Any page that throws lands here —
// most often because a server component could not reach Supabase.
//
// We do not guess. On mount this asks /api/health/supabase, which runs on
// Vercel (independent of Supabase) and probes both auth and PostgREST, and
// only then decides between "we are down" and "something went wrong". Saying
// "maintenance" for what is actually a code bug trains people to ignore the
// message.
//
// The probe costs nothing on the happy path: it only ever runs on a page that
// has ALREADY failed. The sessionStorage cache keeps a user clicking around
// during an outage from re-probing on every navigation, which would add load
// to a backend that is by definition already struggling.

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

type Verdict = "checking" | "outage" | "bug";

const CACHE_KEY = "slx_health_verdict";
const CACHE_TTL_MS = 30_000;

function readCached(): Exclude<Verdict, "checking"> | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { v, at } = JSON.parse(raw) as { v: "outage" | "bug"; at: number };
    return Date.now() - at < CACHE_TTL_MS ? v : null;
  } catch {
    return null; // private mode, blocked storage — just probe again
  }
}

function writeCached(v: "outage" | "bug"): void {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ v, at: Date.now() }));
  } catch {
    /* non-fatal */
  }
}

export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("Maintenance");
  // Seeded lazily rather than set inside the effect: a cached verdict is known
  // at first render, and setting it in an effect would cascade a re-render.
  // sessionStorage is absent during SSR, which readCached handles.
  const [verdict, setVerdict] = useState<Verdict>(
    () => readCached() ?? "checking",
  );

  // Keep the digest in the browser console so a real bug stays traceable from
  // a user's report, without putting it on screen. Separate from the probe so
  // it logs once per error, not again when the verdict lands.
  useEffect(() => {
    console.error("Page error", error.digest ?? "", error);
  }, [error]);

  useEffect(() => {
    if (verdict !== "checking") return;

    let cancelled = false;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    fetch("/api/health/supabase", {
      cache: "no-store",
      signal: controller.signal,
    })
      // Only 503 means "Supabase is not serving". Everything else that is not
      // a 200 is the probe declining to answer, not evidence of an outage:
      // 500 is the endpoint itself misconfigured (a bad deploy), and 401 is
      // HEALTH_CHECK_TOKEN being set — which this caller cannot send, since
      // the secret must never reach the client. Treating those as an outage
      // would show "we're down" every time a page threw for any reason.
      .then((res) => (res.status === 503 ? "outage" : "bug"))
      // A probe that cannot complete is itself evidence something is wrong
      // upstream, so treat it as an outage rather than blaming the page.
      .catch(() => "outage" as const)
      .then((v) => {
        if (cancelled) return;
        writeCached(v);
        setVerdict(v);
      })
      .finally(() => clearTimeout(timer));

    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, [verdict]);

  const isOutage = verdict === "outage";

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-20 text-center">
      <p className="font-mono text-sm text-zinc-500 dark:text-zinc-400">
        {isOutage ? t("label") : t("errorLabel")}
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">
        {verdict === "checking"
          ? t("checkingTitle")
          : isOutage
            ? t("title")
            : t("errorTitle")}
      </h1>
      <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
        {verdict === "checking"
          ? t("checkingBody")
          : isOutage
            ? t("body")
            : t("errorBody")}
      </p>

      <button
        type="button"
        onClick={reset}
        className="mt-8 block w-full rounded-lg bg-black px-4 py-3 text-center text-white dark:bg-white dark:text-black"
      >
        {t("retry")}
      </button>

      <div className="mt-6 text-sm">
        <Link href="/docs/status" className="underline">
          {t("checkStatus")}
        </Link>
      </div>
    </main>
  );
}
