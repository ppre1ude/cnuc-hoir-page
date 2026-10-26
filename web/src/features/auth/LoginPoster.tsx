import Link from "next/link";
import { LoginForm } from "./LoginForm";
import { SandMark } from "./SandMark";
import styles from "./LoginPoster.module.css";

/** 단원 로그인 화면. 펼친 리플렛처럼 초록 겉면(모래 심벌과 제목)과 연한 안쪽 면(구글 로그인 버튼)으로 나뉩니다. className으로 페이퍼로지 글꼴 변수를 받습니다. */
export function LoginPoster({ className }: { className?: string }) {
  return <div className={className ? `${styles.paper} ${className}` : styles.paper}>
    <main className={styles.leaflet}>
      <div className={styles.cover}>
        <SandMark className={styles.mark} />
        <div className={styles.heading}>
          <p className={styles.brand}>전남대학교 합창단</p>
          <h1 className={styles.title}>단원 로그인</h1>
        </div>
      </div>
      <div className={styles.inside}>
        <div className={styles.copy}>
          <LoginForm />
          <Link href="/" className={styles.home}>합창단 홈으로</Link>
        </div>
      </div>
    </main>
  </div>;
}
