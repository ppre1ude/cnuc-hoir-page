import type { Metadata } from "next";
import localFont from "next/font/local";
import { SandLanding } from "@/features/onboarding/SandLanding";

// 공개 메인 글꼴. 페이퍼로지 1.001에서 KS X 1001 한글 2,350자와 기본 라틴·문장부호만 남긴 웹용 파일입니다.
// 이 범위 밖의 글자는 프리텐다드로 표시됩니다.
const paperlogy = localFont({
  src: [
    { path: "./fonts/Paperlogy-4Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/Paperlogy-5Medium.woff2", weight: "500", style: "normal" },
    { path: "./fonts/Paperlogy-6SemiBold.woff2", weight: "600", style: "normal" },
    { path: "./fonts/Paperlogy-7Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-paperlogy",
  display: "swap",
});

export const metadata: Metadata = {
  description: "합창으로 전하는 울림과 감동의 이야기. 전남대학교 합창단은 교내 유일의 합창 동아리입니다.",
};

export default function Home() {
  return (
    <main className={paperlogy.variable}>
      <SandLanding />
    </main>
  );
}
