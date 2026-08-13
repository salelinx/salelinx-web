import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { ViewTransition } from 'react';
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import '../globals.css';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { SmoothAnchorScroll } from '@/components/SmoothAnchorScroll';
import { routing } from '@/i18n/routing';
import { SITE_NAME, SITE_URL } from '@/lib/site';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Layout' });
  const title = t('metaTitle');
  const description = t('metaDescription');

  // Site-wide defaults only. Canonical, hreflang, and OpenGraph are
  // deliberately NOT set here: metadata merges shallowly, so a layout-level
  // canonical would be inherited verbatim by every page that does not
  // override it, telling search engines each page is a duplicate of the
  // homepage. Pages set their own via pageMetadata() in lib/site.ts.
  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: title,
      template: `%s | ${SITE_NAME}`,
    },
    description,
    applicationName: SITE_NAME,
    icons: {
      icon: [
        { url: '/salelinx-icon.png', type: 'image/png' },
      ],
      shortcut: '/salelinx-icon.png',
      apple: '/salelinx-icon.png',
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider>
          <SmoothAnchorScroll />
          <Header />
          <div className="flex flex-1 flex-col">
            <ViewTransition>{children}</ViewTransition>
          </div>
          <Footer />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
