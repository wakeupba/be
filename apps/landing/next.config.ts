import type { NextConfig } from 'next';

/*
 * These are baked into a static export at build time, so a forgotten variable
 * is not a runtime warning, it is a wrong string shipped to every visitor.
 *
 * The defaults therefore describe production, and development is what has to
 * opt in. It used to be the other way around: NEXT_PUBLIC_API_ORIGIN defaulted
 * to localhost, so any build that did not export it sent the live site to
 * http://localhost:8787. That failed in a genuinely nasty way. Browsers ask the
 * visitor for local network permission before a public page may touch loopback,
 * so people got a scary permission prompt on wakeupba.be, and the session probe
 * behind it silently never resolved.
 *
 * A wrong default in this direction breaks a developer's machine, loudly, in
 * front of the one person able to fix it. A wrong default in the other breaks
 * production, quietly, in front of everyone else.
 */
const isDev = process.env.NODE_ENV === 'development';

const nextConfig: NextConfig = {
  // static export: served as Workers assets, no server runtime
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  env: {
    NEXT_PUBLIC_API_ORIGIN:
      process.env.NEXT_PUBLIC_API_ORIGIN ?? (isDev ? 'http://localhost:8787' : 'https://api.wakeupba.be'),
    /* A Turnstile sitekey is public by construction: it is rendered into the
     * markup for the widget to read. Committing it costs nothing and stops the
     * demo CTA disappearing from production whenever a build forgets it, which
     * is exactly what happened, and which looks identical to the CTA being
     * switched off on purpose. The secret half stays a Worker secret. */
    NEXT_PUBLIC_TURNSTILE_SITE_KEY:
      process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '0x4AAAAAAEIcASo8wY4_Tu18',
  },
};

export default nextConfig;
