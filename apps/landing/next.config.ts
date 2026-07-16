import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // static export: served as Workers assets, no server runtime
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  env: {
    NEXT_PUBLIC_API_ORIGIN: process.env.NEXT_PUBLIC_API_ORIGIN ?? 'http://localhost:8787',
  },
};

export default nextConfig;
