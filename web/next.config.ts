import type { NextConfig } from "next";

const apiInternalUrl = process.env.API_INTERNAL_URL;

if (!apiInternalUrl) {
  throw new Error("API_INTERNAL_URL 환경 변수가 필요합니다.");
}

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${apiInternalUrl}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
