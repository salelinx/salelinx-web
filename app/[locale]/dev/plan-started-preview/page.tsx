import { notFound } from "next/navigation";
import { PlanStartedView } from "@/components/PlanStartedView";

// No-login preview of /account/started. 404s on the live Vercel deployment.
export default async function PlanStartedPreview({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ type?: string; plan?: string }>;
}) {
  if (process.env.VERCEL_ENV === "production") notFound();
  const [{ locale }, qs] = await Promise.all([params, searchParams]);
  const kind = qs.type === "paid" || qs.type === "pending" ? qs.type : "trial";
  const date = new Date("2026-10-26").toLocaleDateString(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return (
    <PlanStartedView
      locale={locale}
      kind={kind}
      plan={qs.plan ?? "Starter"}
      date={date}
    />
  );
}
