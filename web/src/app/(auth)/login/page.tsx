import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "../../../features/auth/LoginForm";

export const metadata: Metadata = { title: "단원 로그인" };

export default function LoginPage() {
  return <>
    <h1>단원 로그인</h1>
    <LoginForm />
    <Link href="/">합창단 홈으로</Link>
  </>;
}
