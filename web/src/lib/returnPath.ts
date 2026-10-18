// 돌아갈 주소는 쿼리가 아니라 해시에 담습니다. QR 토큰(#token=)이 서버나 Vercel 로그에 남지 않게 하기 위해서입니다.
export function loginPath(location: Pick<Location, "pathname" | "search" | "hash">): string {
  if (location.pathname === "/login" || location.pathname === "/") return "/login";
  return `/login#next=${encodeURIComponent(location.pathname + location.search + location.hash)}`;
}

// 같은 출처로 해석되는 경로만 받습니다. "//evil.example"이나 "/\evil.example"처럼 "/"로 시작해도 다른 출처로 가는 값을 막습니다.
export function readReturnPath(location: Pick<Location, "hash" | "origin">): string | null {
  const raw = new URLSearchParams(location.hash.slice(1)).get("next");
  if (!raw?.startsWith("/")) return null;
  let url: URL;
  try {
    url = new URL(raw, location.origin);
  } catch {
    return null;
  }
  if (url.origin !== location.origin || url.pathname === "/login") return null;
  return url.pathname + url.search + url.hash;
}
