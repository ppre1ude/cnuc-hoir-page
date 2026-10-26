"use client";

import RouteError from "./error";
import "./fonts/pretendardvariable-dynamic-subset.css";
import "./globals.css";

// 루트 레이아웃까지 무너졌을 때만 쓰입니다. 레이아웃을 대신하므로 html·body와 전역 스타일을 직접 둡니다.
export default function GlobalError(props: { error: Error & { digest?: string }; retry: () => void }) {
  return <html lang="ko"><body><RouteError {...props} /></body></html>;
}
