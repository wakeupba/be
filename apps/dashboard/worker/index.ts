import { readSession } from '@wakeupbabe/shared';

/*
 * Edge auth gate in front of the static dashboard build. Document requests
 * are authenticated against the same SESSION_SECRET the api signs with, so
 * logged-out visitors get a server-side 302 to /login before any app HTML
 * is served. Assets and public routes fall through to the static build.
 *
 * Typed structurally (not with workers-types) so it typechecks under the
 * app's DOM tsconfig; wrangler bundles this file independently of next.
 */

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  SESSION_SECRET: string;
}

// /m/* is the phone-facing setup page reached from the onboarding QR code
const PUBLIC_PREFIXES = ['/login', '/m'];

function startsWithPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

// gate only navigations: skip build assets and anything with a file extension
function isDocumentPath(pathname: string): boolean {
  if (pathname.startsWith('/_next/')) return false;
  const lastSegment = pathname.split('/').pop() ?? '';
  return !lastSegment.includes('.');
}

/*
 * Nothing on this origin should be indexed. The header, not robots.txt, is what
 * achieves that: robots.txt can only stop the fetch, and a URL that is never
 * fetched can still sit in the index forever on the strength of a link. Applied
 * to the login page and to the redirects too, since those are exactly what a
 * crawler sees.
 *
 * robots.txt is the one exception: marking it noindex is harmless but Google
 * fetches it before anything else, and leaving it clean keeps the intent legible
 * to anyone reading the headers.
 */
const NOINDEX = 'noindex, nofollow';

function redirectTo(location: string): Response {
  return new Response(null, { status: 302, headers: { Location: location, 'X-Robots-Tag': NOINDEX } });
}

function noindex(response: Response): Response {
  const withHeader = new Response(response.body, response);
  withHeader.headers.set('X-Robots-Tag', NOINDEX);
  return withHeader;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (isDocumentPath(url.pathname)) {
      const userId = await readSession(
        request.headers.get('Cookie') ?? undefined,
        env.SESSION_SECRET,
      );
      const isPublic = PUBLIC_PREFIXES.some((prefix) => startsWithPrefix(url.pathname, prefix));
      if (!userId && !isPublic) {
        return redirectTo(new URL('/login/', url).toString());
      }
      if (userId && startsWithPrefix(url.pathname, '/login')) {
        return redirectTo(new URL('/', url).toString());
      }
    }

    const response = await env.ASSETS.fetch(request);
    return url.pathname === '/robots.txt' ? response : noindex(response);
  },
};
