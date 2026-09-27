import Link from "next/link";
import styles from "./page.module.css";

export default function Home() {
  return (
    <main className={styles.page}>
      <div className={styles.content}>
        <p className={styles.eyebrow}>합창단 회원 포털</p>
        <h1>전남대학교 합창단</h1>
        <p className={styles.description}>
          단원을 위한 공지, 행사 일정, 출석 기록을 한곳에서 확인하세요.
        </p>
        <div className={styles.actions}>
          <Link className={styles.primary} href="/login">
            로그인
          </Link>
          <Link className={styles.secondary} href="/join">
            가입 신청
          </Link>
        </div>
      </div>
    </main>
  );
}
