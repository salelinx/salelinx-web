import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

// Two-step verification challenge, reached mid-login. Like /auth/confirm and
// /auth/reset-password it is transactional: never index it, and no meta
// description. Without this layout the page (a Client Component) inherited
// the root layout's indexable defaults with no canonical at all.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Auth.mfa' });
  return {
    title: t('title'),
    robots: { index: false, follow: false },
  };
}

export default function MfaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
