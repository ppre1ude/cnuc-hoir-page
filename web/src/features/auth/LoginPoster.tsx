import Link from "next/link";
import { LoginForm } from "./LoginForm";
import { SandMark } from "./SandMark";
import styles from "./LoginPoster.module.css";

/** 단원 로그인 화면. 초록 종이 한 장에 모래 심벌, 제목, 구글 로그인 버튼을 올린 포스터입니다. className으로 페이퍼로지 글꼴 변수를 받습니다. */
export function LoginPoster({ className }: { className?: string }) {
  return <div className={className ? `${styles.paper} ${className}` : styles.paper}>
    <main className={styles.poster}>
      <SandMark className={styles.mark} />
      <div className={styles.copy}>
        <div className={styles.heading}>
          <p className={styles.brand}>전남대학교 합창단</p>
          <h1 className={styles.title}>단원 로그인</h1>
        </div>
        <LoginForm />
        <Link href="/" className={styles.home}>합창단 홈으로</Link>
      </div>
    </main>
  </div>;
}
