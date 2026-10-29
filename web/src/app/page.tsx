import type { Metadata } from "next";
import { SandLanding } from "@/features/onboarding/SandLanding";
import { paperlogy } from "./fonts/paperlogy";

export const metadata: Metadata = {
  description: "전남대학교 합창단 공식 홈페이지입니다.",
};

export default function Home() {
  return (
    <main className={paperlogy.variable}>
      <SandLanding />
    </main>
  );
}
