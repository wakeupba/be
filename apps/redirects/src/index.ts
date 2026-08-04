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

/* This domain proxies the dashboard's setup page under a second hostname, which
 * is duplicate content by construction. It is also nobody's search result: the
 * only way in is the QR code from onboarding. So every response says noindex.
 *
 * The nudge home stays a 302 on purpose. A 301 would be the tidier SEO answer,
 * but browsers cache it indefinitely and this path is one query parameter away
 * from being the real setup page, which is not a thing to make permanent for a
 * gain the noindex header already covers. */
const NOINDEX = 'noindex, nofollow';

function isAsset(pathname: string): boolean {
  if (pathname.startsWith('/_next/')) return true;
  const lastSegment = pathname.split('/').pop() ?? '';
  return lastSegment.includes('.');
}

async function proxy(target: string, request: Request): Promise<Response> {
  const upstream = await fetch(target, { headers: request.headers });
  const response = new Response(upstream.body, upstream);
  response.headers.set('X-Robots-Tag', NOINDEX);
  return response;
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // the page only reveals itself to whoever holds the key: the QR carries
    // ?babe, and saying x-babe back to us also counts (we said it first)
    const invited = url.searchParams.has('babe') || request.headers.has('x-babe');
    if (invited && (url.pathname === '/' || url.pathname === '/m/setup/' || url.pathname === '/m/setup')) {
      return proxy(`${UPSTREAM}/m/setup/`, request);
    }
    if (isAsset(url.pathname)) {
      return proxy(`${UPSTREAM}${url.pathname}${url.search}`, request);
    }

    return new Response(null, {
      status: 302,
      headers: {
        Location: 'https://wakeupba.be/',
        'X-Robots-Tag': NOINDEX,
        'x-babe': 'good. now keep it near you.',
      },
    });
  },
};
