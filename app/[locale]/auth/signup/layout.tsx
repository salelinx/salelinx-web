import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { isSignedIn } from '@/lib/auth/session';
import { pageMetadata } from '@/lib/site';

// The page is a Client Component, so its metadata lives here.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Auth.signup' });
  return pageMetadata({
    locale,
    path: '/auth/signup',
    title: t('title'),
    description: t('metaDescription'),
  });
}

export default async function SignupLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  if (await isSignedIn()) {
    const { locale } = await params;
    redirect({ href: '/account', locale });
  }
  return children;
}
