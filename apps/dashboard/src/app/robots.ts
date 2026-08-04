import type { MetadataRoute } from 'next';

/* required by `output: export`: metadata routes must declare themselves static */
export const dynamic = 'force-static';

/*
 * Deliberately allows crawling, because `Disallow: /` is the wrong tool here.
 *
 * A disallowed URL can still sit in the index (Google keeps it on the strength
 * of inbound links and just never fetches it), and blocking the fetch means the
 * noindex directive is never read. Google's own guidance is to allow the crawl
 * and answer with noindex, which is what the worker's X-Robots-Tag header and
 * the root layout's robots metadata do on every response here.
 *
 * The login page is the only thing a crawler can reach anyway; everything else
 * is a 302 behind the session gate.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/' }],
  };
}
