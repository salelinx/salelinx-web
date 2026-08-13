import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

// Transactional page reached from one-time email links. Never index it, and
// no meta description: it should not appear in search results at all.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Auth.resetPassword' });
  return {
    title: t('title'),
    robots: { index: false, follow: false },
  };
}

export default function ResetPasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
