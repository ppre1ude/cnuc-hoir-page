import { Nanum_Myeongjo } from "next/font/google";

// 연주회 포스터의 제목 글씨에 맞춘 명조입니다. 빌드할 때 내려받아 우리 서버에서 내보내므로 방문자가 구글에 접속하지 않습니다.
// 한글은 글자 범위별 조각으로 나뉘어 화면에 나온 글자만 받으니 미리 받기는 끕니다.
export const myeongjo = Nanum_Myeongjo({
  weight: ["700", "800"],
  preload: false,
  variable: "--font-myeongjo",
  display: "swap",
});
