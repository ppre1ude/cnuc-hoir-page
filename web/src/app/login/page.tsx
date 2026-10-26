import type { Metadata } from "next";
import { LoginPoster } from "@/features/auth/LoginPoster";
import { paperlogy } from "../fonts/paperlogy";

export const metadata: Metadata = { title: "단원 로그인" };

export default function LoginPage() {
  return <LoginPoster className={paperlogy.variable} />;
}
