import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  async rewrites() {
    const base = process.env.BACKEND_API_URL ?? "http://localhost:8000";
    return [
      {
        source: "/api/:path*",
        destination: `${base.replace(/\/$/, "")}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;