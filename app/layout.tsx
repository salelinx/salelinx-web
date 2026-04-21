import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Resale Bot - Sell across Depop & Vinted",
  description:
    "Crosslist, relist, refresh, and restock across Depop and Vinted from one place.",
};

const themeInitScript = `(() => { try { const s = localStorage.getItem('theme'); const d = s === 'dark' || (!s && matchMedia('(prefers-color-scheme: dark)').matches); if (d) document.documentElement.classList.add('dark'); } catch (_) {} })();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <Header />
        {children}
      </body>
    </html>
  );
}
