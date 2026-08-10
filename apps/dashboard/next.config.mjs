/*
 * These are baked into a static export at build time, so the defaults describe
 * production and development opts in via NODE_ENV. It used to be the other way
 * around, and the landing paid for it first (#27): a build without the env
 * vars exported shipped http://localhost:8787 to every visitor. The dashboard
 * had the same defaults and the same thing happened to it the very next day,
 * which is the argument for this shape stated twice.
 */
const isDev = process.env.NODE_ENV === 'development';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // static export: served as Workers assets, no server runtime, no size limits
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  env: {
    NEXT_PUBLIC_API_ORIGIN:
      process.env.NEXT_PUBLIC_API_ORIGIN ?? (isDev ? 'http://localhost:8787' : 'https://api.wakeupba.be'),
    NEXT_PUBLIC_LANDING_ORIGIN:
      process.env.NEXT_PUBLIC_LANDING_ORIGIN ?? (isDev ? 'http://localhost:3003' : 'https://wakeupba.be'),
  },
};

export default nextConfig;
