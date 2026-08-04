import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

/* required by `output: export`: metadata routes must declare themselves static */
export const dynamic = 'force-static';

/* Static export renders this to /robots.txt at build time.
 *
 * Everything on this origin is meant to be found — the private surfaces live on
 * app.wakeupba.be, which disallows itself. The only thing worth spelling out is
 * where the sitemap is. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/' }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
