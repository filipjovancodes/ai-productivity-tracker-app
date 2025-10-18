import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: true,
  // Suppress hydration warnings from browser extensions
  experimental: {
    suppressHydrationWarning: true,
  },
};

export default nextConfig;
