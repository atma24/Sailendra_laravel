import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  async rewrites() {
    const base =
      process.env.NODE_ENV === "production"
        ? "https://api.jtatrack.com"
        : "http://localhost:8000";
    return [
      {
        source: "/api/:path*",
        destination: `${base}/api/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          // { key: 'Content-Security-Policy', value: "default-src 'self'; style-src 'self' fonts.googleapis.com; font-src fonts.gstatic.com" },
        ],
      },
      {
        source: '/login',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        ],
      },
      {
        source: '/profile',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        ],
      },
      {
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        ],
      },
    ];
  },
};

export default nextConfig;