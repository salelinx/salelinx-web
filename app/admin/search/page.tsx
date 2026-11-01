import { notFound } from "next/navigation";
import sitemap from "@/app/sitemap";
import { createServerClient } from "@/lib/supabase/server";
import {
  fetchSearchConsolePages,
  mergeWithSitemap,
} from "@/lib/admin/search-console";
import { AdminSearchTable } from "@/components/admin/search/AdminSearchTable";

const PERIODS = [7, 28, 90] as const;

export default async function AdminSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  // The page reads a server-held Google key, so it checks is_admin() itself
  // rather than relying on the layout, which renders in parallel with it.
  const supabase = await createServerClient();
  const { data: admin } = await supabase.rpc("is_admin");
  if (admin !== true) notFound();

  const requested = Number((await searchParams).days);
  const days = PERIODS.find((p) => p === requested) ?? 28;
  const sitemapUrls = sitemap().flatMap((e) => [
    e.url,
    ...Object.values(e.alternates?.languages ?? {}).filter(
      (u): u is string => typeof u === "string",
    ),
  ]);

  let result: Awaited<ReturnType<typeof fetchSearchConsolePages>> | null = null;
  let error: string | undefined;
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    error =
      "GOOGLE_SERVICE_ACCOUNT_JSON is not set, so only the sitemap is listed.";
  } else {
    try {
      result = await fetchSearchConsolePages(days);
    } catch (e) {
      error = e instanceof Error ? e.message : "Search Console request failed";
    }
  }

  return (
    <AdminSearchTable
      rows={mergeWithSitemap(sitemapUrls, result?.rows ?? [])}
      days={days}
      periods={[...PERIODS]}
      range={result ? `${result.startDate} to ${result.endDate}` : undefined}
      error={error}
    />
  );
}
