import localFont from "next/font/local";

// 공개 메인과 단원 로그인의 글꼴. 페이퍼로지 1.001에서 KS X 1001 한글 2,350자와 기본 라틴·문장부호만 남긴 웹용 파일입니다.
// 이 범위 밖의 글자는 프리텐다드로 표시됩니다. next/font는 빌드 때만 동작하므로 페이지 파일에서만 불러옵니다.
export const paperlogy = localFont({
  src: [
    { path: "./Paperlogy-4Regular.woff2", weight: "400", style: "normal" },
    { path: "./Paperlogy-5Medium.woff2", weight: "500", style: "normal" },
    { path: "./Paperlogy-6SemiBold.woff2", weight: "600", style: "normal" },
    { path: "./Paperlogy-7Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-paperlogy",
  display: "swap",
});
