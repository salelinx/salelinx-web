import { getTranslations } from "next-intl/server";

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Legal.privacy" });
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16 prose dark:prose-invert">
      <h1>{t("title")}</h1>
      <p>{t("body")}</p>
    </main>
  );
}
