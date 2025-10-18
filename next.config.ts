import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: true,
  eslint: {
    // Disable ESLint during builds for deployment
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
