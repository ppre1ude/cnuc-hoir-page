import Link from "next/link";
import { RegistrationForm } from "@/features/auth/RegistrationForm";

export default function JoinPage() {
  return (
    <main>
      <h1>가입 신청</h1>
      <p>이메일 확인 후 운영진 승인을 받아야 회원 자료를 볼 수 있습니다.</p>
      <RegistrationForm />
      <Link href="/">처음으로</Link>
    </main>
  );
}
