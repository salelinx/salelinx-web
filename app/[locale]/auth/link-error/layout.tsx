import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

// Error landing for failed auth links. Never index it, and no meta
// description: it should not appear in search results at all.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Auth.linkError' });
  return {
    title: t('title'),
    robots: { index: false, follow: false },
  };
}

export default function LinkErrorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
