import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import type { ReactNode } from 'react';
import { SmoothScroll } from '@/components/motion/smooth-scroll';
import { SiteJsonLd } from '@/components/seo/json-ld';
import { SITE_NAME, SITE_TAGLINE, SITE_URL } from '@/lib/site';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  /* %s fills from each page's own title; the homepage overrides absolutely so it
   * does not end up as "Wake Up Babe | Wake Up Babe" */
  title: {
    default: `${SITE_NAME} | Color a meeting red. Your phone rings before it.`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_TAGLINE,
  applicationName: SITE_NAME,
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: 'productivity',
  keywords: [
    'calendar reminder phone call',
    'google calendar phone call reminder',
    'do not disturb meeting reminder',
    'meeting reminder call',
    'never miss a meeting',
    'calendar wake up call',
    'phone call reminders',
  ],
  /* apex, not www. Both domains serve the same asset worker and a static export
   * cannot redirect by host, so this tag is what resolves the duplicate. */
  alternates: { canonical: '/' },
  openGraph: {
    title: `${SITE_NAME} | Color a meeting red. Your phone rings before it.`,
    description:
      'Color a meeting red in Google Calendar. Your phone rings before it, through Do Not Disturb.',
    url: SITE_URL,
    siteName: SITE_NAME,
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_NAME} | Color a meeting red. Your phone rings before it.`,
    description:
      'Color a meeting red in Google Calendar. Your phone rings before it, through Do Not Disturb.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      /* let Google use the full-size preview instead of a thumbnail, and quote
       * as much of the page as it wants — both help on a page whose pitch needs
       * a sentence to land */
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  /* iOS otherwise linkifies things that merely look like phone numbers — "2:15
   * PM" in the call card is a standing candidate */
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: '#18181b',
  colorScheme: 'light',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full">
        <SiteJsonLd />
        <SmoothScroll />
        {children}
      </body>
    </html>
  );
}
