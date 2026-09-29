import Link from "next/link";
import Image from "next/image";
import { RegistrationForm } from "@/features/auth/RegistrationForm";
import styles from "../simple.module.css";

export default function JoinPage() {
  return (
    <main className={styles.page}>
      <Link className={styles.brand} href="/" aria-label="전남대학교 합창단 홈">
        <Image src="/images/choir-logo-horizontal.png" alt="" width={280} height={61} priority />
      </Link>
      <div className={styles.content}>
        <h1>가입 신청</h1>
        <p>이메일 확인과 운영진 승인 후 회원 자료를 볼 수 있습니다.</p>
        <RegistrationForm />
        <Link className={styles.home} href="/login">로그인으로 돌아가기</Link>
      </div>
    </main>
  );
}
