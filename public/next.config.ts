import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // No "output: standalone" — let Vercel handle the build normally
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
