import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  /* config options here */
  compress: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          // X-Frame-Options: SAMEORIGIN allows the site to be loaded in Capacitor WebView
          // since the native app loads from the same origin (fantasyphish.com)
          // This prevents clickjacking while allowing native mobile app functionality
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "origin-when-cross-origin",
          },
        ],
      },
    ]
  },
}

export default nextConfig
