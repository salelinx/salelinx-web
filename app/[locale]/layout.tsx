import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { ViewTransition } from 'react';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import '../globals.css';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { routing } from '@/i18n/routing';

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
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  };
}

// Runs before body paints on first load. Only needed when no `theme` cookie
// exists yet (e.g., visitor's first page view) so we can honour system dark
// preference without flashing light. Once ThemeToggle writes the cookie, SSR
// below handles it directly and this script becomes a no-op.
const themeInitScript = `(() => { try { if (document.cookie.split('; ').some(c => c.startsWith('theme='))) return; if (matchMedia('(prefers-color-scheme: dark)').matches) document.documentElement.classList.add('dark'); } catch (_) {} })();`;

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

  const cookieStore = await cookies();
  const isDark = cookieStore.get('theme')?.value === 'dark';

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased${isDark ? ' dark' : ''}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider>
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
