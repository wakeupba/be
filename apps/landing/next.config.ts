import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // static export: served as Workers assets, no server runtime
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
