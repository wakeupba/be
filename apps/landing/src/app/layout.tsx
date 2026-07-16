import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import type { ReactNode } from 'react';
import { SmoothScroll } from '@/components/motion/smooth-scroll';
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
  metadataBase: new URL('https://wakeupba.be'),
  title: 'Wake Up Babe | Color a meeting red. Your phone rings before it.',
  description:
    'Wake Up Babe calls your phone before the Google Calendar meetings you mark as important, through Do Not Disturb. Notifications get ignored. Phone calls get answered.',
  openGraph: {
    title: 'Wake Up Babe',
    description:
      'Color a meeting red in Google Calendar. Your phone rings before it, through Do Not Disturb.',
    url: 'https://wakeupba.be',
    siteName: 'Wake Up Babe',
    type: 'website',
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full">
        <SmoothScroll />
        {children}
      </body>
    </html>
  );
}
