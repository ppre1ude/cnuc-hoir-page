import Image from "next/image";
import Link from "next/link";
import { LoginForm } from "./LoginForm";
import styles from "./LoginPoster.module.css";

/** 안쪽 면 머리의 오선. 제목이 가사처럼 오선 아래에 놓이고, 음표 하나가 오선을 따라 천천히 흘러갑니다. 대기 그림(WaitingScore)과 같은 곡선과 음표입니다. */
function Staff() {
  return <svg className={styles.staff} viewBox="0 0 420 64" aria-hidden="true" focusable="false">
    {[8, 20, 32, 44, 56].map((y) => <path key={y} d={`M0 ${y} C105 ${y - 6} 210 ${y + 6} 315 ${y} S413 ${y - 4} 420 ${y}`} />)}
    <g className={styles.note}>
      <ellipse rx="7" ry="5" transform="rotate(-20)" />
      <path d="M6 -1 V-28" />
    </g>
  </svg>;
}

/** 단원 로그인 화면. 펼친 리플렛처럼 초록 겉면(심벌과 합창단 이름)과 연한 안쪽 면(제목, 구글 로그인 버튼)으로 나뉩니다. className으로 페이퍼로지 글꼴 변수를 받습니다. */
export function LoginPoster({ className }: { className?: string }) {
  return <div className={className ? `${styles.paper} ${className}` : styles.paper}>
    <main className={styles.leaflet}>
      <div className={styles.cover}>
        {/* 심벌 원본 이미지를 흰색으로 바꿔 올립니다. 이름은 바로 아래 글자로 있어 대체 글은 비웁니다. */}
        <Image className={styles.mark} src="/images/choir-mark.png" alt="" width={540} height={359} priority />
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
