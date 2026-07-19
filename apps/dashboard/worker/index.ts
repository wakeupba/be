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
        return Response.redirect(new URL('/login/', url).toString(), 302);
      }
      if (userId && startsWithPrefix(url.pathname, '/login')) {
        return Response.redirect(new URL('/', url).toString(), 302);
      }
    }

    return env.ASSETS.fetch(request);
  },
};
