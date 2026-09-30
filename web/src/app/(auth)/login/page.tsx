import Link from "next/link";
import { BrandLogo } from "../../../components/ui";
import { LoginForm } from "../../../features/auth/LoginForm";
import styles from "./page.module.css";

export default function LoginPage() {
  return (
    <main className={styles.page}>
      <section className={styles.panel} aria-labelledby="login-title">
        <div className={styles.panelInner}>
          <Link className={styles.brand} href="/" aria-label="전남대학교 합창단 홈">
            <BrandLogo alt="" priority />
          </Link>
          <div className={styles.content}>
            <h1 id="login-title">단원 로그인</h1>
            <LoginForm />
          </div>
          <Link className={styles.home} href="/">합창단 홈으로</Link>
        </div>
      </section>
    </main>
  );
}
