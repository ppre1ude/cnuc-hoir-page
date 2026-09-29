import type { NextConfig } from "next";

function apiOrigin() {
  const value = process.env.CHOIR_API_ORIGIN;
  if (!value) return null;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("CHOIR_API_ORIGIN은 HTTPS 출처여야 합니다.");
  }
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("CHOIR_API_ORIGIN은 경로와 인증 정보가 없는 HTTPS 출처여야 합니다.");
  }
  return url.origin;
}

const origin = apiOrigin();
const nextConfig: NextConfig = {
  async rewrites() {
    return origin ? [{ source: "/api/v1/:path*", destination: `${origin}/api/v1/:path*` }] : [];
  },
};

export default nextConfig;
