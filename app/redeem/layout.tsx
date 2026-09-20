import { Geist, Geist_Mono } from 'next/font/google';
import '../globals.css';

// /redeem is outside app/[locale]/, which is where globals.css and the font
// variables are pulled in, so without this layout the page renders as raw
// unstyled HTML. It deliberately does not reuse the locale layout: that one
// needs a NextIntlClientProvider and drags in the Header, Footer and cookie
// banner. A creator opening a one-time code wants the code and a button, and
// the page is non-localized precisely to avoid six translations of it.

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export default function RedeemLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
