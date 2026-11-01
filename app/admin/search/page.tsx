import { notFound } from "next/navigation";
import sitemap from "@/app/sitemap";
import { createServerClient } from "@/lib/supabase/server";
import {
  aggregateQueries,
  fetchSearchConsole,
  mergeWithSitemap,
} from "@/lib/admin/search-console";
import {
  AdminSearchTable,
  type SearchTableRow,
} from "@/components/admin/search/AdminSearchTable";
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
  "/help/support": "Contact support",
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
  searchParams: Promise<{ days?: string; view?: string }>;
}) {
  // The page reads a server-held Google key, so it checks is_admin() itself
  // rather than relying on the layout, which renders in parallel with it.
  const supabase = await createServerClient();
  const { data: admin } = await supabase.rpc("is_admin");
  if (admin !== true) notFound();

  const params = await searchParams;
  const days = PERIODS.find((p) => p === Number(params.days)) ?? 28;
  const view = params.view === "searches" ? "searches" : "pages";
  const titles = pageTitles();
  const path = (url: string) => url.replace(/^https?:\/\/[^/]+/, "") || "/";

  let rows: SearchTableRow[] = [];
  let range: string | undefined;
  let summary = "";
  let error: string | undefined;
  try {
    if (view === "searches") {
      const [byQuery, byQueryPage] = await Promise.all([
        fetchSearchConsole(days, ["query"]),
        fetchSearchConsole(days, ["query", "page"]),
      ]);
      range = `${byQuery.startDate} to ${byQuery.endDate}`;
      const queries = aggregateQueries(byQuery.rows, byQueryPage.rows);
      const brandClicks = queries
        .filter((q) => q.brand)
        .reduce((s, q) => s + q.clicks, 0);
      const allClicks = queries.reduce((s, q) => s + q.clicks, 0);
      summary = `${queries.length} searches, ${brandClicks} of ${allClicks} clicks from searches for the brand. Google hides rare searches for privacy, so these totals are lower than the Pages view.`;
      rows = queries.map((q) => ({
        key: q.query,
        label: q.query,
        sub: q.topPage
          ? `${path(q.topPage)}${titleFor(q.topPage, titles) ? `, ${titleFor(q.topPage, titles)}` : ""}`
          : undefined,
        tag: q.brand ? "brand" : undefined,
        clicks: q.clicks,
        impressions: q.impressions,
        ctr: q.ctr,
        position: q.position,
      }));
    } else {
      const sitemapUrls = sitemap().flatMap((e) => [
        e.url,
        ...Object.values(e.alternates?.languages ?? {}).filter(
          (u): u is string => typeof u === "string",
        ),
      ]);
      let result: Awaited<ReturnType<typeof fetchSearchConsole>> | null = null;
      try {
        result = await fetchSearchConsole(days, ["page"]);
      } catch (e) {
        error =
          e instanceof Error ? e.message : "Search Console request failed";
      }
      range = result ? `${result.startDate} to ${result.endDate}` : undefined;
      const pages = mergeWithSitemap(sitemapUrls, result?.rows ?? []);
      const clicks = pages.reduce((s, r) => s + r.clicks, 0);
      const impressions = pages.reduce((s, r) => s + r.impressions, 0);
      const unseen = pages.filter((r) => r.inSitemap && !r.impressions).length;
      summary = `${clicks} clicks, ${impressions} impressions, ${unseen} sitemap pages not shown in Google yet.`;
      rows = pages.map((r) => ({
        key: r.url,
        label: path(r.url),
        href: r.url,
        sub: titleFor(r.url, titles),
        tag: r.inSitemap ? undefined : "not in sitemap",
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: r.ctr,
        position: r.position,
      }));
    }
  } catch (e) {
    error = e instanceof Error ? e.message : "Search Console request failed";
  }

  return (
    <AdminSearchTable
      rows={rows}
      view={view}
      days={days}
      periods={[...PERIODS]}
      range={range}
      summary={summary}
      error={error}
    />
  );
}
