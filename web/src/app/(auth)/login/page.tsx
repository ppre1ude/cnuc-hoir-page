import Image from "next/image";
import Link from "next/link";
import { LoginForm } from "../../../features/auth/LoginForm";
import styles from "./page.module.css";

export default function LoginPage() {
  return (
    <main className={styles.page}>
      <div className={styles.artPanel}>
        <Image
          src="/images/choir-songbooks.png"
          alt=""
          width={1774}
          height={887}
          className={styles.illustration}
          priority
        />
      </div>
      <section className={styles.panel} aria-labelledby="login-title">
        <div className={styles.panelInner}>
          <Link className={styles.brand} href="/" aria-label="전남대학교 합창단 홈">
            <Image src="/images/choir-logo-horizontal.png" alt="" width={280} height={61} priority />
          </Link>
          <div className={styles.content}>
            <h1 id="login-title">단원 로그인</h1>
            <LoginForm />
            <Link className={styles.join} href="/join">단원 계정 가입 신청 <span aria-hidden="true">↗</span></Link>
          </div>
          <Link className={styles.home} href="/">합창단 홈으로</Link>
        </div>
      </section>
    </main>
  );
}
