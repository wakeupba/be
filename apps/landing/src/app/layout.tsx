import { THEME_BOOT_SCRIPT } from '@wakeupbabe/shared/theme';
import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import type { ReactNode } from 'react';
import { SmoothScroll } from '@/components/motion/smooth-scroll';
import { SiteJsonLd } from '@/components/seo/json-ld';
import { SITE_NAME, SITE_TAGLINE, SITE_URL, TWITTER_HANDLE } from '@/lib/site';
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
    site: TWITTER_HANDLE,
    creator: TWITTER_HANDLE,
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
  /* the browser chrome follows the theme; the cookie override cannot reach a
   * static meta tag, so the OS preference is the closest honest signal */
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#18181b' },
    { media: '(prefers-color-scheme: dark)', color: '#121212' },
  ],
  colorScheme: 'light dark',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      // the boot script sets .dark before react hydrates, which is the point
      suppressHydrationWarning
    >
      <head>
        {/* blocking and inline: it has to beat first paint, or dark-mode
         * visitors get a white flash on every cold landing */}
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: a build-time constant with no interpolation, and a script tag is the only way to run before paint */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-full">
        <SiteJsonLd />
        <SmoothScroll />
        {children}
      </body>
    </html>
  );
}
