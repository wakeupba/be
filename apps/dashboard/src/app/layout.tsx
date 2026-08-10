import { THEME_BOOT_SCRIPT } from '@wakeupbabe/shared/theme';
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import type { ReactNode } from 'react';
import { ErrorReporting } from '@/components/error-reporting';
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
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      // the boot script sets .dark before react hydrates, which is the whole
      // point of it; the class mismatch it creates is expected
      suppressHydrationWarning
    >
      <head>
        {/* blocking and inline: it has to beat first paint, or dark-mode
         * users get a white flash on every cold navigation */}
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: a build-time
         * constant with no interpolation, and a script tag is the only way to
         * run before paint */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="h-full">
        {/* first in the body: sibling effects run in tree order, so its
         * listeners are up before the rest of the app's effects and before
         * anyone can interact with anything */}
        <ErrorReporting />
        {children}
      </body>
    </html>
  );
}
