import type { Metadata } from "next";
import { isConcertUpcoming } from "@/features/concert/concert";
import { SandLanding } from "@/features/onboarding/SandLanding";
import { paperlogy } from "./fonts/paperlogy";

export const metadata: Metadata = {
  description: "전남대학교 합창단 공식 홈페이지입니다.",
};

// 연주회 안내 줄이 공연 다음 날 내려가도록 한 시간마다 다시 만듭니다.
export const revalidate = 3600;

export default function Home() {
  return (
    <main className={paperlogy.variable}>
      <SandLanding showConcert={isConcertUpcoming(new Date())} />
    </main>
  );
}
