import styles from "./WaitingScore.module.css";

// 첫 화면의 흐르는 오선과 음표를 줄인 대기 표시입니다. 음표 하나가 오선을 따라 천천히 오갑니다.
export function WaitingScore() {
  return <svg className={styles.score} viewBox="0 0 240 72" aria-hidden="true" focusable="false">
    <g className={styles.staff}>
      {[18, 28, 38, 48, 58].map((y) => <path key={y} d={`M0 ${y} C60 ${y - 6} 120 ${y + 6} 180 ${y} S236 ${y - 4} 240 ${y}`} />)}
    </g>
    <g className={styles.note}>
      <ellipse rx="7" ry="5" transform="rotate(-20)" />
      <path d="M6 -1 V-28" />
    </g>
  </svg>;
}
