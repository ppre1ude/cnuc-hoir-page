import type { Metadata } from "next";
import { SandLanding } from "@/features/onboarding/SandLanding";
import { paperlogy } from "./fonts/paperlogy";

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
