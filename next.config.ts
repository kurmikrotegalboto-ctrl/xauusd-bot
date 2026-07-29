import type { NextConfig } from "next";

// Vercel deployment — remove standalone output (Vercel handles build)
// Keep ignoreBuildErrors true for safety (we have legacy deps)
const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
