import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  experimental: {
    proxyClientMaxBodySize: 209715200, // 200MB upload limit for standalone mode
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Prevent aggressive caching that serves stale builds to users
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate, max-age=0",
          },
          {
            key: "Pragma",
            value: "no-cache",
          },
          {
            key: "Expires",
            value: "0",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
