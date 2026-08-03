/*
 * pickuptheph.one — the phone-setup page, living on its own domain hack.
 * The onboarding QR points here: short domain, small QR, and the URL bar
 * reads "pick up the phone" while you teach your phone to do exactly that.
 *
 * The page itself is the dashboard's static /m/setup build, proxied so the
 * domain never changes in the address bar. Anything that isn't the page or
 * one of its assets gets nudged home.
 */

const UPSTREAM = 'https://app.wakeupba.be';

function isAsset(pathname: string): boolean {
  if (pathname.startsWith('/_next/')) return true;
  const lastSegment = pathname.split('/').pop() ?? '';
  return lastSegment.includes('.');
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // the page only reveals itself to whoever holds the key: the QR carries
    // ?babe, and saying x-babe back to us also counts (we said it first)
    const invited = url.searchParams.has('babe') || request.headers.has('x-babe');
    if (invited && (url.pathname === '/' || url.pathname === '/m/setup/' || url.pathname === '/m/setup')) {
      return fetch(`${UPSTREAM}/m/setup/`, { headers: request.headers });
    }
    if (isAsset(url.pathname)) {
      return fetch(`${UPSTREAM}${url.pathname}${url.search}`, { headers: request.headers });
    }

    return new Response(null, {
      status: 302,
      headers: {
        Location: 'https://wakeupba.be/',
        'x-babe': 'good. now keep it near you.',
      },
    });
  },
};
