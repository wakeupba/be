import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import type { ReactNode } from 'react';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Wake Up Babe',
  description: 'Your calendar, but clingy.',
  /* Nothing behind the auth gate belongs in an index. The gate already returns
   * the sign-in page to a crawler rather than a dashboard, which is exactly how
   * a stray login screen ends up ranking for the brand name and outranking the
   * landing page. robots.ts covers the crawl, this covers anything already
   * fetched, and both are needed. */
  robots: { index: false, follow: false, nocache: true },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="h-full">{children}</body>
    </html>
  );
}
