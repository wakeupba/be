/** @type {import('next').NextConfig} */
const nextConfig = {
  // static export: served as Workers assets, no server runtime, no size limits
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  env: {
    NEXT_PUBLIC_API_ORIGIN: process.env.NEXT_PUBLIC_API_ORIGIN ?? 'http://localhost:8787',
    NEXT_PUBLIC_LANDING_ORIGIN: process.env.NEXT_PUBLIC_LANDING_ORIGIN ?? 'http://localhost:3000',
  },
};

export default nextConfig;
