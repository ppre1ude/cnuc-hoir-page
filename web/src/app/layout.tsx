import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "전남대학교 합창단",
  description: "전남대학교 합창단 회원 포털",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
