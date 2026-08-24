import type { NextConfig } from "next";
import path from "node:path";
import { FRAME_ANCESTORS_CSP } from "./src/modules/platforms/frame-ancestors";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Wix Trigger test POSTs do not follow 308 trailing-slash redirects.
  skipTrailingSlashRedirect: true,
  outputFileTracingRoot: path.resolve(process.cwd()),

  eslint: {
    ignoreDuringBuilds: true,
  },

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "static.wixstatic.com",
      },
      {
        protocol: "https",
        hostname: "*.wix.com",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },

  async headers() {
    const widgetCors = [
      { key: "Access-Control-Allow-Origin", value: "*" },
      { key: "Access-Control-Allow-Methods", value: "GET, OPTIONS" },
      { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
    ];
    return [
      { source: "/widget.js", headers: widgetCors },
      { source: "/widget/:path*", headers: widgetCors },
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: FRAME_ANCESTORS_CSP,
          },
        ],
      },
      {
        source: "/api/:path*",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
    ];
  },
};

export default nextConfig;