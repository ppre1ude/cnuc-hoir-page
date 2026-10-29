import type { Metadata } from "next";
// 2MB 통짜 글꼴 대신 글자 범위별 조각을 써서 화면에 나온 글자가 든 조각만 받습니다.
import "./fonts/pretendardvariable-dynamic-subset.css";
import "./globals.css";
import { OfflineNotice } from "../components/ui/OfflineNotice";

export const metadata: Metadata = {
  metadataBase: new URL("https://cnuc-hoir-page.vercel.app"),
  title: { default: "전남대학교 합창단", template: "%s | 전남대학교 합창단" },
  description: "전남대학교 합창단 단원 포털",
  openGraph: {
    title: "전남대학교 합창단",
    description: "전남대학교 합창단 공식 홈페이지입니다.",
    siteName: "전남대학교 합창단",
    type: "website",
    locale: "ko_KR",
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>
        {children}
        <OfflineNotice />
      </body>
    </html>
  );
}
