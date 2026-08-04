import type { MetadataRoute } from 'next';
import { SITE_NAME, SITE_TAGLINE } from '@/lib/site';

/* required by `output: export`: metadata routes must declare themselves static */
export const dynamic = 'force-static';

/* display: 'browser' on purpose. This is a marketing site, not the app — the
 * thing worth installing is app.wakeupba.be. The manifest is here for the icon
 * set and the Android theme colour, not to bait an install prompt for a page
 * you read once. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: SITE_NAME,
    description: SITE_TAGLINE,
    start_url: '/',
    display: 'browser',
    background_color: '#ffffff',
    theme_color: '#18181b',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
