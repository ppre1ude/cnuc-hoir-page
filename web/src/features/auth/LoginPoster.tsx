import Link from "next/link";
import { LoginForm } from "./LoginForm";
import { SandMark } from "./SandMark";
import styles from "./LoginPoster.module.css";

/** 안쪽 면 머리의 오선. 제목이 가사처럼 오선 아래에 놓입니다. 대기 그림(WaitingScore)과 같은 곡선입니다. */
function Staff() {
  return <svg className={styles.staff} viewBox="0 0 420 64" aria-hidden="true" focusable="false">
    {[8, 20, 32, 44, 56].map((y) => <path key={y} d={`M0 ${y} C105 ${y - 6} 210 ${y + 6} 315 ${y} S413 ${y - 4} 420 ${y}`} />)}
  </svg>;
}

/** 단원 로그인 화면. 펼친 리플렛처럼 초록 겉면(모래 심벌과 합창단 이름)과 연한 안쪽 면(제목, 구글 로그인 버튼)으로 나뉩니다. className으로 페이퍼로지 글꼴 변수를 받습니다. */
export function LoginPoster({ className }: { className?: string }) {
  return <div className={className ? `${styles.paper} ${className}` : styles.paper}>
    <main className={styles.leaflet}>
      <div className={styles.cover}>
        <SandMark className={styles.mark} />
        <p className={styles.brand}>전남대학교 합창단</p>
      </div>
      <div className={styles.inside}>
        <div className={styles.copy}>
          <Staff />
          <h1 className={styles.title}>단원 로그인</h1>
          <LoginForm />
          <Link href="/" className={styles.home}>합창단 홈으로</Link>
        </div>
      </div>
    </main>
  </div>;
}
