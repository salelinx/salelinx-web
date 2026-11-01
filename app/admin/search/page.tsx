import { notFound } from "next/navigation";
import sitemap from "@/app/sitemap";
import { createServerClient } from "@/lib/supabase/server";
import {
  fetchSearchConsolePages,
  mergeWithSitemap,
} from "@/lib/admin/search-console";
import { AdminSearchTable } from "@/components/admin/search/AdminSearchTable";
import { routing } from "@/i18n/routing";
import { listPosts } from "@/lib/blog/posts";
import { LANDING_PAGES } from "@/lib/landing/pages";
import { CATEGORIES } from "@/lib/docs/categories";
import { ARTICLE_MODULES_BY_LOCALE } from "@/lib/docs/manifest";

const PERIODS = [7, 28, 90] as const;

const STATIC_TITLES: Record<string, string> = {
  "/": "Homepage",
  "/features": "Features overview",
  "/pricing": "Plans and prices",
  "/roadmap": "Public roadmap",
  "/help": "Help centre",
  "/help/faq": "FAQ",
  "/docs": "Docs home",
  "/docs/changelog": "Changelog",
  "/docs/status": "Marketplace status",
  "/blog": "Blog index",
  "/legal/privacy": "Privacy policy",
  "/legal/terms": "Terms of service",
  "/legal/dpa": "Data processing agreement",
  "/legal/referral-terms": "Referral terms",
};

function pageTitles(): Map<string, string> {
  const titles = new Map(Object.entries(STATIC_TITLES));
  for (const p of LANDING_PAGES) titles.set(`/features/${p.slug}`, p.title);
  for (const { metadata } of listPosts())
    titles.set(`/blog/${metadata.slug}`, metadata.title);
  for (const { slug } of CATEGORIES)
    titles.set(`/docs/${slug}`, `Docs: ${slug.replace(/-/g, " ")}`);
  for (const { metadata } of ARTICLE_MODULES_BY_LOCALE[routing.defaultLocale])
    titles.set(`/docs/${metadata.category}/${metadata.slug}`, metadata.title);
  return titles;
}

function titleFor(
  url: string,
  titles: Map<string, string>,
): string | undefined {
  const path = url.replace(/^https?:\/\/[^/]+/, "").replace(/[?#].*$/, "");
  const [, first, ...rest] = path.split("/");
  const unprefixed = (routing.locales as readonly string[]).includes(first)
    ? `/${rest.join("/")}`
    : path;
  return titles.get(unprefixed.replace(/(.)\/$/, "$1") || "/");
}

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

  const titles = pageTitles();
  return (
    <AdminSearchTable
      rows={mergeWithSitemap(sitemapUrls, result?.rows ?? []).map((r) => ({
        ...r,
        title: titleFor(r.url, titles),
      }))}
      days={days}
      periods={[...PERIODS]}
      range={result ? `${result.startDate} to ${result.endDate}` : undefined}
      error={error}
    />
  );
}
